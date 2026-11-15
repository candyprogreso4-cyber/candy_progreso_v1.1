BEGIN;

CREATE OR REPLACE FUNCTION public.has_business_access(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.business_memberships bm
      JOIN public.profiles p ON p.id = bm.user_id
      JOIN public.businesses b ON b.id = bm.business_id
      WHERE bm.business_id = p_business_id
        AND bm.user_id = (SELECT auth.uid())
        AND p.is_active = true
        AND b.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_business_admin(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.business_memberships bm
      JOIN public.profiles p ON p.id = bm.user_id
      JOIN public.businesses b ON b.id = bm.business_id
      WHERE bm.business_id = p_business_id
        AND bm.user_id = (SELECT auth.uid())
        AND bm.role IN ('owner', 'admin')
        AND p.is_active = true
        AND b.is_active = true
    );
$$;

REVOKE ALL ON FUNCTION public.has_business_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_business_access(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.is_business_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_admin(UUID) TO authenticated;

DROP POLICY IF EXISTS profiles_select_own_or_business_admin ON public.profiles;
CREATE POLICY profiles_select_own_or_business_admin
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.business_memberships bm ON bm.business_id = e.business_id
      WHERE e.profile_id = profiles.id
        AND bm.user_id = (SELECT auth.uid())
        AND bm.role IN ('owner', 'admin')
        AND public.is_business_admin(bm.business_id)
    )
  );

DROP POLICY IF EXISTS businesses_platform_admin_read ON public.businesses;
CREATE POLICY businesses_platform_admin_read
  ON public.businesses FOR SELECT TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Business admins upload their branding images" ON storage.objects;
CREATE POLICY "Business admins upload their branding images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-branding'
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.is_business_admin((storage.foldername(name))[1]::UUID)
      ELSE false
    END
  );

DROP POLICY IF EXISTS "Admins upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Business admins upload product images" ON storage.objects;
CREATE POLICY "Business admins upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.is_business_admin((storage.foldername(name))[1]::UUID)
      ELSE false
    END
  );

CREATE OR REPLACE FUNCTION public.is_shop_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.is_shop_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_shop_admin() TO authenticated;

ALTER TABLE public.daily_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Daily access readable for valid tokens" ON public.daily_access;
DROP POLICY IF EXISTS "Admins manage daily access" ON public.daily_access;
REVOKE ALL ON TABLE public.daily_access FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reject_reserved_business_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.slug IN ('platform', 'not-found') THEN
    RAISE EXCEPTION 'Este identificador está reservado por una ruta del sistema.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_reserved_business_slug ON public.businesses;
CREATE TRIGGER reject_reserved_business_slug
  BEFORE INSERT OR UPDATE OF slug ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_reserved_business_slug();

