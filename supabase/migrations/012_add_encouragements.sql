-- 励ましスタンプ機能用のテーブル
CREATE TABLE public.encouragements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    stamp_type TEXT NOT NULL, -- 'great_job', 'keep_it_up', 'nice_effort' などの識別子
    message TEXT, -- オプショナルなメッセージ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT false
);

-- RLS (Row Level Security) を有効化
ALTER TABLE public.encouragements ENABLE ROW LEVEL SECURITY;

-- 先生は自分が送ったスタンプを閲覧できる
CREATE POLICY "Teachers can view stamps they sent"
ON public.encouragements FOR SELECT
USING (teacher_id = auth.uid());

-- 生徒は自分宛のスタンプを閲覧できる
CREATE POLICY "Students can view stamps sent to them"
ON public.encouragements FOR SELECT
USING (student_id = auth.uid());

-- 先生は担当生徒にスタンプを送ることができる
CREATE POLICY "Teachers can insert stamps for their students"
ON public.encouragements FOR INSERT
WITH CHECK (teacher_id = auth.uid());

-- 生徒は自分のスタンプを既読に更新できる
CREATE POLICY "Students can update their stamps to read"
ON public.encouragements FOR UPDATE
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- インデックス作成
CREATE INDEX idx_encouragements_teacher_id ON public.encouragements(teacher_id);
CREATE INDEX idx_encouragements_student_id ON public.encouragements(student_id);
