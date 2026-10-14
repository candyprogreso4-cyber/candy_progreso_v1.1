-- Keep supplier expenses separate from daily cash drawer movements.
BEGIN;

CREATE TABLE IF NOT EXISTS public.supplier_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL CHECK (length(trim(supplier_name)) > 0),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bogota')::DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_expenses_date
  ON public.supplier_expenses (expense_date);

ALTER TABLE public.supplier_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage supplier expenses" ON public.supplier_expenses;
CREATE POLICY "Admins manage supplier expenses"
  ON public.supplier_expenses
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.supplier_expenses TO authenticated;
REVOKE ALL ON TABLE public.supplier_expenses FROM anon, PUBLIC;

COMMIT;
