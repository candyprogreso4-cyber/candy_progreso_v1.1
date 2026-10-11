-- Let admins enable indefinite employee sessions individually and revoke them centrally.
BEGIN;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS allow_persistent_session BOOLEAN NOT NULL DEFAULT false;

REVOKE ALL ON TABLE public.employees FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  profile_id,
  identification,
  full_name,
  is_active,
  allow_persistent_session,
  created_at
) ON TABLE public.employees TO authenticated;
GRANT UPDATE (is_active) ON TABLE public.employees TO authenticated;

CREATE OR REPLACE FUNCTION public.authenticate_employee(
  p_identification TEXT,
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_employee public.employees%ROWTYPE;
  v_session_token TEXT;
  v_session_expires TIMESTAMPTZ;
BEGIN
  SELECT *
  INTO v_employee
  FROM public.employees
  WHERE identification = trim(COALESCE(p_identification, ''))
  FOR UPDATE;

  IF NOT FOUND OR NOT v_employee.is_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cédula o PIN incorrectos, o cuenta inactiva.');
  END IF;

  IF v_employee.locked_until IS NOT NULL AND v_employee.locked_until > now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Acceso temporalmente bloqueado por intentos fallidos. Intenta más tarde.'
    );
  END IF;

  IF v_employee.pin_hash IS NULL
     OR p_pin IS NULL
     OR crypt(p_pin, v_employee.pin_hash) <> v_employee.pin_hash THEN
    UPDATE public.employees
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
          WHEN failed_login_attempts + 1 >= 5 THEN now() + interval '15 minutes'
          ELSE NULL
        END
    WHERE id = v_employee.id;

    RETURN jsonb_build_object('success', false, 'message', 'Cédula o PIN incorrectos, o cuenta inactiva.');
  END IF;

  UPDATE public.employees
  SET failed_login_attempts = 0,
      locked_until = NULL
  WHERE id = v_employee.id;

  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_session_expires := CASE
    WHEN v_employee.allow_persistent_session THEN 'infinity'::timestamptz
    ELSE now() + interval '12 hours'
  END;

  INSERT INTO public.employee_sessions (employee_id, token_hash, expires_at)
  VALUES (
    v_employee.id,
    encode(digest(v_session_token, 'sha256'), 'hex'),
    v_session_expires
  );

  RETURN jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', v_employee.id,
      'identification', v_employee.identification,
      'full_name', v_employee.full_name,
      'allow_persistent_session', v_employee.allow_persistent_session
    ),
    'session_token', v_session_token,
    'expires_at', CASE
      WHEN v_employee.allow_persistent_session THEN NULL
      ELSE v_session_expires
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_employee_session(p_session_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_employee public.employees%ROWTYPE;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_session_token IS NULL OR p_session_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT e.*
  INTO v_employee
  FROM public.employee_sessions s
  JOIN public.employees e ON e.id = s.employee_id
  WHERE s.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND e.is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT s.expires_at
  INTO v_expires_at
  FROM public.employee_sessions s
  WHERE s.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now();

  RETURN jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', v_employee.id,
      'identification', v_employee.identification,
      'full_name', v_employee.full_name,
      'allow_persistent_session', v_employee.allow_persistent_session
    ),
    'expires_at', CASE
      WHEN v_expires_at = 'infinity'::timestamptz THEN NULL
      ELSE v_expires_at
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_employee_persistent_session(
  p_employee_id UUID,
  p_allow BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar este permiso.';
  END IF;

  UPDATE public.employees
  SET allow_persistent_session = COALESCE(p_allow, false)
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado no encontrado.';
  END IF;

  IF p_allow THEN
    UPDATE public.employee_sessions
    SET expires_at = 'infinity'::timestamptz
    WHERE employee_id = p_employee_id
      AND revoked_at IS NULL;
  ELSE
    UPDATE public.employee_sessions
    SET revoked_at = now()
    WHERE employee_id = p_employee_id
      AND revoked_at IS NULL;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_inactive_employee_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.is_active AND NOT NEW.is_active THEN
    UPDATE public.employee_sessions
    SET revoked_at = now()
    WHERE employee_id = NEW.id
      AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS revoke_sessions_when_employee_deactivated ON public.employees;
CREATE TRIGGER revoke_sessions_when_employee_deactivated
AFTER UPDATE OF is_active ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.revoke_inactive_employee_sessions();

REVOKE ALL ON FUNCTION public.authenticate_employee(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_employee_session(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_employee_persistent_session(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_inactive_employee_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authenticate_employee(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_employee_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_employee_persistent_session(UUID, BOOLEAN) TO authenticated;

COMMIT;
