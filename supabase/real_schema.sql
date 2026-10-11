-- =====================================================================
-- CANDY EL PROGRESO - Supabase SQL schema for production
-- Execute this in Supabase SQL Editor
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- 1) profiles
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee')) DEFAULT 'employee',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles (role);

-- ---------------------------------------------------------------------
-- 2) employees
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  identification TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  pin_hash TEXT,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add the link column when this schema is applied over an older employees table.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.employee_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_sessions_active
  ON public.employee_sessions (employee_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_employees_identification
  ON public.employees (identification);

-- ---------------------------------------------------------------------
-- 3) tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.tables (table_number, status)
SELECT g.table_number, 'available'
FROM generate_series(1, 8) AS g(table_number)
ON CONFLICT (table_number) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4) categories
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 5) products
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  base_price NUMERIC(12,2) NOT NULL CHECK (base_price >= 0),
  flavors TEXT[] NOT NULL DEFAULT '{}',
  has_sizes BOOLEAN NOT NULL DEFAULT false,
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sizes) = 'array'),
  has_toppings BOOLEAN NOT NULL DEFAULT false,
  max_free_toppings INTEGER NOT NULL DEFAULT 0 CHECK (max_free_toppings >= 0),
  extra_topping_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (extra_topping_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  stock_controlled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category
  ON public.products (category_id, is_active);

-- ---------------------------------------------------------------------
-- 6) toppings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.toppings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 7) product_toppings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_toppings (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  topping_id UUID NOT NULL REFERENCES public.toppings(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, topping_id)
);

-- ---------------------------------------------------------------------
-- 8) orders
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','delivered','completed','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','cancelled')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders (status, payment_status, created_at DESC);

-- ---------------------------------------------------------------------
-- 9) order_items
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  size TEXT,
  flavor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items (order_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 10) order_item_toppings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_item_toppings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  topping_id UUID REFERENCES public.toppings(id) ON DELETE SET NULL,
  topping_name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0)
);

-- ---------------------------------------------------------------------
-- 11) payments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','nequi','daviplata','transfer','other')),
  received_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (received_amount >= 0),
  change_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  registered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 12) cash_registers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  closed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  closing_amount NUMERIC(12,2),
  expected_amount NUMERIC(12,2),
  difference NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_status
  ON public.cash_registers (status, opened_at DESC);

-- ---------------------------------------------------------------------
-- 13) cash_movements
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense','adjustment')),
  description TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 14) inventory
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimum_quantity NUMERIC(12,2) NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 15) inventory_movements
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entry','exit','adjustment')),
  quantity NUMERIC(12,2) NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 16) audit_logs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity, created_at DESC);

