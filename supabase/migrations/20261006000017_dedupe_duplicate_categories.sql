-- Consolidate active categories whose names differ only by case or whitespace.
DO $$
DECLARE
  duplicate_group RECORD;
BEGIN
  FOR duplicate_group IN
    SELECT
      lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) AS normalized_name,
      (array_agg(id ORDER BY sort_order, created_at, id))[1] AS canonical_id
    FROM public.categories
    WHERE is_active = true
    GROUP BY lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  LOOP
    UPDATE public.products
    SET category_id = duplicate_group.canonical_id
    WHERE category_id IN (
      SELECT id
      FROM public.categories
      WHERE is_active = true
        AND lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) =
            duplicate_group.normalized_name
        AND id <> duplicate_group.canonical_id
    );

    UPDATE public.categories
    SET is_active = false
    WHERE is_active = true
      AND lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) =
          duplicate_group.normalized_name
      AND id <> duplicate_group.canonical_id;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_active_normalized_name
  ON public.categories (
    (lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')))
  )
  WHERE is_active = true;
