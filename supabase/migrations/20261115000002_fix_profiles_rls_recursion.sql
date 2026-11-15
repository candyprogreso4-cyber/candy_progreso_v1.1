BEGIN;

DROP POLICY IF EXISTS profiles_select_own_or_business_admin ON public.profiles;
CREATE POLICY profiles_select_own_or_business_admin
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.business_memberships bm ON bm.business_id = e.business_id
      WHERE e.profile_id = profiles.id
        AND bm.user_id = (SELECT auth.uid())
        AND bm.role IN ('owner', 'admin')
        AND public.is_business_admin(bm.business_id)
    )
  );

COMMIT;
