-- ====================================================================
-- CANDY EL PROGRESO - POS Heladería & Cafetería
-- MASTER CONSOLIDATED DATABASE SCHEMA & SEED SCRIPT
-- Execute in Supabase SQL Editor: https://supabase.com/dashboard/project/pnmvqdvnvcmtottvfvns/sql
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. PROFILES (Vinculado a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'Usuario',
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. EMPLOYEES (Personal de atención y mozos para turnos por QR)
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  identification TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. DAILY_ACCESS (Tokens efímeros de acceso diario por QR para empleados)
CREATE TABLE IF NOT EXISTS public.daily_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  qr_code TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABLES (Mesas de salón de la heladería)
CREATE TABLE IF NOT EXISTS public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. CATEGORIES (Categorías de la carta)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. PRODUCTS (Catálogo con precios en NUMERIC)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  base_price NUMERIC(12,2) NOT NULL CHECK (base_price >= 0),
  has_sizes BOOLEAN NOT NULL DEFAULT false,
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sizes) = 'array'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  stock_controlled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. TOPPINGS (Toppings, salsas y adiciones)
CREATE TABLE IF NOT EXISTS public.toppings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. PRODUCT_TOPPINGS (Matriz de compatibilidad producto-topping)
CREATE TABLE IF NOT EXISTS public.product_toppings (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  topping_id UUID NOT NULL REFERENCES public.toppings(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, topping_id)
);

-- 9. ORDERS (Cabecera de comandas / pedidos)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'completed', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
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

-- 10. ORDER_ITEMS (Detalle de productos del pedido con precio histórico)
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

-- 11. ORDER_ITEM_TOPPINGS (Toppings aplicados por ítem con precio histórico)
CREATE TABLE IF NOT EXISTS public.order_item_toppings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  topping_id UUID REFERENCES public.toppings(id) ON DELETE SET NULL,
  topping_name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0)
);

-- 12. PAYMENTS (Liquidación contable de pedidos)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'nequi', 'daviplata', 'transfer', 'other')),
  received_amount NUMERIC(12,2) DEFAULT 0,
  change_amount NUMERIC(12,2) DEFAULT 0,
  registered_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. CASH_REGISTERS (Turnos y jornadas de caja)
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by UUID REFERENCES public.profiles(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  closed_by UUID REFERENCES public.profiles(id),
  closed_at TIMESTAMPTZ,
  closing_amount NUMERIC(12,2),
  expected_amount NUMERIC(12,2),
  difference NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

-- 14. CASH_MOVEMENTS (Egresos, ingresos menores y ventas en efectivo)
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'adjustment')),
  description TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. INVENTORY (Control de stock en tiempo real)
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimum_quantity NUMERIC(12,2) NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. INVENTORY_MOVEMENTS (Kardex de movimientos)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entry', 'exit', 'adjustment')),
  quantity NUMERIC(12,2) NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. AUDIT_LOGS (Trazabilidad de operaciones críticas)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ÍNDICES PARA ALTO RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_toppings_item_id ON public.order_item_toppings(order_item_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_daily_access_token ON public.daily_access(token);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON public.cash_movements(cash_register_id);

-- ====================================================================
-- FUNCIONES DE SEGURIDAD Y HELPERS
-- ====================================================================

CREATE OR REPLACE FUNCTION public.is_shop_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(COALESCE(new.email, 'Usuario'), '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_access ENABLE ROW LEVEL SECURITY;
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

-- Policies
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are readable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Employees readable by authenticated or anon via QR" ON public.employees;
CREATE POLICY "Employees readable by authenticated or anon via QR"
  ON public.employees FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_shop_admin());

DROP POLICY IF EXISTS "Admins manage employees" ON public.employees;
CREATE POLICY "Admins manage employees"
  ON public.employees FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Daily access readable for valid tokens" ON public.daily_access;
CREATE POLICY "Daily access readable for valid tokens"
  ON public.daily_access FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_shop_admin());

