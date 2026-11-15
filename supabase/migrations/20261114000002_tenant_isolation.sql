BEGIN;

-- Legacy rows remain unassigned (business_id IS NULL) until explicitly migrated.
DO $$
DECLARE
  v_table TEXT;
BEGIN
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
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id)',
      v_table
    );
  END LOOP;
END;
$$;

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
  ELSIF TG_TABLE_NAME = 'inventory' OR TG_TABLE_NAME = 'inventory_movements' THEN
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

DO $$
DECLARE
  v_table TEXT;
BEGIN
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
    EXECUTE format('DROP TRIGGER IF EXISTS infer_row_business_id ON public.%I', v_table);
    EXECUTE format(
      'CREATE TRIGGER infer_row_business_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.infer_row_business_id()',
      v_table
    );
  END LOOP;
END;
$$;

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_identification_key;
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_business_identification_key;
DROP INDEX IF EXISTS public.employees_business_identification_key;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_business_identification_key UNIQUE (business_id, identification);
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_table_number_key;
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_business_table_number_key;
DROP INDEX IF EXISTS public.tables_business_table_number_key;
ALTER TABLE public.tables
  ADD CONSTRAINT tables_business_table_number_key UNIQUE (business_id, table_number);
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_business_name_key;
DROP INDEX IF EXISTS public.categories_business_name_key;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_business_name_key UNIQUE (business_id, name);
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_name_key;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_business_name_key;
DROP INDEX IF EXISTS public.products_business_name_key;
ALTER TABLE public.products
  ADD CONSTRAINT products_business_name_key UNIQUE (business_id, name);
ALTER TABLE public.toppings DROP CONSTRAINT IF EXISTS toppings_name_key;
ALTER TABLE public.toppings DROP CONSTRAINT IF EXISTS toppings_business_name_key;
DROP INDEX IF EXISTS public.toppings_business_name_key;
ALTER TABLE public.toppings
  ADD CONSTRAINT toppings_business_name_key UNIQUE (business_id, name);
DROP INDEX IF EXISTS public.idx_categories_active_normalized_name;
CREATE UNIQUE INDEX idx_categories_active_normalized_name
  ON public.categories (
    business_id,
    lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
  )
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_employees_business_active
  ON public.employees (business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_business_status_created
  ON public.orders (business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_business_active
  ON public.products (business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_business_order
  ON public.categories (business_id, is_active, sort_order);

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
    JOIN public.profiles p ON p.id = pa.user_id
    WHERE pa.user_id = (SELECT auth.uid())
      AND p.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_business_access(p_business_id UUID)
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
      JOIN public.profiles p ON p.id = bm.user_id
      WHERE bm.business_id = p_business_id
        AND bm.user_id = (SELECT auth.uid())
        AND p.is_active = true
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
      JOIN public.profiles p ON p.id = bm.user_id
      WHERE bm.business_id = p_business_id
        AND bm.user_id = (SELECT auth.uid())
        AND bm.role IN ('owner', 'admin')
        AND p.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
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
      JOIN public.profiles p ON p.id = bm.user_id
      WHERE bm.user_id = (SELECT auth.uid())
        AND bm.role IN ('owner', 'admin')
        AND p.is_active = true
    );
$$;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'employees',
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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, PUBLIC', v_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', v_table);
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_policy TEXT;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', v_policy);
  END LOOP;
END;
$$;

CREATE POLICY profiles_select_own_or_business_admin
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.business_memberships bm ON bm.business_id = e.business_id
      WHERE e.profile_id = profiles.id
        AND bm.user_id = (SELECT auth.uid())
        AND bm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "profiles_update_admin_only" ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.business_salon_access (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  access_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.business_salon_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_salon_access FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_business_membership_for_profile ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_business_membership_for_profile();

CREATE OR REPLACE FUNCTION public.get_business_categories(p_slug TEXT)
RETURNS SETOF public.categories
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.*
  FROM public.categories c
  JOIN public.businesses b ON b.id = c.business_id
  WHERE b.slug = lower(trim(p_slug))
    AND b.is_active = true
    AND c.is_active = true
  ORDER BY c.sort_order, c.name;
$$;

CREATE OR REPLACE FUNCTION public.get_business_products(p_slug TEXT)
RETURNS SETOF JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'business_id', p.business_id,
    'category_id', p.category_id,
    'name', p.name,
    'description', p.description,
    'image_url', p.image_url,
    'base_price', p.base_price,
    'flavors', p.flavors,
    'has_sizes', p.has_sizes,
    'sizes', p.sizes,
    'has_toppings', p.has_toppings,
    'max_free_toppings', p.max_free_toppings,
    'extra_topping_price', p.extra_topping_price,
    'is_active', p.is_active,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'category', (
      SELECT to_jsonb(c)
      FROM public.categories c
      WHERE c.id = p.category_id
    ),
    'product_toppings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('topping', to_jsonb(t)))
      FROM public.product_toppings pt
      JOIN public.toppings t ON t.id = pt.topping_id
      WHERE pt.product_id = p.id
        AND t.is_active = true
    ), '[]'::jsonb)
  )
  FROM public.products p
  JOIN public.businesses b ON b.id = p.business_id
  WHERE b.slug = lower(trim(p_slug))
    AND b.is_active = true
    AND p.is_active = true
  ORDER BY p.name;
