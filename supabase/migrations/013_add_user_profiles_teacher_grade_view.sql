-- Teachers can view students in grades where they have created test periods
-- 安全策: テーブル存在確認 + 既存ポリシーの安全な置き換え

DO $$ BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Teachers can view students in their grades" ON public.user_profiles;
    CREATE POLICY "Teachers can view students in their grades" ON public.user_profiles
      FOR SELECT
      USING (
        -- 生徒レコードのみ対象
        role = 'student'
        AND EXISTS (
          SELECT 1
          FROM public.test_periods tp
          WHERE tp.created_by = auth.uid()
            AND tp.grade_id IS NOT NULL
            AND tp.grade_id = user_profiles.grade_id
        )
      );
  END IF;
END $$;


