BEGIN;

CREATE OR REPLACE FUNCTION public.update_platform_business(
  p_business_id UUID,
  p_name TEXT,
  p_slug TEXT,
  p_business_type TEXT
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
    RAISE EXCEPTION 'Solo el administrador de plataforma puede modificar negocios.';
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

  UPDATE public.businesses
  SET name = trim(p_name),
      slug = lower(trim(p_slug)),
      business_type = trim(p_business_type),
      updated_at = now()
  WHERE id = p_business_id
  RETURNING * INTO v_business;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el negocio.';
  END IF;

  INSERT INTO public.audit_logs (business_id, user_id, action, entity, entity_id, metadata)
  VALUES (
    v_business.id,
    auth.uid(),
    'update_business',
    'businesses',
    v_business.id,
    jsonb_build_object(
      'name', v_business.name,
      'slug', v_business.slug,
      'business_type', v_business.business_type
    )
  );

  RETURN jsonb_build_object(
    'id', v_business.id,
    'name', v_business.name,
    'slug', v_business.slug,
    'business_type', v_business.business_type,
    'is_active', v_business.is_active
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_platform_business(
  p_business_id UUID,
  p_confirmation_slug TEXT
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
    RAISE EXCEPTION 'Solo el administrador de plataforma puede eliminar negocios.';
  END IF;
  IF p_business_id IS NULL OR p_confirmation_slug IS NULL THEN
    RAISE EXCEPTION 'El negocio y su identificador de confirmación son obligatorios.';
  END IF;

  SELECT * INTO v_business
  FROM public.businesses
  WHERE id = p_business_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el negocio.';
  END IF;
  IF p_confirmation_slug <> v_business.slug THEN
    RAISE EXCEPTION 'El identificador de confirmación no coincide.';
  END IF;

  DELETE FROM public.audit_logs WHERE business_id = v_business.id;
  DELETE FROM public.supplier_expenses WHERE business_id = v_business.id;
  DELETE FROM public.order_item_toppings WHERE business_id = v_business.id;
  DELETE FROM public.payments WHERE business_id = v_business.id;
  DELETE FROM public.order_items WHERE business_id = v_business.id;
  DELETE FROM public.orders WHERE business_id = v_business.id;
  DELETE FROM public.inventory_movements WHERE business_id = v_business.id;
  DELETE FROM public.inventory WHERE business_id = v_business.id;
  DELETE FROM public.employee_sessions WHERE business_id = v_business.id;
  DELETE FROM public.cash_movements WHERE business_id = v_business.id;
  DELETE FROM public.product_toppings WHERE business_id = v_business.id;
  DELETE FROM public.employees WHERE business_id = v_business.id;
  DELETE FROM public.products WHERE business_id = v_business.id;
  DELETE FROM public.toppings WHERE business_id = v_business.id;
  DELETE FROM public.categories WHERE business_id = v_business.id;
  DELETE FROM public.tables WHERE business_id = v_business.id;
  DELETE FROM public.cash_registers WHERE business_id = v_business.id;
  DELETE FROM public.businesses WHERE id = v_business.id;

  RETURN jsonb_build_object('id', v_business.id, 'deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_platform_business(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_platform_business(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_business(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_platform_business(UUID, TEXT) TO authenticated;

DROP POLICY IF EXISTS "Platform admins delete business storage" ON storage.objects;
CREATE POLICY "Platform admins delete business storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('product-images', 'business-branding')
    AND public.is_platform_admin()
  );

COMMIT;
