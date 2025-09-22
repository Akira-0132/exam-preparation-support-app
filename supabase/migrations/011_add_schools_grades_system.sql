-- 学校・学年ベースのシステムへの段階的移行
-- 既存のclassesシステムと並行して動作する

-- 1. 学校マスターテーブル
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  prefecture TEXT,
  city TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 学年マスターテーブル
CREATE TABLE IF NOT EXISTS public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grade_number INTEGER NOT NULL CHECK (grade_number IN (1, 2, 3)),
  name TEXT NOT NULL, -- "1年生", "2年生", "3年生"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(school_id, grade_number)
);

-- 3. test_periodsにgrade_idを追加（既存のclass_idと並行使用）
ALTER TABLE public.test_periods 
  ADD COLUMN IF NOT EXISTS grade_id UUID REFERENCES public.grades(id) ON DELETE CASCADE;

-- 4. tasksに共有機能のカラムを追加
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_from_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. user_profilesに学校・学年情報を追加
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grade_id UUID REFERENCES public.grades(id) ON DELETE SET NULL;

-- 6. インデックス追加
CREATE INDEX IF NOT EXISTS idx_schools_name ON public.schools (name);
CREATE INDEX IF NOT EXISTS idx_grades_school_grade ON public.grades (school_id, grade_number);
CREATE INDEX IF NOT EXISTS idx_test_periods_grade_id ON public.test_periods (grade_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_shared ON public.tasks (is_shared);
CREATE INDEX IF NOT EXISTS idx_tasks_shared_from ON public.tasks (shared_from_task_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_school_grade ON public.user_profiles (school_id, grade_id);

-- 7. RLSポリシー設定

-- schools: 全ユーザーが閲覧可能
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view schools" ON public.schools FOR SELECT USING (true);

-- grades: 全ユーザーが閲覧可能
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view grades" ON public.grades FOR SELECT USING (true);

-- test_periods: grade_idベースのアクセス制御
CREATE POLICY "Users can view test periods by grade" ON public.test_periods FOR SELECT USING (
  -- 従来のclass_idベース（後方互換性）
  class_id IN (
    SELECT id FROM public.classes 
    WHERE teacher_id = auth.uid() 
    OR auth.uid() = ANY(student_ids)
  )
  OR
  -- 新しいgrade_idベース
  grade_id IN (
    SELECT g.id FROM public.grades g
    JOIN public.user_profiles up ON up.grade_id = g.id
    WHERE up.id = auth.uid()
  )
  OR
  -- 作成者は常にアクセス可能
  created_by = auth.uid()
);

-- tasks: 共有タスクのアクセス制御
CREATE POLICY "Users can view shared tasks by grade" ON public.tasks FOR SELECT USING (
  -- 従来のアクセス制御
  user_id = auth.uid()
  OR
  -- 共有タスク（同じ学校・学年のユーザーがアクセス可能）
  (is_shared = true AND grade_id IN (
    SELECT up.grade_id FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.grade_id IS NOT NULL
  ))
);

-- 8. デフォルト学校「個人クラス」を作成
INSERT INTO public.schools (id, name, prefecture, city) 
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '個人クラス',
  'システム',
  'デフォルト'
) ON CONFLICT (id) DO NOTHING;

-- 9. デフォルト学年を作成
INSERT INTO public.grades (id, school_id, grade_number, name)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 1, '1年生'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 2, '2年生'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 3, '3年生')
ON CONFLICT (school_id, grade_number) DO NOTHING;

-- 10. 既存ユーザーのデフォルト設定
-- 既存のuser_profilesにデフォルトの学校・学年を設定
UPDATE public.user_profiles 
SET 
  school_id = '00000000-0000-0000-0000-000000000001',
  grade_id = CASE 
    WHEN role = 'student' THEN '00000000-0000-0000-0000-000000000001' -- 1年生
    ELSE NULL
  END
WHERE school_id IS NULL;

-- 11. 既存のtest_periodsにデフォルトgrade_idを設定
UPDATE public.test_periods 
SET grade_id = '00000000-0000-0000-0000-000000000001'
WHERE grade_id IS NULL;

-- 12. 既存のtasksにデフォルトgrade_idを設定
UPDATE public.tasks 
SET grade_id = '00000000-0000-0000-0000-000000000001'
WHERE grade_id IS NULL;
