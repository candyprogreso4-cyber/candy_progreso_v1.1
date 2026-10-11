-- Allow ticket queries to read the topping rows nested under each order item.
BEGIN;

ALTER TABLE public.order_item_toppings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_item_toppings_read_all" ON public.order_item_toppings;
DROP POLICY IF EXISTS "Order item toppings readable" ON public.order_item_toppings;
CREATE POLICY "order_item_toppings_read_all"
  ON public.order_item_toppings FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT ON TABLE public.order_item_toppings TO anon, authenticated;

COMMIT;