$$;

CREATE OR REPLACE FUNCTION public.get_business_toppings(p_slug TEXT)
RETURNS SETOF public.toppings
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.*
  FROM public.toppings t
  JOIN public.businesses b ON b.id = t.business_id
  WHERE b.slug = lower(trim(p_slug))
    AND b.is_active = true
    AND t.is_active = true
  ORDER BY t.price, t.name;
$$;

CREATE OR REPLACE FUNCTION public.create_business_reference_employee(
  p_business_id UUID,
  p_identification TEXT,
  p_full_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_employee public.employees%ROWTYPE;
BEGIN
  IF NOT public.is_business_admin(p_business_id) THEN
    RAISE EXCEPTION 'No tienes permisos para registrar personal en este negocio.';
  END IF;
  IF NULLIF(trim(p_identification), '') IS NULL OR length(trim(p_identification)) < 5
     OR NULLIF(trim(p_full_name), '') IS NULL OR length(trim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'Ingresa una identificación y un nombre válidos.';
  END IF;

  INSERT INTO public.employees (business_id, identification, full_name)
  VALUES (p_business_id, trim(p_identification), trim(p_full_name))
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

CREATE OR REPLACE FUNCTION public.set_business_salon_access(p_slug TEXT, p_enabled BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id UUID;
  v_employee_id UUID;
  v_token TEXT;
BEGIN
  SELECT id INTO v_business_id
  FROM public.businesses
  WHERE slug = lower(trim(p_slug))
    AND is_active = true;
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'El negocio no existe o está inactivo.';
  END IF;
  IF NOT public.is_business_admin(v_business_id) THEN
    RAISE EXCEPTION 'Solo un administrador de este negocio puede gestionar el acceso del salón.';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'El estado del acceso no es válido.';
  END IF;

  INSERT INTO public.business_salon_access (business_id, access_enabled, updated_at, updated_by)
  VALUES (v_business_id, p_enabled, now(), auth.uid())
  ON CONFLICT (business_id) DO UPDATE
  SET access_enabled = EXCLUDED.access_enabled,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by;

  SELECT id INTO v_employee_id
  FROM public.employees
  WHERE business_id = v_business_id
    AND identification = 'SALON-COMPARTIDO';

  IF p_enabled THEN
    INSERT INTO public.employees (business_id, identification, full_name, is_active)
    VALUES (v_business_id, 'SALON-COMPARTIDO', 'Salón', true)
    ON CONFLICT (business_id, identification) DO UPDATE
      SET is_active = true
    RETURNING id INTO v_employee_id;
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    INSERT INTO public.employee_sessions (business_id, employee_id, token_hash, expires_at)
    VALUES (
      v_business_id,
      v_employee_id,
      encode(extensions.digest(v_token, 'sha256'), 'hex'),
      now() + interval '12 hours'
    );
  ELSE
    UPDATE public.employees
    SET is_active = false
    WHERE business_id = v_business_id
      AND identification = 'SALON-COMPARTIDO';
    UPDATE public.employee_sessions
    SET revoked_at = COALESCE(revoked_at, now())
    WHERE business_id = v_business_id
      AND employee_id = v_employee_id
      AND revoked_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enabled', p_enabled,
    'employee', CASE WHEN p_enabled THEN
      jsonb_build_object('id', v_employee_id, 'identification', 'SALON-COMPARTIDO', 'full_name', 'Salón')
      ELSE NULL END,
    'session_token', v_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_business_salon_access(p_slug TEXT, p_session_token TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id UUID;
  v_enabled BOOLEAN;
  v_employee_id UUID;
  v_token TEXT;
BEGIN
  SELECT b.id, COALESCE(sa.access_enabled, false)
  INTO v_business_id, v_enabled
  FROM public.businesses b
  LEFT JOIN public.business_salon_access sa ON sa.business_id = b.id
  WHERE b.slug = lower(trim(p_slug))
    AND b.is_active = true;
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'El negocio no existe o está inactivo.';
  END IF;
  IF NOT v_enabled THEN
    RETURN jsonb_build_object('enabled', false, 'employee', NULL, 'session_token', NULL);
  END IF;

  SELECT e.id INTO v_employee_id
  FROM public.employees e
  WHERE e.business_id = v_business_id
    AND e.identification = 'SALON-COMPARTIDO'
    AND e.is_active = true;
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No se configuró el usuario compartido de este negocio.';
  END IF;

  IF p_session_token IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.employee_sessions s
    WHERE s.employee_id = v_employee_id
      AND s.business_id = v_business_id
      AND s.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
  ) THEN
    v_token := p_session_token;
  ELSE
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    INSERT INTO public.employee_sessions (business_id, employee_id, token_hash, expires_at)
    VALUES (
      v_business_id,
      v_employee_id,
      encode(extensions.digest(v_token, 'sha256'), 'hex'),
      now() + interval '12 hours'
    );
  END IF;

  RETURN jsonb_build_object(
    'enabled', true,
    'employee', jsonb_build_object('id', v_employee_id, 'identification', 'SALON-COMPARTIDO', 'full_name', 'Salón'),
    'session_token', v_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_business_employee_tables(p_slug TEXT, p_session_token TEXT)
RETURNS SETOF public.tables
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  SELECT b.id INTO v_business_id
  FROM public.businesses b
  JOIN public.business_salon_access sa ON sa.business_id = b.id AND sa.access_enabled
  WHERE b.slug = lower(trim(p_slug))
    AND b.is_active;
  IF v_business_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.employee_sessions s
    JOIN public.employees e ON e.id = s.employee_id
    WHERE s.business_id = v_business_id
      AND s.token_hash = encode(extensions.digest(COALESCE(p_session_token, ''), 'sha256'), 'hex')
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND e.business_id = v_business_id
      AND e.is_active
  ) THEN
    RAISE EXCEPTION 'El acceso a este negocio no es válido o está cerrado.';
  END IF;

  RETURN QUERY
  SELECT t.* FROM public.tables t
  WHERE t.business_id = v_business_id
  ORDER BY t.table_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_business_employee_order(
  p_slug TEXT,
  p_session_token TEXT,
  p_table_id UUID,
  p_notes TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  SELECT b.id INTO v_business_id
  FROM public.businesses b
  JOIN public.business_salon_access sa ON sa.business_id = b.id AND sa.access_enabled
  WHERE b.slug = lower(trim(p_slug))
    AND b.is_active;
  IF v_business_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.employee_sessions s
    JOIN public.employees e ON e.id = s.employee_id
    WHERE s.business_id = v_business_id
      AND s.token_hash = encode(extensions.digest(COALESCE(p_session_token, ''), 'sha256'), 'hex')
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND e.business_id = v_business_id
      AND e.is_active
  ) THEN
    RAISE EXCEPTION 'El acceso a este negocio no es válido o está cerrado.';
  END IF;
  IF p_table_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tables
    WHERE id = p_table_id AND business_id = v_business_id
  ) THEN
    RAISE EXCEPTION 'La mesa seleccionada no pertenece a este negocio.';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) item
    LEFT JOIN public.products p
      ON p.id = (item->>'product_id')::UUID
      AND p.business_id = v_business_id
      AND p.is_active
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Todos los productos deben estar activos y pertenecer a este negocio.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) item
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(item->'topping_ids', '[]'::jsonb)) topping_id
    LEFT JOIN public.toppings t
      ON t.id = topping_id.value::UUID
      AND t.business_id = v_business_id
      AND t.is_active
    WHERE t.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Todos los toppings deben estar activos y pertenecer a este negocio.';
  END IF;

  RETURN public.create_employee_order(p_session_token, p_table_id, p_notes, p_items);
END;
$$;

DO $$
DECLARE
  v_table TEXT;
  v_policy TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'employees',
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
    FOR v_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', v_policy, v_table);
    END LOOP;
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_read ON public.%I', v_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_admin_manage ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY tenant_member_read ON public.%I FOR SELECT TO authenticated USING (public.has_business_access(business_id))',
      v_table
    );
    EXECUTE format(
      'CREATE POLICY tenant_admin_manage ON public.%I FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id))',
      v_table
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_categories(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_business_products(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_business_toppings(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_business_reference_employee(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_business_salon_access(TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_business_salon_access(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_business_employee_tables(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_business_employee_order(TEXT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_business_categories(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_products(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_toppings(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_reference_employee(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_business_salon_access(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_salon_access(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_employee_tables(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_employee_order(TEXT, TEXT, UUID, TEXT, JSONB) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_salon_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_salon_access_enabled(BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_reference_employee(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_employee_tables(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_employee_order(TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_business_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_business_access(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.is_business_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_admin(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

COMMIT;