DROP POLICY IF EXISTS "Admins manage daily access" ON public.daily_access;
CREATE POLICY "Admins manage daily access"
  ON public.daily_access FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Tables readable by everyone" ON public.tables;
CREATE POLICY "Tables readable by everyone"
  ON public.tables FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Update table status" ON public.tables;
CREATE POLICY "Update table status"
  ON public.tables FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Categories readable by all" ON public.categories;
CREATE POLICY "Categories readable by all"
  ON public.categories FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_shop_admin());

DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Products readable by all" ON public.products;
CREATE POLICY "Products readable by all"
  ON public.products FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_shop_admin());

DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products"
  ON public.products FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Toppings readable by all" ON public.toppings;
CREATE POLICY "Toppings readable by all"
  ON public.toppings FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_shop_admin());

DROP POLICY IF EXISTS "Admins manage toppings" ON public.toppings;
CREATE POLICY "Admins manage toppings"
  ON public.toppings FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Product toppings readable by all" ON public.product_toppings;
CREATE POLICY "Product toppings readable by all"
  ON public.product_toppings FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage product toppings" ON public.product_toppings;
CREATE POLICY "Admins manage product toppings"
  ON public.product_toppings FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Orders readable by authenticated and employees" ON public.orders;
CREATE POLICY "Orders readable by authenticated and employees"
  ON public.orders FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Orders insertable" ON public.orders;
CREATE POLICY "Orders insertable"
  ON public.orders FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Orders update status" ON public.orders;
CREATE POLICY "Orders update status"
  ON public.orders FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Order items readable" ON public.order_items;
CREATE POLICY "Order items readable"
  ON public.order_items FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Order items insertable" ON public.order_items;
CREATE POLICY "Order items insertable"
  ON public.order_items FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Order item toppings readable" ON public.order_item_toppings;
CREATE POLICY "Order item toppings readable"
  ON public.order_item_toppings FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Order item toppings insertable" ON public.order_item_toppings;
CREATE POLICY "Order item toppings insertable"
  ON public.order_item_toppings FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Payments readable by admin" ON public.payments;
CREATE POLICY "Payments readable by admin"
  ON public.payments FOR SELECT TO authenticated
  USING (public.is_shop_admin());

DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;
CREATE POLICY "Admins manage payments"
  ON public.payments FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Admins manage cash registers" ON public.cash_registers;
CREATE POLICY "Admins manage cash registers"
  ON public.cash_registers FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Admins manage cash movements" ON public.cash_movements;
CREATE POLICY "Admins manage cash movements"
  ON public.cash_movements FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Admins view and manage inventory" ON public.inventory;
CREATE POLICY "Admins view and manage inventory"
  ON public.inventory FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Admins view and manage inventory movements" ON public.inventory_movements;
CREATE POLICY "Admins view and manage inventory movements"
  ON public.inventory_movements FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

DROP POLICY IF EXISTS "Audit logs readable by admin" ON public.audit_logs;
CREATE POLICY "Audit logs readable by admin"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_shop_admin());

DROP POLICY IF EXISTS "Audit logs insertable" ON public.audit_logs;
CREATE POLICY "Audit logs insertable"
  ON public.audit_logs FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- ====================================================================
-- RPC FUNCTIONS
-- ====================================================================

