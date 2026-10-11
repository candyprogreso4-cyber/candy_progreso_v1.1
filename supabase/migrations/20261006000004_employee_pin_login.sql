-- Replace daily QR employee sign-in with employee identification + personal PIN.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.employee_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_sessions_active
  ON public.employee_sessions (employee_id, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.employee_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.employee_sessions FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.employees FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, profile_id, identification, full_name, is_active, created_at)
  ON TABLE public.employees TO authenticated;
GRANT UPDATE (is_active) ON TABLE public.employees TO authenticated;

CREATE OR REPLACE FUNCTION public.create_employee_with_pin(
  p_identification TEXT,
  p_full_name TEXT,
  p_pin TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_employee_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede registrar empleados.';
  END IF;
  IF p_identification IS NULL OR length(trim(p_identification)) < 5
     OR p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'Ingresa un nombre y una cédula válidos.';
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'El PIN debe tener exactamente 6 dígitos.';
  END IF;

  INSERT INTO public.employees (identification, full_name, is_active, pin_hash)
  VALUES (
    trim(p_identification),
    trim(p_full_name),
    true,
    crypt(p_pin, gen_salt('bf', 12))
  )
  RETURNING id INTO v_employee_id;

  RETURN v_employee_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_employee_pin(
  p_employee_id UUID,
  p_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar PIN de empleados.';
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'El PIN debe tener exactamente 6 dígitos.';
  END IF;

  UPDATE public.employees
  SET pin_hash = crypt(p_pin, gen_salt('bf', 12)),
      failed_login_attempts = 0,
      locked_until = NULL
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado no encontrado.';
  END IF;

  RETURN true;
END;
$$;

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
  v_session_expires := now() + interval '12 hours';

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
      'full_name', v_employee.full_name
    ),
    'session_token', v_session_token,
    'expires_at', v_session_expires
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
      'full_name', v_employee.full_name
    ),
    'expires_at', v_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_employee_session(p_session_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF p_session_token IS NULL OR p_session_token !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  UPDATE public.employee_sessions
  SET revoked_at = now()
  WHERE token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    AND revoked_at IS NULL;
  RETURN FOUND;
END;
$$;

DROP FUNCTION IF EXISTS public.validate_employee_access(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.generate_daily_qr();

REVOKE ALL ON FUNCTION public.create_employee_with_pin(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_employee_pin(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.authenticate_employee(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_employee_session(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_employee_session(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employee_with_pin(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_employee_pin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.authenticate_employee(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_employee_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_employee_session(TEXT) TO anon, authenticated;

COMMIT;
