-- Enable a shared, administrator-controlled Salon employee account for a shift.
BEGIN;

CREATE TABLE IF NOT EXISTS public.salon_access_control (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  access_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.salon_access_control (id, access_enabled)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.salon_access_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.salon_access_control FROM PUBLIC, anon, authenticated;

INSERT INTO public.employees (identification, full_name, is_active)
VALUES ('SALON-COMPARTIDO', 'Salón', true)
ON CONFLICT (identification) DO UPDATE
SET full_name = EXCLUDED.full_name,
    is_active = true;

CREATE OR REPLACE FUNCTION public.salon_access_is_enabled()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT access_enabled
    FROM public.salon_access_control
    WHERE id = true
  ), false);
$$;

REVOKE ALL ON FUNCTION public.salon_access_is_enabled() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_salon_access()
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'enabled', c.access_enabled,
    'employee', CASE WHEN c.access_enabled THEN (
      SELECT jsonb_build_object(
        'id', e.id,
        'identification', e.identification,
        'full_name', e.full_name
      )
      FROM public.employees e
      WHERE e.identification = 'SALON-COMPARTIDO'
        AND e.is_active = true
    ) ELSE NULL END
  )
  FROM public.salon_access_control c
  WHERE c.id = true;
$$;

CREATE OR REPLACE FUNCTION public.set_salon_access_enabled(p_enabled BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede habilitar o cerrar el acceso al salón.';
  END IF;

  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'El estado de acceso no es válido.';
  END IF;

  IF p_enabled THEN
    INSERT INTO public.employees (identification, full_name, is_active)
    VALUES ('SALON-COMPARTIDO', 'Salón', true)
    ON CONFLICT (identification) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        is_active = true;
  END IF;

  UPDATE public.salon_access_control
  SET access_enabled = p_enabled,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = true;

  UPDATE public.employee_sessions
  SET revoked_at = COALESCE(revoked_at, now())
  WHERE revoked_at IS NULL;

  IF p_enabled THEN
    SELECT jsonb_build_object(
      'id', e.id,
      'identification', e.identification,
      'full_name', e.full_name
    )
    INTO v_employee
    FROM public.employees e
    WHERE e.identification = 'SALON-COMPARTIDO'
      AND e.is_active = true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enabled', p_enabled,
    'employee', v_employee
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_reference_employee(
  p_identification TEXT,
  p_full_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee public.employees%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede registrar personal.';
  END IF;
  IF NULLIF(trim(p_identification), '') IS NULL OR length(trim(p_identification)) < 5 THEN
    RAISE EXCEPTION 'La cédula de referencia debe tener al menos cinco caracteres.';
  END IF;
  IF NULLIF(trim(p_full_name), '') IS NULL OR length(trim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'El nombre debe tener al menos dos caracteres.';
  END IF;

  INSERT INTO public.employees (identification, full_name)
  VALUES (trim(p_identification), trim(p_full_name))
  RETURNING * INTO v_employee;

  RETURN jsonb_build_object(
    'id', v_employee.id,
    'identification', v_employee.identification,
    'full_name', v_employee.full_name,
    'is_active', v_employee.is_active,
    'created_at', v_employee.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_salon_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_salon_access() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.set_salon_access_enabled(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_salon_access_enabled(BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.create_reference_employee(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_reference_employee(TEXT, TEXT) TO authenticated;

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
  IF NOT public.salon_access_is_enabled() THEN
    RAISE EXCEPTION 'El administrador todavía no ha habilitado el acceso al salón.';
  END IF;

  IF p_session_token IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.employee_sessions s
    JOIN public.employees e ON e.id = s.employee_id
    WHERE s.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND e.is_active = true
  ) THEN
    RAISE EXCEPTION 'El acceso al salón no es válido. Vuelve a ingresar.';
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
  v_topping_count INTEGER;
  v_unique_topping_count INTEGER;
  v_extra_topping_count INTEGER;
  v_size_extra NUMERIC(12,2);
BEGIN
  IF NOT public.salon_access_is_enabled() THEN
    RAISE EXCEPTION 'El administrador todavía no ha habilitado el acceso al salón.';
  END IF;

  IF p_session_token IS NULL THEN
    SELECT e.id INTO v_employee_id
    FROM public.employees e
    WHERE e.identification = 'SALON-COMPARTIDO'
      AND e.is_active = true;
  ELSE
    SELECT e.id INTO v_employee_id
    FROM public.employee_sessions s
    JOIN public.employees e ON e.id = s.employee_id
    WHERE s.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND e.is_active = true;
  END IF;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el usuario compartido del salón.';
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
  IF NOT public.salon_access_is_enabled() THEN
    RAISE EXCEPTION 'El administrador todavía no ha habilitado el acceso al salón.';
  END IF;

  IF p_session_token IS NULL THEN
    SELECT e.id INTO v_employee_id
    FROM public.employees e
    WHERE e.identification = 'SALON-COMPARTIDO'
      AND e.is_active = true;
  ELSE
    SELECT s.employee_id INTO v_employee_id
    FROM public.employee_sessions s
    JOIN public.employees e ON e.id = s.employee_id
    WHERE s.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND e.is_active = true;
  END IF;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el usuario compartido del salón.';
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
  IF NOT public.salon_access_is_enabled() THEN
    RAISE EXCEPTION 'El administrador todavía no ha habilitado el acceso al salón.';
  END IF;

  IF p_session_token IS NULL THEN
    SELECT e.id INTO v_employee_id
    FROM public.employees e
    WHERE e.identification = 'SALON-COMPARTIDO'
      AND e.is_active = true;
  ELSE
    SELECT s.employee_id INTO v_employee_id
    FROM public.employee_sessions s
    JOIN public.employees e ON e.id = s.employee_id
    WHERE s.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND e.is_active = true;
  END IF;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el usuario compartido del salón.';
  END IF;

  SELECT o.status
  INTO v_status
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.employee_id = v_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe o no pertenece al salón.';
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

REVOKE ALL ON FUNCTION public.get_employee_tables(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_tables(TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_employee_order(TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employee_order(TEXT, UUID, TEXT, JSONB) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_employee_orders(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_orders(TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_employee_order_delivered(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_employee_order_delivered(TEXT, UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.authenticate_employee(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

COMMIT;