-- 1. CREACIÓN SEGURA DE PEDIDOS (Valida precios contra DB para evitar manipulación)
CREATE OR REPLACE FUNCTION public.create_order(
  p_table_id UUID,
  p_employee_id UUID,
  p_notes TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_order_id UUID;
  v_order_number BIGINT;
  v_subtotal NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2) := 0;
  v_item RECORD;
  v_product RECORD;
  v_topping RECORD;
  v_item_subtotal NUMERIC(12,2);
  v_order_item_id UUID;
  v_topping_id_text TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
  END IF;

  INSERT INTO public.orders (table_id, employee_id, notes, status, payment_status, subtotal, total)
  VALUES (p_table_id, p_employee_id, p_notes, 'pending', 'pending', 0, 0)
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID,
    quantity INTEGER,
    size TEXT,
    flavor TEXT,
    notes TEXT,
    topping_ids JSONB
  )
  LOOP
    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a 0.';
    END IF;

    SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id AND is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto solicitado no existe o no está activo.';
    END IF;

    v_item_subtotal := v_product.base_price * v_item.quantity;

    INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal, size, flavor, notes)
    VALUES (v_order_id, v_product.id, v_product.name, v_item.quantity, v_product.base_price, v_item_subtotal, v_item.size, v_item.flavor, v_item.notes)
    RETURNING id INTO v_order_item_id;

    IF v_item.topping_ids IS NOT NULL AND jsonb_array_length(v_item.topping_ids) > 0 THEN
      FOR v_topping_id_text IN SELECT jsonb_array_elements_text(v_item.topping_ids)
      LOOP
        SELECT * INTO v_topping FROM public.toppings WHERE id = v_topping_id_text::UUID AND is_active = true;
        IF FOUND THEN
          INSERT INTO public.order_item_toppings (order_item_id, topping_id, topping_name, price)
          VALUES (v_order_item_id, v_topping.id, v_topping.name, v_topping.price);
          
          v_item_subtotal := v_item_subtotal + (v_topping.price * v_item.quantity);
        END IF;
      END LOOP;

      UPDATE public.order_items SET subtotal = v_item_subtotal WHERE id = v_order_item_id;
    END IF;

    v_subtotal := v_subtotal + v_item_subtotal;
  END LOOP;

  v_total := v_subtotal;

  UPDATE public.orders
  SET subtotal = v_subtotal,
      total = v_total,
      status = 'preparing'
  WHERE id = v_order_id;

  IF p_table_id IS NOT NULL THEN
    UPDATE public.tables SET status = 'occupied' WHERE id = p_table_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    auth.uid(),
    'CREATE_ORDER',
    'orders',
    v_order_id,
    jsonb_build_object('order_number', v_order_number, 'total', v_total, 'table_id', p_table_id)
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total', v_total,
    'status', 'preparing'
  );
END;
$$;

-- 2. FINALIZAR PREPARACIÓN DE PEDIDO
CREATE OR REPLACE FUNCTION public.mark_order_completed(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe.';
  END IF;

  UPDATE public.orders
  SET status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), 'COMPLETE_ORDER', 'orders', p_order_id, jsonb_build_object('order_number', v_order.order_number));

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', 'completed');
END;
$$;

-- 3. REGISTRAR PAGO Y LIQUIDACIÓN
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
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no fue encontrado.';
  END IF;
  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Este pedido ya cuenta con un pago registrado.';
  END IF;

  INSERT INTO public.payments (order_id, amount, payment_method, received_amount, change_amount, registered_by)
  VALUES (p_order_id, v_order.total, p_method, p_received, p_change, auth.uid())
  RETURNING id INTO v_payment_id;

  UPDATE public.orders
  SET payment_status = 'paid',
      updated_at = now()
  WHERE id = p_order_id;

  IF v_order.table_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE table_id = v_order.table_id
        AND id <> p_order_id
        AND payment_status = 'pending'
        AND status NOT IN ('cancelled', 'completed')
    ) THEN
      UPDATE public.tables SET status = 'available' WHERE id = v_order.table_id;
    END IF;
  END IF;

  IF p_method = 'cash' THEN
    SELECT * INTO v_open_register FROM public.cash_registers WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.cash_movements (cash_register_id, amount, type, description, created_by)
      VALUES (
        v_open_register.id,
        v_order.total,
        'income',
        'Cobro Pedido #' || v_order.order_number,
        auth.uid()
      );
    END IF;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    auth.uid(),
    'REGISTER_PAYMENT',
    'payments',
    v_payment_id,
    jsonb_build_object('order_id', p_order_id, 'order_number', v_order.order_number, 'amount', v_order.total, 'method', p_method)
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'order_id', p_order_id,
    'status', 'paid',
    'amount', v_order.total
  );
END;
$$;

