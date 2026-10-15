BEGIN;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cancelar comandas.';
  END IF;

  SELECT o.id, o.order_number, o.table_id, o.status, o.payment_status
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La comanda no existe.';
  END IF;
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'La comanda ya está cancelada.';
  END IF;
  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'No se puede cancelar una comanda que ya fue pagada.';
  END IF;
  IF v_order.payment_status <> 'pending'
    OR v_order.status NOT IN ('pending', 'preparing', 'ready', 'delivered') THEN
    RAISE EXCEPTION 'Solo se pueden cancelar comandas activas pendientes de pago.';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      payment_status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  WHERE id = v_order.id;

  IF v_order.table_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.table_id = v_order.table_id
        AND o.id <> v_order.id
        AND o.payment_status = 'pending'
        AND o.status NOT IN ('cancelled', 'completed')
    ) THEN
    UPDATE public.tables
    SET status = 'available'
    WHERE id = v_order.table_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    auth.uid(),
    'CANCEL_ORDER',
    'orders',
    v_order.id,
    jsonb_build_object(
      'order_number', v_order.order_number,
      'previous_status', v_order.status,
      'previous_payment_status', v_order.payment_status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', 'cancelled'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID) TO authenticated;

COMMIT;
