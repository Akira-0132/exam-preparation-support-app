-- Remove policy that caused recursive dependency between user_profiles and test_periods

DO $$ BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Teachers can view students in their grades" ON public.user_profiles;
  END IF;
END $$;