-- ---------------------------------------------------------------------
-- Helper trigger: updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_inventory_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- Auth user profile bootstrap
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'employee',
    NEW.raw_user_meta_data->>'phone',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- RPC: open_cash_register
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_cash_register(p_opening_amount NUMERIC(12,2))
RETURNS TABLE (
  register_id UUID,
  opening_amount NUMERIC(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_register_id UUID;
BEGIN
  INSERT INTO public.cash_registers (opened_by, opening_amount, status)
  VALUES (auth.uid(), p_opening_amount, 'open')
  RETURNING id INTO v_register_id;

  INSERT INTO public.cash_movements (cash_register_id, amount, type, description, created_by)
  VALUES (v_register_id, p_opening_amount, 'income', 'Apertura de caja - base inicial', auth.uid());

  RETURN QUERY
  SELECT v_register_id, p_opening_amount;
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: close_cash_register
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_cash_register(
  p_register_id UUID,
  p_closing_amount NUMERIC(12,2),
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  register_id UUID,
  difference NUMERIC(12,2),
  expected_amount NUMERIC(12,2),
  closing_amount NUMERIC(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expected NUMERIC(12,2);
  v_difference NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(CASE WHEN cm.type = 'income' THEN cm.amount ELSE -cm.amount END), 0)
  INTO v_expected
  FROM public.cash_movements cm
  WHERE cm.cash_register_id = p_register_id;

  v_difference := p_closing_amount - v_expected;

  UPDATE public.cash_registers
  SET
    closed_by = auth.uid(),
    closed_at = now(),
    closing_amount = p_closing_amount,
    expected_amount = v_expected,
    difference = v_difference,
    status = 'closed'
  WHERE id = p_register_id;

  RETURN QUERY
  SELECT p_register_id, v_difference, v_expected, p_closing_amount;
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: create_order
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(
  p_table_id UUID,
  p_employee_id UUID,
  p_notes TEXT,
  p_items JSONB
)
RETURNS TABLE (
  order_id UUID,
  order_number BIGINT,
  total NUMERIC(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_total NUMERIC(12,2) := 0;
  v_item JSONB;
  v_product RECORD;
  v_topping RECORD;
  v_item_total NUMERIC(12,2);
  v_item_subtotal NUMERIC(12,2);
BEGIN
  INSERT INTO public.orders (table_id, employee_id, status, payment_status, subtotal, total, notes)
  VALUES (p_table_id, p_employee_id, 'pending', 'pending', 0, 0, p_notes)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::UUID
      AND is_active = true;

    IF v_product IS NULL THEN
      RAISE EXCEPTION 'Producto no válido.';
    END IF;

    v_item_total := (v_product.base_price)::NUMERIC(12,2);

    FOR v_topping IN
      SELECT t.id, t.name, t.price
      FROM public.toppings t
      JOIN jsonb_array_elements(COALESCE(v_item->'topping_ids', '[]'::jsonb)) AS x(id_value)
        ON t.id = (x.id_value)::UUID
      WHERE t.is_active = true
    LOOP
      v_item_total := v_item_total + v_topping.price;
    END LOOP;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      subtotal,
      size,
      flavor,
      notes
    )
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name,
      COALESCE((v_item->>'quantity')::INTEGER, 1),
      v_product.base_price,
      v_item_total * COALESCE((v_item->>'quantity')::INTEGER, 1),
      v_item->>'size',
      v_item->>'flavor',
      v_item->>'notes'
    );

    v_total := v_total + (v_item_total * COALESCE((v_item->>'quantity')::INTEGER, 1));
  END LOOP;

  UPDATE public.orders
  SET subtotal = v_total,
      total = v_total,
      updated_at = now()
  WHERE id = v_order_id;

  UPDATE public.tables
  SET status = 'occupied'
  WHERE id = p_table_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), 'create_order', 'orders', v_order_id, jsonb_build_object('table_id', p_table_id, 'employee_id', p_employee_id));

  RETURN QUERY
  SELECT v_order_id, o.order_number, o.total
  FROM public.orders o
  WHERE o.id = v_order_id;
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: register_order_payment
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_order_payment(
  p_order_id UUID,
  p_method TEXT,
  p_received NUMERIC(12,2) DEFAULT 0,
  p_change NUMERIC(12,2) DEFAULT 0
)
RETURNS TABLE (
  payment_id UUID,
  order_total NUMERIC(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_payment_id UUID;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido no encontrado.';
  END IF;

  INSERT INTO public.payments (order_id, amount, payment_method, received_amount, change_amount, registered_by)
  VALUES (p_order_id, v_order.total, p_method, p_received, p_change, auth.uid())
  RETURNING id INTO v_payment_id;

  UPDATE public.orders
  SET payment_status = 'paid',
      status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  UPDATE public.tables
  SET status = 'available'
  WHERE id = v_order.table_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), 'register_payment', 'orders', p_order_id,
          jsonb_build_object('payment_method', p_method, 'amount', v_order.total));

  RETURN QUERY
  SELECT v_payment_id, v_order.total;
END;
$$;

-- ---------------------------------------------------------------------
-- Seed tables: optional default categories
-- ---------------------------------------------------------------------
INSERT INTO public.categories (name, description, sort_order)
VALUES
  ('Helados', 'Sabores y variedades', 1),
  ('Yogur', 'Opciones de yogurt helado', 2),
  ('Fresas con Crema', 'Postres fríos', 3),
  ('Granizados', 'Refrescos y granizados', 4),
  ('Toppings', 'Adiciones', 5)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------
-- RLS setup
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_item_toppings_read_all" ON public.order_item_toppings;
CREATE POLICY "order_item_toppings_read_all"
  ON public.order_item_toppings FOR SELECT TO anon, authenticated
  USING (true);
GRANT SELECT ON TABLE public.order_item_toppings TO anon, authenticated;

-- Avoid recursive RLS when policies need to check the current user's role.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'
      AND p.is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Product toppings readable by all" ON public.product_toppings;
CREATE POLICY "Product toppings readable by all"
  ON public.product_toppings FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage product toppings" ON public.product_toppings;
CREATE POLICY "Admins manage product toppings"
  ON public.product_toppings FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON TABLE public.product_toppings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.product_toppings TO authenticated;

CREATE OR REPLACE FUNCTION public.create_employee_with_pin(
  p_identification TEXT,
  p_full_name TEXT,
  p_pin TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_employee_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede registrar empleados.';
  END IF;
  IF p_identification IS NULL OR length(trim(p_identification)) < 5
     OR p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
    RAISE EXCEPTION 'Ingresa un nombre y una cédula válidos.';
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'El PIN debe tener exactamente 6 dígitos.';
  END IF;

  INSERT INTO public.employees (identification, full_name, is_active, pin_hash)
  VALUES (trim(p_identification), trim(p_full_name), true, crypt(p_pin, gen_salt('bf', 12)))
  RETURNING id INTO v_employee_id;

  RETURN v_employee_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_employee_pin(p_employee_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar PIN de empleados.';
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'El PIN debe tener exactamente 6 dígitos.';
  END IF;

  UPDATE public.employees
  SET pin_hash = crypt(p_pin, gen_salt('bf', 12)),
      failed_login_attempts = 0,
      locked_until = NULL
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empleado no encontrado.';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.authenticate_employee(p_identification TEXT, p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_employee public.employees%ROWTYPE;
  v_session_token TEXT;
  v_session_expires TIMESTAMPTZ;
BEGIN
  SELECT *
  INTO v_employee
  FROM public.employees
  WHERE identification = trim(COALESCE(p_identification, ''))
  FOR UPDATE;

  IF NOT FOUND OR NOT v_employee.is_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cédula o PIN incorrectos, o cuenta inactiva.');
  END IF;

  IF v_employee.locked_until IS NOT NULL AND v_employee.locked_until > now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Acceso temporalmente bloqueado por intentos fallidos. Intenta más tarde.'
    );
  END IF;

  IF v_employee.pin_hash IS NULL
     OR p_pin IS NULL
     OR crypt(p_pin, v_employee.pin_hash) <> v_employee.pin_hash THEN
    UPDATE public.employees
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
          WHEN failed_login_attempts + 1 >= 5 THEN now() + interval '15 minutes'
          ELSE NULL
        END
    WHERE id = v_employee.id;

    RETURN jsonb_build_object('success', false, 'message', 'Cédula o PIN incorrectos, o cuenta inactiva.');
  END IF;

  UPDATE public.employees
  SET failed_login_attempts = 0,
      locked_until = NULL
  WHERE id = v_employee.id;

  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_session_expires := now() + interval '12 hours';

  INSERT INTO public.employee_sessions (employee_id, token_hash, expires_at)
  VALUES (
    v_employee.id,
    encode(digest(v_session_token, 'sha256'), 'hex'),
    v_session_expires
  );

  RETURN jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', v_employee.id,
      'identification', v_employee.identification,
      'full_name', v_employee.full_name
    ),
    'session_token', v_session_token,
    'expires_at', v_session_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_employee_session(p_session_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_employee public.employees%ROWTYPE;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_session_token IS NULL OR p_session_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT e.*
  INTO v_employee
  FROM public.employee_sessions s
  JOIN public.employees e ON e.id = s.employee_id
  WHERE s.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND e.is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT s.expires_at
  INTO v_expires_at
  FROM public.employee_sessions s
  WHERE s.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now();

  RETURN jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', v_employee.id,
      'identification', v_employee.identification,
      'full_name', v_employee.full_name
    ),
    'expires_at', v_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_employee_session(p_session_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF p_session_token IS NULL OR p_session_token !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  UPDATE public.employee_sessions
  SET revoked_at = now()
  WHERE token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    AND revoked_at IS NULL;
  RETURN FOUND;
END;
$$;

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
  IF p_table_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tables WHERE id = p_table_id) THEN
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
      SELECT value::UUID FROM jsonb_array_elements_text(COALESCE(v_item->'topping_ids', '[]'::jsonb))
    LOOP
      SELECT t.id, t.name, t.price
      INTO v_topping
      FROM public.toppings t
      WHERE t.id = v_topping_id AND t.is_active = true;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Uno de los toppings seleccionados ya no está disponible.';
      END IF;

      INSERT INTO public.order_item_toppings (order_item_id, topping_id, topping_name, price)
      VALUES (v_order_item_id, v_topping.id, v_topping.name, v_topping.price);
      v_item_total := v_item_total + v_topping.price;
    END LOOP;

    UPDATE public.order_items
    SET unit_price = v_item_total, subtotal = v_item_total * v_quantity
    WHERE id = v_order_item_id;
    v_total := v_total + v_item_total * v_quantity;
  END LOOP;

  UPDATE public.orders
  SET subtotal = v_total, total = v_total, updated_at = now()
  WHERE id = v_order_id;

  IF p_table_id IS NOT NULL THEN
    UPDATE public.tables SET status = 'occupied' WHERE id = p_table_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (NULL, 'create_order', 'orders', v_order_id,
          jsonb_build_object('table_id', p_table_id, 'employee_id', v_employee_id));

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'total', v_total);
END;
$$;

