-- Performance: accelerate lookups for students by grade and ordering by student_number

DO $$ BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_user_profiles_grade_role ON public.user_profiles (grade_id, role);
    CREATE INDEX IF NOT EXISTS idx_user_profiles_student_number ON public.user_profiles (student_number);
  END IF;
END $$;