-- 4. APERTURA DE CAJA
CREATE OR REPLACE FUNCTION public.open_cash_register(p_opening_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_existing RECORD;
  v_register_id UUID;
BEGIN
  SELECT * INTO v_existing FROM public.cash_registers WHERE status = 'open' LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'register_id', v_existing.id, 'message', 'Ya hay una caja abierta.');
  END IF;

  INSERT INTO public.cash_registers (opened_by, opening_amount, status)
  VALUES (auth.uid(), p_opening_amount, 'open')
  RETURNING id INTO v_register_id;

  INSERT INTO public.cash_movements (cash_register_id, amount, type, description, created_by)
  VALUES (v_register_id, p_opening_amount, 'income', 'Base inicial de caja', auth.uid());

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), 'OPEN_CASH', 'cash_registers', v_register_id, jsonb_build_object('amount', p_opening_amount));

  RETURN jsonb_build_object('success', true, 'register_id', v_register_id);
END;
$$;

-- 5. CIERRE DE CAJA Y REVOCACIÓN DE ACCESOS
CREATE OR REPLACE FUNCTION public.close_cash_register(
  p_register_id UUID,
  p_closing_amount NUMERIC,
  p_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_register RECORD;
  v_cash_incomes NUMERIC(12,2) := 0;
  v_cash_expenses NUMERIC(12,2) := 0;
  v_expected NUMERIC(12,2) := 0;
  v_difference NUMERIC(12,2) := 0;
  v_pending_count INTEGER := 0;
BEGIN
  SELECT * INTO v_register FROM public.cash_registers WHERE id = p_register_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La caja no existe o ya está cerrada.';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_cash_incomes
  FROM public.cash_movements
  WHERE cash_register_id = p_register_id AND type = 'income';

  SELECT COALESCE(SUM(amount), 0) INTO v_cash_expenses
  FROM public.cash_movements
  WHERE cash_register_id = p_register_id AND type = 'expense';

  v_expected := v_cash_incomes - v_cash_expenses;
  v_difference := p_closing_amount - v_expected;

  SELECT COUNT(*) INTO v_pending_count
  FROM public.orders
  WHERE status = 'completed' AND payment_status = 'pending';

  UPDATE public.cash_registers
  SET closed_by = auth.uid(),
      closed_at = now(),
      closing_amount = p_closing_amount,
      expected_amount = v_expected,
      difference = v_difference,
      status = 'closed'
  WHERE id = p_register_id;

  UPDATE public.daily_access
  SET is_active = false
  WHERE is_active = true;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
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

-- 6. GENERACIÓN DE QR DIARIO
CREATE OR REPLACE FUNCTION public.generate_daily_qr()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_token TEXT;
  v_access_id UUID;
  v_expires TIMESTAMPTZ;
BEGIN
  UPDATE public.daily_access SET is_active = false WHERE is_active = true;

  v_token := encode(gen_random_bytes(20), 'hex');
  v_expires := now() + interval '24 hours';

  INSERT INTO public.daily_access (token, qr_code, expires_at, created_by, is_active)
  VALUES (v_token, 'CANDY-ACCESS:' || v_token, v_expires, auth.uid(), true)
  RETURNING id INTO v_access_id;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), 'GENERATE_QR', 'daily_access', v_access_id, jsonb_build_object('token', v_token));

  RETURN jsonb_build_object(
    'id', v_access_id,
    'token', v_token,
    'qr_code', 'CANDY-ACCESS:' || v_token,
    'expires_at', v_expires
  );
END;
$$;

-- 7. VALIDACIÓN DE ACCESO EMPLEADO POR QR Y CÉDULA
CREATE OR REPLACE FUNCTION public.validate_employee_access(
  p_token TEXT,
  p_identification TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_access RECORD;
  v_employee RECORD;
BEGIN
  SELECT * INTO v_access
  FROM public.daily_access
  WHERE token = p_token AND is_active = true AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El código QR ha expirado o no es válido para la jornada de hoy.';
  END IF;

  SELECT * INTO v_employee
  FROM public.employees
  WHERE identification = p_identification AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cédula no encontrada o empleado inactivo. Consulta con el administrador.';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (
    NULL,
    'EMPLOYEE_LOGIN_QR',
    'employees',
    v_employee.id,
    jsonb_build_object('employee_name', v_employee.full_name, 'identification', p_identification)
  );

  RETURN jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', v_employee.id,
      'full_name', v_employee.full_name,
      'identification', v_employee.identification
    ),
    'token', p_token,
    'expires_at', v_access.expires_at
  );
