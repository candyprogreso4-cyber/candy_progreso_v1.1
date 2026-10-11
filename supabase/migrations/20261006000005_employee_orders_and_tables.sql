-- Serve employee tables and create orders only through a valid PIN session.
BEGIN;

INSERT INTO public.tables (table_number, status)
SELECT g.table_number, 'available'
FROM generate_series(1, 8) AS g(table_number)
ON CONFLICT (table_number) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_employee_tables(p_session_token TEXT)
RETURNS TABLE (
  id UUID,
  table_number INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF p_session_token IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.employee_sessions s
    JOIN public.employees e ON e.id = s.employee_id
    WHERE s.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND e.is_active = true
  ) THEN
    RAISE EXCEPTION 'La sesión de empleado expiró o fue revocada. Inicia sesión nuevamente.';
  END IF;

  RETURN QUERY
  SELECT t.id, t.table_number, t.status, t.created_at
  FROM public.tables t
  ORDER BY t.table_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_employee_order(
  p_session_token TEXT,
  p_table_id UUID,
  p_notes TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_employee_id UUID;
  v_order_id UUID;
  v_order_number BIGINT;
  v_total NUMERIC(12,2) := 0;
  v_item JSONB;
  v_product RECORD;
  v_topping RECORD;
  v_item_total NUMERIC(12,2);
  v_quantity INTEGER;
  v_order_item_id UUID;
  v_topping_id UUID;
BEGIN
  SELECT e.id
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

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;

  IF p_table_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tables WHERE id = p_table_id
  ) THEN
    RAISE EXCEPTION 'La mesa seleccionada no existe. Recarga las mesas e inténtalo de nuevo.';
  END IF;

  INSERT INTO public.orders (table_id, employee_id, status, payment_status, subtotal, total, notes)
  VALUES (p_table_id, v_employee_id, 'pending', 'pending', 0, 0, NULLIF(trim(COALESCE(p_notes, '')), ''))
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::UUID
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Uno de los productos ya no existe o está inactivo.';
    END IF;

    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
    IF v_quantity < 1 THEN
      RAISE EXCEPTION 'La cantidad de cada producto debe ser mayor a cero.';
    END IF;

    v_item_total := v_product.base_price;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, quantity, unit_price, subtotal, size, flavor, notes
    )
    VALUES (
      v_order_id, v_product.id, v_product.name, v_quantity, v_product.base_price,
      v_product.base_price * v_quantity, v_item->>'size', v_item->>'flavor', v_item->>'notes'
    )
    RETURNING id INTO v_order_item_id;

    IF jsonb_typeof(COALESCE(v_item->'topping_ids', '[]'::jsonb)) <> 'array' THEN
      RAISE EXCEPTION 'La lista de toppings del producto no es válida.';
    END IF;

    FOR v_topping_id IN
      SELECT value::UUID
      FROM jsonb_array_elements_text(COALESCE(v_item->'topping_ids', '[]'::jsonb))
    LOOP
      SELECT t.id, t.name, t.price
      INTO v_topping
      FROM public.toppings t
      WHERE t.id = v_topping_id
        AND t.is_active = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Uno de los toppings seleccionados ya no está disponible.';
      END IF;

      INSERT INTO public.order_item_toppings (order_item_id, topping_id, topping_name, price)
      VALUES (v_order_item_id, v_topping.id, v_topping.name, v_topping.price);
      v_item_total := v_item_total + v_topping.price;
    END LOOP;

    UPDATE public.order_items
    SET unit_price = v_item_total,
        subtotal = v_item_total * v_quantity
    WHERE id = v_order_item_id;

    v_total := v_total + v_item_total * v_quantity;
  END LOOP;

  UPDATE public.orders
  SET subtotal = v_total,
      total = v_total,
      updated_at = now()
  WHERE id = v_order_id;

  IF p_table_id IS NOT NULL THEN
    UPDATE public.tables SET status = 'occupied' WHERE id = p_table_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    NULL,
    'create_order',
    'orders',
    v_order_id,
    jsonb_build_object('table_id', p_table_id, 'employee_id', v_employee_id)
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_tables(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_employee_order(TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_tables(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_employee_order(TEXT, UUID, TEXT, JSONB) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_order(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

COMMIT;
