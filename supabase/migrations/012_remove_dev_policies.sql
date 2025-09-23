-- 本番環境用：開発用の危険なRLSポリシーを削除し、安全な最小権限ポリシーのみを残す

-- 開発用の全許可ポリシーを削除（テーブルが存在する場合のみ）
DO $$ BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Temporary allow all for development" ON public.user_profiles;
  END IF;
  IF to_regclass('public.classes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Temporary allow all for classes" ON public.classes;
  END IF;
  IF to_regclass('public.test_periods') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Temporary allow all for test_periods" ON public.test_periods;
  END IF;
  IF to_regclass('public.tasks') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Temporary allow all for tasks" ON public.tasks;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can only access own profile" ON public.user_profiles;
    CREATE POLICY "Users can only access own profile" ON public.user_profiles
        FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- tasks: 自分に割り当て/自分が作成したタスクのみ参照可能
DO $$ BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can select own tasks" ON public.tasks;
    CREATE POLICY "Users can select own tasks" ON public.tasks
        FOR SELECT USING (assigned_to = auth.uid() OR created_by = auth.uid());
  END IF;
END $$;

-- tasks: 先生は自分が作成したタスクを管理可能
DO $$ BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Teachers can manage created tasks" ON public.tasks;
    CREATE POLICY "Teachers can manage created tasks" ON public.tasks
        FOR ALL USING (created_by = auth.uid());
  END IF;
END $$;

-- tasks: 生徒は自分に割り当てられたタスクのみ更新可能
DO $$ BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Students can update assigned tasks" ON public.tasks;
    CREATE POLICY "Students can update assigned tasks" ON public.tasks
        FOR UPDATE USING (assigned_to = auth.uid());
  END IF;
END $$;

-- test_periods: 自分の学年/クラスに関連、または自分が作成したものを参照
DO $$ BEGIN
  IF to_regclass('public.test_periods') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can access relevant test periods" ON public.test_periods;
    CREATE POLICY "Users can access relevant test periods" ON public.test_periods
        FOR SELECT USING (
            created_by = auth.uid() OR 
            EXISTS (
                SELECT 1 FROM public.user_profiles up
                WHERE up.id = auth.uid() 
                  AND up.grade_id = test_periods.grade_id
            )
        );
  END IF;
END $$;

-- test_periods: 作成者は管理可能
DO $$ BEGIN
  IF to_regclass('public.test_periods') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Teachers can manage test periods" ON public.test_periods;
    CREATE POLICY "Teachers can manage test periods" ON public.test_periods
        FOR ALL USING (created_by = auth.uid());
  END IF;
END $$;

-- classes: 担任または所属生徒のみ参照
DO $$ BEGIN
  IF to_regclass('public.classes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can access relevant classes" ON public.classes;
    CREATE POLICY "Users can access relevant classes" ON public.classes
        FOR SELECT USING (
            teacher_id = auth.uid() OR 
            auth.uid() = ANY(student_ids)
        );
  END IF;
END $$;

-- classes: 担任は管理可能
DO $$ BEGIN
  IF to_regclass('public.classes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Teachers can manage their classes" ON public.classes;
    CREATE POLICY "Teachers can manage their classes" ON public.classes
        FOR ALL USING (teacher_id = auth.uid());
  END IF;
END $$;