END;
$$;

-- Activar Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_registers;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  EXCEPTION WHEN duplicate_object THEN END;
END $$;

-- ====================================================================
-- SEED DATA
-- ====================================================================

-- Mesas
INSERT INTO public.tables (table_number, status)
VALUES 
  (1, 'available'),
  (2, 'available'),
  (3, 'available'),
  (4, 'available'),
  (5, 'available'),
  (6, 'available'),
  (7, 'available'),
  (8, 'available')
ON CONFLICT (table_number) DO NOTHING;

-- Categorías
INSERT INTO public.categories (id, name, description, image_url, sort_order)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Helados', 'Helados cremosos artesanales, conos y copas clásicas', '🍦', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Yogur', 'Yogur helado artesanal bajo en grasa con fermentos vivos', '🥛', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Fresas con crema', 'Fresas frescas de temporada con crema chantilly especial', '🍓', 3),
  ('c1000000-0000-0000-0000-000000000004', 'Postres', 'Obleas cuchareables, gelatinas candy y delicias dulces', '🍰', 4),
  ('c1000000-0000-0000-0000-000000000005', 'Granizados', 'Granizados de pura fruta natural y café helado', '🥤', 5),
  ('c1000000-0000-0000-0000-000000000006', 'Frutas Candy', 'Piña candy, sandía candy y ensaladas de frutas especiales', '🍉', 6),
  ('c1000000-0000-0000-0000-000000000007', 'Toppings', 'Adiciones, salsas artesanales y coberturas crocantes', '🍫', 7)
ON CONFLICT (name) DO NOTHING;