CREATE OR REPLACE FUNCTION public.create_business(
  p_name TEXT,
  p_slug TEXT,
  p_business_type TEXT,
  p_owner_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business public.businesses%ROWTYPE;
  v_owner_id UUID;
  v_owner_name TEXT;
  v_owner_profile_active BOOLEAN;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Solo el administrador de plataforma puede crear negocios.';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'El nombre debe tener entre 2 y 100 caracteres.';
  END IF;
  IF p_business_type IS NULL OR length(trim(p_business_type)) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'El tipo de negocio debe tener entre 2 y 60 caracteres.';
  END IF;
  IF p_slug IS NULL OR lower(trim(p_slug)) !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'El identificador debe usar minúsculas, números y guiones.';
  END IF;
  IF lower(trim(p_slug)) IN ('platform', 'not-found') THEN
    RAISE EXCEPTION 'Este identificador está reservado por una ruta del sistema.';
  END IF;

  SELECT u.id,
         COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1))
  INTO v_owner_id, v_owner_name
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_owner_email))
    AND u.email_confirmed_at IS NOT NULL;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'El correo del administrador debe existir y estar confirmado en Supabase Auth.';
  END IF;

  SELECT p.is_active INTO v_owner_profile_active
  FROM public.profiles p
  WHERE p.id = v_owner_id;
  IF FOUND AND NOT v_owner_profile_active THEN
    RAISE EXCEPTION 'El perfil del administrador está desactivado. Reactívalo explícitamente antes de asignarlo.';
  END IF;

  INSERT INTO public.businesses (name, slug, business_type)
  VALUES (trim(p_name), lower(trim(p_slug)), trim(p_business_type))
  RETURNING * INTO v_business;

  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (v_owner_id, v_owner_name, 'employee', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.business_memberships (business_id, user_id, role)
  VALUES (v_business.id, v_owner_id, 'owner');

  INSERT INTO public.business_salon_access (business_id, access_enabled)
  VALUES (v_business.id, false);

  INSERT INTO public.tables (business_id, table_number, status)
  SELECT v_business.id, n, 'available'
  FROM generate_series(1, 8) AS n;

  INSERT INTO public.audit_logs (business_id, user_id, action, entity, entity_id, metadata)
  VALUES (
    v_business.id,
    auth.uid(),
    'create_business',
    'businesses',
    v_business.id,
    jsonb_build_object('owner_email', lower(trim(p_owner_email)), 'slug', v_business.slug)
  );

  RETURN jsonb_build_object(
    'id', v_business.id,
    'name', v_business.name,
    'slug', v_business.slug,
    'business_type', v_business.business_type,
    'logo_url', v_business.logo_url,
    'primary_color', v_business.primary_color,
    'secondary_color', v_business.secondary_color,
    'owner_email', lower(trim(p_owner_email))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_business_active(
  p_business_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business public.businesses%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Solo el administrador de plataforma puede cambiar el estado de un negocio.';
  END IF;
  IF p_business_id IS NULL OR p_is_active IS NULL THEN
    RAISE EXCEPTION 'El negocio y el estado son obligatorios.';
  END IF;

  UPDATE public.businesses
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_business_id
  RETURNING * INTO v_business;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el negocio.';
  END IF;

  IF NOT p_is_active THEN
    UPDATE public.business_salon_access
    SET access_enabled = false,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE business_id = p_business_id;
    UPDATE public.employee_sessions
    SET revoked_at = COALESCE(revoked_at, now())
    WHERE business_id = p_business_id
      AND revoked_at IS NULL;
  END IF;

  INSERT INTO public.audit_logs (business_id, user_id, action, entity, entity_id, metadata)
  VALUES (
    v_business.id,
    auth.uid(),
    CASE WHEN p_is_active THEN 'activate_business' ELSE 'deactivate_business' END,
    'businesses',
    v_business.id,
    jsonb_build_object('is_active', p_is_active)
  );

  RETURN jsonb_build_object(
    'id', v_business.id,
    'slug', v_business.slug,
    'is_active', v_business.is_active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_business_active(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_business_active(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_legacy_salon_access_control()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.salon_access_control
  SET access_enabled = EXISTS (
        SELECT 1
        FROM public.business_salon_access sa
        JOIN public.businesses b ON b.id = sa.business_id
        WHERE sa.access_enabled = true
          AND b.is_active = true
      ),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_legacy_salon_access_control ON public.business_salon_access;
CREATE TRIGGER sync_legacy_salon_access_control
  AFTER INSERT OR UPDATE OF access_enabled ON public.business_salon_access
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_legacy_salon_access_control();

UPDATE public.salon_access_control
SET access_enabled = EXISTS (
      SELECT 1
      FROM public.business_salon_access sa
      JOIN public.businesses b ON b.id = sa.business_id
      WHERE sa.access_enabled = true
        AND b.is_active = true
    ),
    updated_at = now()
WHERE id = true;

CREATE OR REPLACE FUNCTION public.get_business_employee_orders(
  p_slug TEXT,
  p_session_token TEXT
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  SELECT b.id INTO v_business_id
  FROM public.businesses b
  JOIN public.business_salon_access sa ON sa.business_id = b.id AND sa.access_enabled
  WHERE b.slug = lower(trim(p_slug))
    AND b.is_active = true;

  IF v_business_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.employee_sessions s
    JOIN public.employees e ON e.id = s.employee_id
    WHERE s.business_id = v_business_id
      AND s.token_hash = encode(extensions.digest(COALESCE(p_session_token, ''), 'sha256'), 'hex')
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND e.business_id = v_business_id
      AND e.is_active = true
  ) THEN
    RAISE EXCEPTION 'El acceso a este negocio no es válido o está cerrado.';
  END IF;

  RETURN QUERY
  SELECT to_jsonb(employee_orders)
  FROM public.get_employee_orders(p_session_token) AS employee_orders;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_business_employee_order_delivered(
  p_slug TEXT,
  p_session_token TEXT,
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id UUID;
  v_employee_id UUID;
BEGIN
  SELECT b.id INTO v_business_id
  FROM public.businesses b
  JOIN public.business_salon_access sa ON sa.business_id = b.id AND sa.access_enabled
  WHERE b.slug = lower(trim(p_slug))
    AND b.is_active = true;

  SELECT e.id INTO v_employee_id
  FROM public.employee_sessions s
  JOIN public.employees e ON e.id = s.employee_id
  WHERE s.business_id = v_business_id
    AND s.token_hash = encode(extensions.digest(COALESCE(p_session_token, ''), 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND e.business_id = v_business_id
    AND e.is_active = true;

  IF v_business_id IS NULL OR v_employee_id IS NULL THEN
    RAISE EXCEPTION 'El acceso a este negocio no es válido o está cerrado.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.business_id = v_business_id
      AND o.employee_id = v_employee_id
  ) THEN
    RAISE EXCEPTION 'El pedido no existe en este negocio o no pertenece a esta sesión.';
  END IF;

  RETURN public.mark_employee_order_delivered(p_session_token, p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_orders(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_employee_order_delivered(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_business_employee_orders(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_business_employee_order_delivered(TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_employee_orders(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_business_employee_order_delivered(TEXT, TEXT, UUID) TO anon, authenticated;

COMMIT;
