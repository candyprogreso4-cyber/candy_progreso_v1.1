-- Store the flavor choices on each product for admin configuration and employee ordering.
BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS flavors TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.products
SET flavors = ARRAY['Maracuyá', 'Fresa', 'Chocolate', 'Vainilla']::TEXT[]
WHERE cardinality(flavors) = 0;

COMMIT;