-- Productos
INSERT INTO public.products (id, category_id, name, description, image_url, base_price, is_active, stock_controlled)
VALUES
  (
    'p1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002',
    'Yogur Helado 8 oz',
    'Base ligera de yogur griego artesanal bajo en grasa con salsa de maracuyá',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAoKKQe291PoY-7j1sHG5gop5iczMKYRpwGJEakVmyXiho-dyftX-QDO7dTu2zmHqlNrpHMUwj5zXlwD9_a1Wx8hzXAoISfFtBionslkYygUdQSZ3cHUc7DyQTP2JkRqjOb3nAVB7rLBDhaAzySapc6Y1f4VyJAylBQqa8c2i20oHQffHg_Ca8AtLNZEtDihaaL9MBN-EHSSHOLk_1DNlNTX_VFOpdpwnuFiFQ8-0e2yVjP9Qovk7gp',
    10000.00,
    true,
    false
  ),
  (
    'p1000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    'Yogur Helado 12 oz',
    'Porción grande de yogur helado para compartir o disfrutar con extra adiciones',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDn0Mu4LlL2zUG-yZazczWho3QBjE29O305vE3NIw76DhKFbkxtHgSN4qGvHady4XHvug-L4UXoX8fFgQ3OC9dYEFROpoL4H7KZGvkiPezPdVGJcAstzxbpOjmxUKgHIPLvtdbc220UXu-LdBWdX_RNPDpXq3Km7nWoPMXwSQ3Svw4o27V1HX3YvLrHcpWNyxNoQkQAljnsx7_LOAUjYCdXIYZ1vGFe4GX6-b9Hm4n4DjCH9RNhyvJ-',
    13000.00,
    true,
    false
  ),
  (
    'p1000000-0000-0000-0000-000000000003',
    'c1000000-0000-0000-0000-000000000002',
    'Yogur Helado 6 oz',
    'Porción personal ideal de yogur helado con salsa al gusto',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAoKKQe291PoY-7j1sHG5gop5iczMKYRpwGJEakVmyXiho-dyftX-QDO7dTu2zmHqlNrpHMUwj5zXlwD9_a1Wx8hzXAoISfFtBionslkYygUdQSZ3cHUc7DyQTP2JkRqjOb3nAVB7rLBDhaAzySapc6Y1f4VyJAylBQqa8c2i20oHQffHg_Ca8AtLNZEtDihaaL9MBN-EHSSHOLk_1DNlNTX_VFOpdpwnuFiFQ8-0e2yVjP9Qovk7gp',
    8000.00,
    true,
    false
  ),
  (
    'p1000000-0000-0000-0000-000000000004',
    'c1000000-0000-0000-0000-000000000003',
    'Fresas con Crema Especial',
    'Fresas seleccionadas de primera calidad, crema chantilly de la casa y leche condensada',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDjk0L4UDR9AwRz1y6tiyUEyDDNWuRuu64yxL1iJIlmxw-Eba6iErBERVdqjs_mUfFhO0njSur8V7mVefEpfYnIH1gQKw8QzbzF02CV5lHXIEjWvQhJJVFod_ieFqQq1ZMuHH42xhsBYnYG__BTtBeYJCNrtWadIstRlrlSKlOAfyqevN5MGPD-uS8zZe24j4TkfeoYkksKm3n3hAwqIL9H54kHfXZXTCI9H_d_7dnpB2kagdO-TlMn',
    12000.00,
    true,
    false
  ),
  (
    'p1000000-0000-0000-0000-000000000005',
    'c1000000-0000-0000-0000-000000000001',
    'Copa Sundae Candy',
    'Dos bolas de helado artesanal, barquillo crujiente, salsa de chocolate caliente y cereza marrasquino',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDtlpe472DLP_7hUB_YFtyGq5IwGg_6To00OBg5-JxOG3MqVU8m9qZWR0vTY_j7zTZgna-YMOm-vbb5xd-mnHVYF2VT9S56GgybMfBBnZGAly2r9YqZOidknpUlDtdL_rjDlPY5QPQyybBB8Mb4Ap3oFLqX34VS9BZIdJNWonesxdZbWyTjZDSlWaBrOFsDUu2xyr6V4fldZL7hLDbzK0nWcF0FJPZq7uSdhreFud_hF7XrKU8fTd9D',
    14500.00,
    true,
    false
  ),
  (
    'p1000000-0000-0000-0000-000000000006',
    'c1000000-0000-0000-0000-000000000006',
    'Piña Candy',
    'Media piña rellena con helado artesanal, trozos de fruta natural fresca y salsas frutales',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop',
    15000.00,
    true,
    false
  ),
  (
    'p1000000-0000-0000-0000-000000000007',
    'c1000000-0000-0000-0000-000000000006',
    'Sandía Candy',
    'Sandía tallada con helado refrescante, chispas de chocolate y reducción de frutos rojos',
    'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop',
    15000.00,
    true,
    false
  ),
  (
    'p1000000-0000-0000-0000-000000000008',
    'c1000000-0000-0000-0000-000000000004',
    'Oblea Cuchareable',
    'Oblea en copa con generoso arequipe, queso campesino rallado, chantilly y salsa de mora',
    'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=500&auto=format&fit=crop',
    9500.00,
    true,
    false
  ),
  (
    'p1000000-0000-0000-0000-000000000009',
    'c1000000-0000-0000-0000-000000000004',
    'Gelatina Candy Especial',
    'Gelatina multicolor en capas con crema especial de leche condensada y duraznos',
    'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=500&auto=format&fit=crop',
    7500.00,
    true,
    false
  ),
  (
    'p1000000-0000-0000-0000-000000000010',
    'c1000000-0000-0000-0000-000000000005',
    'Granizado de Maracuyá',
    'Granizado con pulpa 100% natural de maracuyá ácido con leche condensada',
    'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop',
    8500.00,
    true,
    false
  ),
  (
    'p1000000-0000-0000-0000-000000000011',
    'c1000000-0000-0000-0000-000000000005',
    'Granizado de Frutos Rojos',
    'Fresa, mora y arándanos granizados con toque refrescante',
    'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop',
    8500.00,
    true,
    false
  ),
  (
    'p1000000-0000-0000-0000-000000000012',
    'c1000000-0000-0000-0000-000000000001',
    'Cono Doble Artesanal',
    'Dos bolas de helado artesanal servidas en barquillo crocante azucarado',
    'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500&auto=format&fit=crop',
    7000.00,
    true,
    false
  )
