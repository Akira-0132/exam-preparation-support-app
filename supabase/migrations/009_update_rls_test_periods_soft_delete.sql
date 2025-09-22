-- RLS policies to support soft delete and admin visibility/management

-- Ensure RLS is enabled (already enabled in initial schema, but safe)
ALTER TABLE public.test_periods ENABLE ROW LEVEL SECURITY;

-- Allow students to SELECT only non-deleted periods of their class
CREATE POLICY IF NOT EXISTS "Students view non-deleted test periods in their class" ON public.test_periods
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'student'
        AND up.class_id = test_periods.class_id
    )
    AND test_periods.deleted_at IS NULL
  );

-- Allow teachers (admins) to SELECT all periods including deleted
CREATE POLICY IF NOT EXISTS "Teachers view all test periods including deleted" ON public.test_periods
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'teacher'
    )
  );

-- Allow teachers to UPDATE (including soft delete/restore) periods they own or manage
CREATE POLICY IF NOT EXISTS "Teachers manage their classes' test periods" ON public.test_periods
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'teacher'
        AND (
          test_periods.created_by = up.id OR
          test_periods.class_id = up.class_id OR
          (up.managed_class_ids IS NOT NULL AND test_periods.class_id = ANY (up.managed_class_ids))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'teacher'
        AND (
          test_periods.created_by = up.id OR
          test_periods.class_id = up.class_id OR
          (up.managed_class_ids IS NOT NULL AND test_periods.class_id = ANY (up.managed_class_ids))
        )
    )
  );

-- Allow teachers to DELETE periods they own or manage (for hard delete)
CREATE POLICY IF NOT EXISTS "Teachers hard delete their classes' test periods" ON public.test_periods
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'teacher'
        AND (
          test_periods.created_by = up.id OR
          test_periods.class_id = up.class_id OR
          (up.managed_class_ids IS NOT NULL AND test_periods.class_id = ANY (up.managed_class_ids))
        )
    )
  );