DROP FUNCTION IF EXISTS public.validate_employee_access(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.generate_daily_qr();
REVOKE ALL ON FUNCTION public.create_employee_with_pin(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_employee_pin(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.authenticate_employee(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_employee_session(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_employee_session(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employee_with_pin(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_employee_pin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.authenticate_employee(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_employee_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_employee_session(TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_employee_tables(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_employee_order(TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_tables(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_employee_order(TEXT, UUID, TEXT, JSONB) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_order(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.profiles',
      policy_record.policyname
    );
  END LOOP;
END;
$$;

-- Profiles can read/update own profile; admins can read all.
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update_admin_only"
ON public.profiles
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Employees: admin reads all; employees can read only their own record if linked.
DROP POLICY IF EXISTS "employees_select_admin_or_self" ON public.employees;
CREATE POLICY "employees_select_admin_or_self"
ON public.employees
FOR SELECT
USING (public.is_admin() OR profile_id = auth.uid());

DROP POLICY IF EXISTS "employees_manage_admin_only" ON public.employees;
CREATE POLICY "employees_manage_admin_only"
ON public.employees
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.employees FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, profile_id, identification, full_name, is_active, created_at)
  ON TABLE public.employees TO authenticated;
GRANT UPDATE (is_active) ON TABLE public.employees TO authenticated;
REVOKE ALL ON TABLE public.employee_sessions FROM PUBLIC, anon, authenticated;

-- Catalog read access open; admin manage.
DROP POLICY IF EXISTS "catalog_read_all" ON public.categories;
CREATE POLICY "catalog_read_all" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "catalog_manage_admin" ON public.categories;
CREATE POLICY "catalog_manage_admin" ON public.categories FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_read_all" ON public.products;
CREATE POLICY "products_read_all" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "products_manage_admin" ON public.products;
CREATE POLICY "products_manage_admin" ON public.products FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "toppings_read_all" ON public.toppings;
CREATE POLICY "toppings_read_all" ON public.toppings FOR SELECT USING (true);

DROP POLICY IF EXISTS "toppings_manage_admin" ON public.toppings;
CREATE POLICY "toppings_manage_admin" ON public.toppings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "orders_employee_or_admin" ON public.orders;
CREATE POLICY "orders_employee_or_admin"
ON public.orders
FOR ALL
USING (
  public.is_admin()
  OR employee_id IN (
    SELECT e.id FROM public.employees e
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE e.profile_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin()
  OR employee_id IN (
    SELECT e.id FROM public.employees e
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE e.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "order_items_whole_access" ON public.order_items;
CREATE POLICY "order_items_whole_access"
ON public.order_items
FOR ALL
USING (
  public.is_admin()
  OR order_id IN (
    SELECT o.id FROM public.orders o WHERE o.employee_id IN (
      SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid()
    )
  )
)
WITH CHECK (
  public.is_admin()
  OR order_id IN (
    SELECT o.id FROM public.orders o WHERE o.employee_id IN (
      SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "cash_admin_only" ON public.cash_registers;
CREATE POLICY "cash_admin_only"
ON public.cash_registers
FOR ALL
USING (
  public.is_admin()
)
WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "cash_movements_admin_only" ON public.cash_movements;
CREATE POLICY "cash_movements_admin_only"
ON public.cash_movements
FOR ALL
USING (
  public.is_admin()
)
WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "inventory_admin_only" ON public.inventory;
CREATE POLICY "inventory_admin_only"
ON public.inventory
FOR ALL
USING (
  public.is_admin()
)
WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "audit_logs_admin_only" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_only"
ON public.audit_logs
FOR SELECT
USING (
  public.is_admin()
);

-- ---------------------------------------------------------------------
-- Example data: admin and employee demo users
-- ---------------------------------------------------------------------
-- Create the user in Supabase Auth first. New profiles are intentionally
-- created as employees; promote only the intended administrator from SQL Editor:
-- UPDATE public.profiles
-- SET full_name = 'Administrador Candy', role = 'admin', is_active = true
-- WHERE id = (
--   SELECT id FROM auth.users WHERE email = 'correo-admin-real@example.com'
-- );
--
-- Employee PIN access does not require a Supabase Auth user; profile_id is optional.
-- INSERT INTO public.employees (identification, full_name, is_active)
-- VALUES ('1098765432', 'Carlos Morales', true),
--        ('1098765433', 'Laura García', true);

-- End of file.
