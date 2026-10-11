-- Keep employee order access scoped to the validated PIN session.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_employee_orders(p_session_token TEXT)
RETURNS TABLE (
  id UUID,
  order_number BIGINT,
  table_id UUID,
  employee_id UUID,
  status TEXT,
  payment_status TEXT,
  subtotal NUMERIC(12,2),
  discount NUMERIC(12,2),
  total NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  table_info JSONB,
  employee_info JSONB,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_employee_id UUID;
BEGIN
  SELECT s.employee_id
  INTO v_employee_id
  FROM public.employee_sessions s
  JOIN public.employees e ON e.id = s.employee_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session_token, ''), 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND e.is_active = true;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'La sesión de empleado expiró o fue revocada. Inicia sesión nuevamente.';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.table_id,
    o.employee_id,
    o.status,
    o.payment_status,
    o.subtotal,
    o.discount,
    o.total,
    o.notes,
    o.created_at,
    o.updated_at,
    o.completed_at,
    o.delivered_at,
    o.cancelled_at,
    CASE
      WHEN t.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', t.id,
        'table_number', t.table_number,
        'status', t.status,
        'created_at', t.created_at
      )
    END,
    jsonb_build_object('id', e.id, 'full_name', e.full_name),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'order_id', oi.order_id,
          'product_id', oi.product_id,
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'subtotal', oi.subtotal,
          'size', oi.size,
          'flavor', oi.flavor,
          'notes', oi.notes,
          'created_at', oi.created_at,
          'toppings', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', oit.id,
              'order_item_id', oit.order_item_id,
              'topping_id', oit.topping_id,
              'topping_name', oit.topping_name,
              'price', oit.price
            ))
            FROM public.order_item_toppings oit
            WHERE oit.order_item_id = oi.id
          ), '[]'::jsonb)
        )
        ORDER BY oi.created_at
      )
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  FROM public.orders o
  LEFT JOIN public.tables t ON t.id = o.table_id
  JOIN public.employees e ON e.id = o.employee_id
  WHERE o.employee_id = v_employee_id
    AND o.status <> 'cancelled'
  ORDER BY o.created_at DESC
  LIMIT 25;
END;
$$;

DROP FUNCTION IF EXISTS public.mark_order_ready(UUID);

CREATE FUNCTION public.mark_order_ready(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede marcar pedidos como listos.';
  END IF;

  SELECT o.status
  INTO v_status
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe.';
  END IF;
  IF v_status NOT IN ('pending', 'preparing') THEN
    RAISE EXCEPTION 'Solo se pueden marcar como listos los pedidos pendientes o en preparación.';
  END IF;

  UPDATE public.orders
  SET status = 'ready',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', 'ready');
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_employee_order_delivered(
  p_session_token TEXT,
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_employee_id UUID;
  v_status TEXT;
BEGIN
  SELECT s.employee_id
  INTO v_employee_id
  FROM public.employee_sessions s
  JOIN public.employees e ON e.id = s.employee_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session_token, ''), 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND e.is_active = true;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'La sesión de empleado expiró o fue revocada. Inicia sesión nuevamente.';
  END IF;

  SELECT o.status
  INTO v_status
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.employee_id = v_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe o no pertenece a este empleado.';
  END IF;
  IF v_status <> 'ready' THEN
    RAISE EXCEPTION 'El pedido debe estar listo antes de marcarlo como entregado.';
  END IF;

  UPDATE public.orders
  SET status = 'delivered',
      delivered_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', 'delivered');
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_order_completed(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede finalizar pedidos.';
  END IF;

  SELECT o.id, o.order_number, o.status
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe.';
  END IF;
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'No se puede finalizar un pedido cancelado.';
  END IF;
  IF v_order.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', 'completed');
  END IF;

  UPDATE public.orders
  SET status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    auth.uid(),
    'COMPLETE_ORDER',
    'orders',
    p_order_id,
    jsonb_build_object('order_number', v_order.order_number)
  );

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', 'completed');
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_orders(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_order_ready(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_employee_order_delivered(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_order_completed(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_orders(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_ready(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_employee_order_delivered(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_completed(UUID) TO authenticated;

COMMIT;
