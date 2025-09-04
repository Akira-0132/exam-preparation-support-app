-- RLSポリシーの修正とテーブルのアクセス権限設定

-- 既存のRLSポリシーを削除
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_profiles;

-- user_profilesテーブルのRLSを有効化
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 新しいRLSポリシーを作成
-- 認証されたユーザーは自分のプロファイルを挿入できる
CREATE POLICY "Users can create own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 認証されたユーザーは自分のプロファイルを表示できる
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

-- 認証されたユーザーは自分のプロファイルを更新できる
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- 教師は生徒のプロファイルを表示できる
CREATE POLICY "Teachers can view students" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles teacher
            WHERE teacher.id = auth.uid()
            AND teacher.role = 'teacher'
        )
    );

-- 存在するテーブルのみRLSを有効化
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 開発用：一時的にすべてのアクセスを許可（本番環境では削除すること）
CREATE POLICY "Temporary allow all for development" ON user_profiles
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Temporary allow all for classes" ON classes
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Temporary allow all for test_periods" ON test_periods
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Temporary allow all for tasks" ON tasks
    FOR ALL USING (true) WITH CHECK (true);