-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ユーザープロファイル拡張テーブル
CREATE TABLE public.user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher')),
    class_id UUID NULL,
    grade INTEGER NULL,
    student_number VARCHAR(50) NULL,
    managed_class_ids UUID[] NULL,
    subject VARCHAR(100) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- クラステーブル
CREATE TABLE public.classes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    grade INTEGER NOT NULL,
    teacher_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    student_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- テスト期間テーブル
CREATE TABLE public.test_periods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    class_id UUID REFERENCES public.classes(id) NOT NULL,
    subjects TEXT[] NOT NULL,
    created_by UUID REFERENCES public.user_profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- タスクテーブル
CREATE TABLE public.tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    subject VARCHAR(100) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed')),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    estimated_time INTEGER NOT NULL, -- 分単位
    actual_time INTEGER NULL, -- 分単位
    test_period_id UUID REFERENCES public.test_periods(id) NOT NULL,
    assigned_to UUID REFERENCES public.user_profiles(id) NOT NULL,
    created_by UUID REFERENCES public.user_profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE NULL
);

-- 進捗テーブル
CREATE TABLE public.progress (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    test_period_id UUID REFERENCES public.test_periods(id) NOT NULL,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    total_estimated_time INTEGER DEFAULT 0,
    total_actual_time INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0.00,
    average_score DECIMAL(5,2) NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, test_period_id)
);

-- スケジュールテーブル
CREATE TABLE public.schedules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    date DATE NOT NULL,
    tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_planned_time INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- 通知テーブル
CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('task_reminder', 'deadline_warning', 'achievement', 'system')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_task_id UUID REFERENCES public.tasks(id) NULL,
    related_test_period_id UUID REFERENCES public.test_periods(id) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_classes_teacher_id ON public.classes(teacher_id);
CREATE INDEX idx_test_periods_class_id ON public.test_periods(class_id);
CREATE INDEX idx_test_periods_created_by ON public.test_periods(created_by);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_test_period_id ON public.tasks(test_period_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_progress_user_id ON public.progress(user_id);
CREATE INDEX idx_progress_test_period_id ON public.progress(test_period_id);
CREATE INDEX idx_schedules_user_id ON public.schedules(user_id);
CREATE INDEX idx_schedules_date ON public.schedules(date);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- Row Level Security (RLS) ポリシー設定
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ユーザープロファイルのRLSポリシー
CREATE POLICY "Users can view their own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- クラスのRLSポリシー
CREATE POLICY "Teachers can view their managed classes" ON public.classes
    FOR SELECT USING (
        teacher_id = auth.uid() OR 
        auth.uid() = ANY(student_ids)
    );

CREATE POLICY "Teachers can manage their classes" ON public.classes
    FOR ALL USING (teacher_id = auth.uid());

-- テスト期間のRLSポリシー
CREATE POLICY "Users can view test periods for their class" ON public.test_periods
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid() 
            AND (up.class_id = test_periods.class_id OR created_by = auth.uid())
        )
    );

CREATE POLICY "Teachers can manage test periods for their classes" ON public.test_periods
    FOR ALL USING (created_by = auth.uid());

-- タスクのRLSポリシー
CREATE POLICY "Users can view their assigned tasks" ON public.tasks
    FOR SELECT USING (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Teachers can manage tasks they created" ON public.tasks
    FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Students can update their assigned tasks" ON public.tasks
    FOR UPDATE USING (assigned_to = auth.uid());

-- 進捗のRLSポリシー
CREATE POLICY "Users can view their own progress" ON public.progress
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own progress" ON public.progress
    FOR ALL USING (user_id = auth.uid());

-- スケジュールのRLSポリシー
CREATE POLICY "Users can manage their own schedules" ON public.schedules
    FOR ALL USING (user_id = auth.uid());

-- 通知のRLSポリシー
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- トリガー関数: updated_atの自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_atトリガーの作成
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_test_periods_updated_at BEFORE UPDATE ON public.test_periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_progress_updated_at BEFORE UPDATE ON public.progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 進捗自動更新トリガー関数
CREATE OR REPLACE FUNCTION update_progress_on_task_change()
RETURNS TRIGGER AS $$
BEGIN
    -- タスクの完了状況が変わった場合、進捗テーブルを更新
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        -- 完了時にcompleted_atを設定
        IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            NEW.completed_at = NOW();
        ELSIF NEW.status != 'completed' THEN
            NEW.completed_at = NULL;
        END IF;
        
        -- 進捗テーブルの更新
        INSERT INTO public.progress (user_id, test_period_id, total_tasks, completed_tasks, total_estimated_time, total_actual_time, completion_rate)
        SELECT 
            NEW.assigned_to,
            NEW.test_period_id,
            COUNT(*) as total_tasks,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
            SUM(estimated_time) as total_estimated_time,
            SUM(COALESCE(actual_time, 0)) as total_actual_time,
            ROUND((COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / COUNT(*)) * 100, 2) as completion_rate
        FROM public.tasks 
        WHERE assigned_to = NEW.assigned_to AND test_period_id = NEW.test_period_id
        GROUP BY assigned_to, test_period_id
        ON CONFLICT (user_id, test_period_id) 
        DO UPDATE SET
            total_tasks = EXCLUDED.total_tasks,
            completed_tasks = EXCLUDED.completed_tasks,
            total_estimated_time = EXCLUDED.total_estimated_time,
            total_actual_time = EXCLUDED.total_actual_time,
            completion_rate = EXCLUDED.completion_rate,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 進捗自動更新トリガー
CREATE TRIGGER update_progress_on_task_change AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_progress_on_task_change();