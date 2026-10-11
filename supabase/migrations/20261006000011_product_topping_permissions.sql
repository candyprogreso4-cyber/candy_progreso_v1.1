-- Restore admin management and public reads for product/topping associations.
BEGIN;

ALTER TABLE public.product_toppings ENABLE ROW LEVEL SECURITY;

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

COMMIT;
