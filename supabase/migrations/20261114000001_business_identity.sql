BEGIN;

CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  business_type TEXT NOT NULL DEFAULT 'Comercio',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#5E2748' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color TEXT NOT NULL DEFAULT '#F2B84B' CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_memberships (
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_business_memberships_user
  ON public.business_memberships (user_id, business_id);

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = (SELECT auth.uid())
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
      WHERE bm.business_id = p_business_id
        AND bm.user_id = (SELECT auth.uid())
        AND bm.role IN ('owner', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.get_business_branding(p_slug TEXT)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'slug', b.slug,
    'business_type', b.business_type,
    'logo_url', b.logo_url,
    'primary_color', b.primary_color,
    'secondary_color', b.secondary_color
  )
  FROM public.businesses b
  WHERE b.slug = lower(trim(p_slug))
    AND b.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.update_business_branding(
  p_business_id UUID,
  p_name TEXT,
  p_business_type TEXT,
  p_logo_url TEXT,
  p_primary_color TEXT,
  p_secondary_color TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business public.businesses%ROWTYPE;
BEGIN
  IF NOT public.is_business_admin(p_business_id) THEN
    RAISE EXCEPTION 'No tienes permisos para editar este negocio.';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'El nombre debe tener entre 2 y 100 caracteres.';
  END IF;

  IF p_business_type IS NULL OR length(trim(p_business_type)) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'El tipo de negocio debe tener entre 2 y 60 caracteres.';
  END IF;

  IF p_primary_color !~ '^#[0-9A-Fa-f]{6}$'
     OR p_secondary_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Los colores deben usar el formato hexadecimal #RRGGBB.';
  END IF;

  IF p_logo_url IS NOT NULL AND (
    length(p_logo_url) > 2048
    OR p_logo_url !~* '^https://'
  ) THEN
    RAISE EXCEPTION 'El logo debe ser una URL HTTPS válida.';
  END IF;

  UPDATE public.businesses
  SET name = trim(p_name),
      business_type = trim(p_business_type),
      logo_url = p_logo_url,
      primary_color = p_primary_color,
      secondary_color = p_secondary_color,
      updated_at = now()
  WHERE id = p_business_id
    AND is_active = true
  RETURNING * INTO v_business;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El negocio no existe o está inactivo.';
  END IF;

  RETURN jsonb_build_object(
    'id', v_business.id,
    'name', v_business.name,
    'slug', v_business.slug,
    'business_type', v_business.business_type,
    'logo_url', v_business.logo_url,
    'primary_color', v_business.primary_color,
    'secondary_color', v_business.secondary_color
  );
END;
$$;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active businesses are publicly readable" ON public.businesses;
CREATE POLICY "Active businesses are publicly readable"
  ON public.businesses FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Users read own business memberships" ON public.business_memberships;
CREATE POLICY "Users read own business memberships"
  ON public.business_memberships FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins read platform admin list" ON public.platform_admins;
CREATE POLICY "Platform admins read platform admin list"
  ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_platform_admin());

REVOKE ALL ON public.businesses, public.business_memberships, public.platform_admins
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.businesses TO anon, authenticated;
GRANT SELECT ON public.business_memberships, public.platform_admins TO authenticated;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_business_admin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_business_branding(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_business_branding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_branding(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_business_branding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-branding',
  'business-branding',
  true,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view business branding images" ON storage.objects;
CREATE POLICY "Public can view business branding images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'business-branding');

DROP POLICY IF EXISTS "Business admins upload their branding images" ON storage.objects;
CREATE POLICY "Business admins upload their branding images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-branding'
    AND (
      public.is_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.business_memberships bm
        WHERE bm.user_id = (SELECT auth.uid())
          AND bm.role IN ('owner', 'admin')
          AND bm.business_id::TEXT = (storage.foldername(name))[1]
      )
    )
  );

COMMIT;
