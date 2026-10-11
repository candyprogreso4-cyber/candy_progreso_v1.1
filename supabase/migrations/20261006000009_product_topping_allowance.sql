-- Configure free topping allowances and per-item surcharge on each product.
BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_toppings BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_free_toppings INTEGER NOT NULL DEFAULT 0
    CHECK (max_free_toppings >= 0),
  ADD COLUMN IF NOT EXISTS extra_topping_price NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (extra_topping_price >= 0);

UPDATE public.products p
SET has_toppings = true
WHERE EXISTS (
  SELECT 1
  FROM public.product_toppings pt
  WHERE pt.product_id = p.id
);

UPDATE public.toppings
SET price = 0
WHERE price <> 0;

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
  v_topping_count INTEGER;
  v_unique_topping_count INTEGER;
  v_extra_topping_count INTEGER;
  v_size_extra NUMERIC(12,2);
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
    SELECT *
    INTO v_product
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

    IF v_item->>'size' IS NULL OR v_item->>'size' = '8 oz' THEN
      v_size_extra := 0;
    ELSIF v_item->>'size' = '6 oz' THEN
      v_size_extra := -2000;
    ELSIF v_item->>'size' = '12 oz' THEN
      v_size_extra := 3000;
    ELSE
      RAISE EXCEPTION 'El tamaño seleccionado no es válido.';
    END IF;

    IF jsonb_typeof(COALESCE(v_item->'topping_ids', '[]'::jsonb)) <> 'array' THEN
      RAISE EXCEPTION 'La lista de toppings del producto no es válida.';
    END IF;

    SELECT count(*)::INTEGER, count(DISTINCT topping_id)::INTEGER
    INTO v_topping_count, v_unique_topping_count
    FROM jsonb_array_elements_text(COALESCE(v_item->'topping_ids', '[]'::jsonb)) AS selected(topping_id);

    IF v_topping_count <> v_unique_topping_count THEN
      RAISE EXCEPTION 'No se puede seleccionar el mismo topping más de una vez.';
    END IF;
    IF v_topping_count > 0 AND NOT v_product.has_toppings THEN
      RAISE EXCEPTION 'Este producto no permite toppings.';
    END IF;

    v_extra_topping_count := GREATEST(0, v_topping_count - v_product.max_free_toppings);
    v_item_total := GREATEST(0, v_product.base_price + v_size_extra)
      + v_extra_topping_count * v_product.extra_topping_price;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, quantity, unit_price, subtotal, size, flavor, notes
    )
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_item_total,
      v_item_total * v_quantity,
      v_item->>'size',
      v_item->>'flavor',
      v_item->>'notes'
    )
    RETURNING id INTO v_order_item_id;

    FOR v_topping_id IN
      SELECT value::UUID
      FROM jsonb_array_elements_text(COALESCE(v_item->'topping_ids', '[]'::jsonb))
    LOOP
      SELECT t.id, t.name
      INTO v_topping
      FROM public.toppings t
      JOIN public.product_toppings pt
        ON pt.topping_id = t.id
       AND pt.product_id = v_product.id
      WHERE t.id = v_topping_id
        AND t.is_active = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Uno de los toppings no está disponible para este producto.';
      END IF;

      INSERT INTO public.order_item_toppings (order_item_id, topping_id, topping_name, price)
      VALUES (v_order_item_id, v_topping.id, v_topping.name, 0);
    END LOOP;

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

REVOKE ALL ON FUNCTION public.create_employee_order(TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employee_order(TEXT, UUID, TEXT, JSONB) TO anon, authenticated;

COMMIT;
