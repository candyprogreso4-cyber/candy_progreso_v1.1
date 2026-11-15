BEGIN;

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

  SELECT u.id,
         COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1))
  INTO v_owner_id, v_owner_name
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_owner_email))
    AND u.email_confirmed_at IS NOT NULL;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'El correo del administrador debe existir y estar confirmado en Supabase Auth.';
  END IF;

  INSERT INTO public.businesses (name, slug, business_type)
  VALUES (trim(p_name), lower(trim(p_slug)), trim(p_business_type))
  RETURNING * INTO v_business;

  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (v_owner_id, v_owner_name, 'admin', true)
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        is_active = true,
        updated_at = now();

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

CREATE OR REPLACE FUNCTION public.business_mark_order_ready(p_business_id UUID, p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_business_admin(p_business_id) THEN
    RAISE EXCEPTION 'No tienes permisos para gestionar pedidos de este negocio.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'El pedido no existe en este negocio.';
  END IF;
  RETURN public.mark_order_ready(p_order_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.business_mark_order_completed(p_business_id UUID, p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_business_admin(p_business_id) THEN
    RAISE EXCEPTION 'No tienes permisos para gestionar pedidos de este negocio.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'El pedido no existe en este negocio.';
  END IF;
  RETURN public.mark_order_completed(p_order_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.business_cancel_order(p_business_id UUID, p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_business_admin(p_business_id) THEN
    RAISE EXCEPTION 'No tienes permisos para cancelar pedidos de este negocio.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'El pedido no existe en este negocio.';
  END IF;
  RETURN public.cancel_order(p_order_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.business_register_order_payment(
  p_business_id UUID,
  p_order_id UUID,
  p_method TEXT,
  p_received NUMERIC DEFAULT 0,
  p_change NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_business_admin(p_business_id) THEN
    RAISE EXCEPTION 'No tienes permisos para registrar pagos de este negocio.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = p_order_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'El pedido no existe en este negocio.';
  END IF;
  RETURN public.register_order_payment(p_order_id, p_method, p_received, p_change);
END;
$$;

CREATE OR REPLACE FUNCTION public.business_open_cash_register(p_business_id UUID, p_opening_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_register_id UUID;
BEGIN
  IF NOT public.is_business_admin(p_business_id) THEN
    RAISE EXCEPTION 'No tienes permisos para abrir la caja de este negocio.';
  END IF;
  IF p_opening_amount IS NULL OR p_opening_amount < 0 THEN
    RAISE EXCEPTION 'El valor de apertura no es válido.';
  END IF;

  SELECT id INTO v_register_id
  FROM public.cash_registers
  WHERE business_id = p_business_id AND status = 'open'
  ORDER BY opened_at DESC
  LIMIT 1;
  IF v_register_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'register_id', v_register_id, 'message', 'Ya hay una caja abierta.');
  END IF;

  INSERT INTO public.cash_registers (business_id, opened_by, opening_amount, status)
  VALUES (p_business_id, auth.uid(), p_opening_amount, 'open')
  RETURNING id INTO v_register_id;

  INSERT INTO public.cash_movements (business_id, cash_register_id, amount, type, description, created_by)
  VALUES (p_business_id, v_register_id, p_opening_amount, 'income', 'Base inicial de caja', auth.uid());
  INSERT INTO public.audit_logs (business_id, user_id, action, entity, entity_id, metadata)
  VALUES (p_business_id, auth.uid(), 'OPEN_CASH', 'cash_registers', v_register_id,
          jsonb_build_object('amount', p_opening_amount));

  RETURN jsonb_build_object('success', true, 'register_id', v_register_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.business_close_cash_register(
  p_business_id UUID,
  p_register_id UUID,
  p_closing_amount NUMERIC,
  p_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_register public.cash_registers%ROWTYPE;
  v_income NUMERIC(12,2);
  v_expenses NUMERIC(12,2);
  v_expected NUMERIC(12,2);
  v_difference NUMERIC(12,2);
  v_pending_count INTEGER;
BEGIN
  IF NOT public.is_business_admin(p_business_id) THEN
    RAISE EXCEPTION 'No tienes permisos para cerrar la caja de este negocio.';
  END IF;
  IF p_closing_amount IS NULL OR p_closing_amount < 0 THEN
    RAISE EXCEPTION 'El valor del cierre no es válido.';
  END IF;

  SELECT * INTO v_register
  FROM public.cash_registers
  WHERE id = p_register_id
    AND business_id = p_business_id
    AND status = 'open'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La caja no existe en este negocio o ya está cerrada.';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_income
  FROM public.cash_movements
  WHERE business_id = p_business_id AND cash_register_id = p_register_id AND type = 'income';
  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.cash_movements
  WHERE business_id = p_business_id AND cash_register_id = p_register_id AND type = 'expense';
  v_expected := v_income - v_expenses;
  v_difference := p_closing_amount - v_expected;

  SELECT count(*)::INTEGER INTO v_pending_count
  FROM public.orders
  WHERE business_id = p_business_id
    AND status = 'completed'
    AND payment_status = 'pending';

  UPDATE public.cash_registers
  SET closed_by = auth.uid(),
      closed_at = now(),
      closing_amount = p_closing_amount,
      expected_amount = v_expected,
      difference = v_difference,
      status = 'closed'
  WHERE id = p_register_id AND business_id = p_business_id;

  UPDATE public.business_salon_access
  SET access_enabled = false, updated_at = now(), updated_by = auth.uid()
  WHERE business_id = p_business_id;
  UPDATE public.employee_sessions
  SET revoked_at = COALESCE(revoked_at, now())
  WHERE business_id = p_business_id AND revoked_at IS NULL;

  INSERT INTO public.audit_logs (business_id, user_id, action, entity, entity_id, metadata)
  VALUES (
    p_business_id,
    auth.uid(),
    'CLOSE_CASH',
    'cash_registers',
    p_register_id,
    jsonb_build_object(
      'closing_amount', p_closing_amount,
      'expected_amount', v_expected,
      'difference', v_difference,
      'pending_orders', v_pending_count,
      'notes', p_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'register_id', p_register_id,
    'expected_amount', v_expected,
    'closing_amount', p_closing_amount,
    'difference', v_difference,
    'pending_orders_warning', v_pending_count
  );
END;
$$;

-- Keep the legacy payment RPC scoped internally; tenant wrappers validate order ownership.
DROP FUNCTION IF EXISTS public.register_order_payment(UUID, TEXT, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION public.register_order_payment(
  p_order_id UUID,
  p_method TEXT,
  p_received NUMERIC DEFAULT 0,
  p_change NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_payment_id UUID;
  v_open_register RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede registrar pagos.';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no fue encontrado.';
  END IF;
  IF v_order.payment_status = 'paid' OR v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'El pedido no está disponible para pago.';
  END IF;
  IF p_method NOT IN ('cash', 'nequi', 'daviplata', 'transfer', 'other') THEN
    RAISE EXCEPTION 'El método de pago no es válido.';
  END IF;
  IF p_method = 'cash' AND p_received < v_order.total THEN
    RAISE EXCEPTION 'El efectivo recibido no puede ser menor al total.';
  END IF;

  INSERT INTO public.payments (order_id, amount, payment_method, received_amount, change_amount, registered_by)
  VALUES (p_order_id, v_order.total, p_method, p_received, p_change, auth.uid())
  RETURNING id INTO v_payment_id;

  UPDATE public.orders
  SET payment_status = 'paid', updated_at = now()
  WHERE id = p_order_id;

  IF v_order.table_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE business_id = v_order.business_id
      AND table_id = v_order.table_id
      AND id <> p_order_id
      AND payment_status = 'pending'
      AND status NOT IN ('cancelled', 'completed')
  ) THEN
    UPDATE public.tables
    SET status = 'available'
    WHERE id = v_order.table_id
      AND business_id = v_order.business_id;
  END IF;

  IF p_method = 'cash' THEN
    SELECT * INTO v_open_register
    FROM public.cash_registers
    WHERE business_id = v_order.business_id AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.cash_movements (
        business_id, cash_register_id, amount, type, description, created_by
      )
      VALUES (
        v_order.business_id, v_open_register.id, v_order.total, 'income',
        'Cobro Pedido #' || v_order.order_number, auth.uid()
      );
    END IF;
  END IF;

  INSERT INTO public.audit_logs (business_id, user_id, action, entity, entity_id, metadata)
  VALUES (
    v_order.business_id,
    auth.uid(),
    'REGISTER_PAYMENT',
    'payments',
    v_payment_id,
    jsonb_build_object(
      'order_id', p_order_id,
      'order_number', v_order.order_number,
      'amount', v_order.total,
      'method', p_method
    )
  );
  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'order_id', p_order_id,
    'status', 'paid',
    'amount', v_order.total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_business(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_mark_order_ready(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_mark_order_completed(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_cancel_order(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_register_order_payment(UUID, UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_open_cash_register(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_close_cash_register(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_business(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_mark_order_ready(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_mark_order_completed(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_cancel_order(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_register_order_payment(UUID, UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_open_cash_register(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_close_cash_register(UUID, UUID, NUMERIC, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_order_ready(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_order_completed(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_order(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_order_payment(UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_cash_register(NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_cash_register(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Admins upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Business admins upload product images" ON storage.objects;
CREATE POLICY "Business admins upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
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
REVOKE ALL ON FUNCTION public.authenticate_employee(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_employee_pin(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_employee_with_pin(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_employee_persistent_session(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_employee_orders(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_employee_order_delivered(TEXT, UUID) TO anon, authenticated;

COMMIT;