ON CONFLICT (name) DO UPDATE
SET base_price = EXCLUDED.base_price,
    image_url = EXCLUDED.image_url,
    description = EXCLUDED.description;

-- Toppings
INSERT INTO public.toppings (id, name, description, image_url, price)
VALUES
  ('t1000000-0000-0000-0000-000000000001', 'Oreo picada', 'Galleta Oreo triturada crocante', '🍪', 2000.00),
  ('t1000000-0000-0000-0000-000000000002', 'Chispas de chocolate', 'Gotas de chocolate semiamargo 54%', '🍫', 2000.00),
  ('t1000000-0000-0000-0000-000000000003', 'Salsa de maracuyá', 'Reducción de maracuyá natural con semillas', '🥭', 2000.00),
  ('t1000000-0000-0000-0000-000000000004', 'Salsa de fresas', 'Fruta natural sin conservantes en almíbar ligero', '🍓', 2000.00),
  ('t1000000-0000-0000-0000-000000000005', 'Maní crocante', 'Maní tostado troceado ligeramente dulce', '🥜', 2000.00),
  ('t1000000-0000-0000-0000-000000000006', 'Gomitas dulces', 'Surtido frutal azucarado de gomitas', '🍬', 2000.00),
  ('t1000000-0000-0000-0000-000000000007', 'Crema Chantilly', 'Chantilly suave batida artesanal', '🥛', 2000.00),
  ('t1000000-0000-0000-0000-000000000008', 'Salsa de chocolate fudge', 'Chocolate espeso tibio', '🍫', 2000.00),
  ('t1000000-0000-0000-0000-000000000009', 'Leche condensada', 'Toque dulce tradicional', '🍶', 2000.00),
  ('t1000000-0000-0000-0000-000000000010', 'Barquillo artesanal', 'Barquillo de vainilla crocante', '🥢', 1500.00)
ON CONFLICT (name) DO UPDATE
SET price = EXCLUDED.price;

-- Product Toppings
INSERT INTO public.product_toppings (product_id, topping_id)
SELECT p.id, t.id
FROM public.products p, public.toppings t
WHERE p.category_id IN (
  'c1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000004'
)
ON CONFLICT (product_id, topping_id) DO NOTHING;

-- Empleados
INSERT INTO public.employees (id, identification, full_name, is_active)
VALUES
  ('e1000000-0000-0000-0000-000000000001', '1098765432', 'Carlos Mendoza', true),
  ('e1000000-0000-0000-0000-000000000002', '1098765433', 'Laura Gómez', true),
  ('e1000000-0000-0000-0000-000000000003', '1098765434', 'Valentina Ríos', true),
  ('e1000000-0000-0000-0000-000000000004', '1098765435', 'Andrés Castro', true)
ON CONFLICT (identification) DO NOTHING;

-- Token diario de prueba
INSERT INTO public.daily_access (token, qr_code, expires_at, is_active)
VALUES (
  'candy-demo-token-today',
  'CANDY-ACCESS:candy-demo-token-today',
  now() + interval '24 hours',
  true
)
ON CONFLICT (token) DO UPDATE
SET expires_at = now() + interval '24 hours',
    is_active = true;

-- Caja inicial
INSERT INTO public.cash_registers (id, opening_amount, status)
VALUES ('b1000000-0000-0000-0000-000000000001', 150000.00, 'open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cash_movements (cash_register_id, amount, type, description)
VALUES ('b1000000-0000-0000-0000-000000000001', 150000.00, 'income', 'Base inicial de caja física verificada a 08:00 AM')
ON CONFLICT DO NOTHING;
