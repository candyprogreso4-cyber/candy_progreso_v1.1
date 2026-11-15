BEGIN;

CREATE OR REPLACE FUNCTION public.infer_row_business_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'employee_sessions' THEN
    SELECT e.business_id INTO STRICT NEW.business_id
    FROM public.employees e WHERE e.id = NEW.employee_id;
  ELSIF TG_TABLE_NAME = 'product_toppings' THEN
    SELECT COALESCE(NEW.business_id, p.business_id) INTO NEW.business_id
    FROM public.products p WHERE p.id = NEW.product_id;
  ELSIF TG_TABLE_NAME = 'orders' THEN
    IF NEW.table_id IS NOT NULL THEN
      SELECT COALESCE(NEW.business_id, t.business_id) INTO NEW.business_id
      FROM public.tables t WHERE t.id = NEW.table_id;
    END IF;
    IF NEW.business_id IS NULL AND NEW.employee_id IS NOT NULL THEN
      SELECT e.business_id INTO NEW.business_id
      FROM public.employees e WHERE e.id = NEW.employee_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'order_items' THEN
    SELECT COALESCE(NEW.business_id, o.business_id) INTO NEW.business_id
    FROM public.orders o WHERE o.id = NEW.order_id;
  ELSIF TG_TABLE_NAME = 'order_item_toppings' THEN
    SELECT COALESCE(NEW.business_id, o.business_id) INTO NEW.business_id
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = NEW.order_item_id;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    SELECT COALESCE(NEW.business_id, o.business_id) INTO NEW.business_id
    FROM public.orders o WHERE o.id = NEW.order_id;
  ELSIF TG_TABLE_NAME = 'cash_movements' THEN
    SELECT COALESCE(NEW.business_id, cr.business_id) INTO NEW.business_id
    FROM public.cash_registers cr WHERE cr.id = NEW.cash_register_id;
  ELSIF TG_TABLE_NAME IN ('inventory', 'inventory_movements') THEN
    SELECT COALESCE(NEW.business_id, p.business_id) INTO NEW.business_id
    FROM public.products p WHERE p.id = NEW.product_id;
  ELSIF TG_TABLE_NAME = 'audit_logs' THEN
    IF NEW.entity = 'orders' THEN
      SELECT COALESCE(NEW.business_id, o.business_id) INTO NEW.business_id
      FROM public.orders o WHERE o.id = NEW.entity_id;
    ELSIF NEW.entity = 'payments' THEN
      SELECT COALESCE(NEW.business_id, p.business_id) INTO NEW.business_id
      FROM public.payments p WHERE p.id = NEW.entity_id;
    ELSIF NEW.entity = 'cash_registers' THEN
      SELECT COALESCE(NEW.business_id, cr.business_id) INTO NEW.business_id
      FROM public.cash_registers cr WHERE cr.id = NEW.entity_id;
    END IF;
  END IF;

  IF NEW.business_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar el negocio del registro en %. Proporciona un business_id válido.', TG_TABLE_NAME;
  END IF;

  IF TG_TABLE_NAME = 'employees' THEN
    IF NEW.profile_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.business_memberships bm
      WHERE bm.business_id = NEW.business_id AND bm.user_id = NEW.profile_id
    ) THEN
      RAISE EXCEPTION 'El perfil del empleado no pertenece a este negocio.';
    END IF;
  ELSIF TG_TABLE_NAME = 'products' THEN
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = NEW.category_id AND c.business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'La categoría del producto no pertenece a este negocio.';
    END IF;
  ELSIF TG_TABLE_NAME = 'orders' THEN
    IF NEW.table_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tables t
      WHERE t.id = NEW.table_id AND t.business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'La mesa del pedido no pertenece a este negocio.';
    END IF;
    IF NEW.employee_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = NEW.employee_id AND e.business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'El empleado del pedido no pertenece a este negocio.';
    END IF;
  ELSIF TG_TABLE_NAME = 'product_toppings' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.toppings t
      WHERE t.id = NEW.topping_id AND t.business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'El topping asignado no pertenece a este negocio.';
    END IF;
  ELSIF TG_TABLE_NAME = 'order_items' THEN
    IF NEW.product_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = NEW.product_id AND p.business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'El producto del pedido no pertenece a este negocio.';
    END IF;
  ELSIF TG_TABLE_NAME = 'order_item_toppings' THEN
    IF NEW.topping_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.toppings t
      WHERE t.id = NEW.topping_id AND t.business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'El topping de la comanda no pertenece a este negocio.';
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    IF NEW.order_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = NEW.order_id AND o.business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'El pago y el pedido deben pertenecer al mismo negocio.';
    END IF;
  ELSIF TG_TABLE_NAME = 'employee_sessions' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = NEW.employee_id AND e.business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'La sesión del empleado no pertenece a este negocio.';
    END IF;
  ELSIF TG_TABLE_NAME = 'cash_movements' THEN
    IF NEW.cash_register_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.cash_registers cr
      WHERE cr.id = NEW.cash_register_id AND cr.business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'La caja del movimiento no pertenece a este negocio.';
    END IF;
  ELSIF TG_TABLE_NAME IN ('inventory', 'inventory_movements') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = NEW.product_id AND p.business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'El producto de inventario no pertenece a este negocio.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
