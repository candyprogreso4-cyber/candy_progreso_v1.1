BEGIN;

DO $$
DECLARE
  v_business_id UUID;
  v_table TEXT;
BEGIN
  SELECT id INTO v_business_id
  FROM public.businesses
  WHERE slug = 'candy-el-progreso';

  IF v_business_id IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'employees',
    'employee_sessions',
    'tables',
    'categories',
    'products',
    'toppings',
    'product_toppings',
    'orders',
    'order_items',
    'order_item_toppings',
    'payments',
    'cash_registers',
    'cash_movements',
    'inventory',
    'inventory_movements',
    'audit_logs',
    'supplier_expenses'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id DROP NOT NULL', v_table);
    EXECUTE format('UPDATE public.%I SET business_id = NULL WHERE business_id = $1', v_table)
      USING v_business_id;
  END LOOP;

  DELETE FROM public.businesses WHERE id = v_business_id;
END;
$$;

COMMIT;
