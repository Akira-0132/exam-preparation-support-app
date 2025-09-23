-- 本番環境用：開発用の危険なRLSポリシーを削除し、安全な最小権限ポリシーのみを残す

-- 開発用の全許可ポリシーを削除（存在すれば）
DROP POLICY IF EXISTS "Temporary allow all for development" ON user_profiles;
DROP POLICY IF EXISTS "Temporary allow all for classes" ON classes;
DROP POLICY IF EXISTS "Temporary allow all for test_periods" ON test_periods;
DROP POLICY IF EXISTS "Temporary allow all for tasks" ON tasks;

-- user_profiles: 自分のプロフィールにのみアクセスできる包括ポリシー
CREATE POLICY IF NOT EXISTS "Users can only access own profile" ON user_profiles
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- tasks: 自分に割り当て/自分が作成したタスクのみ参照可能
CREATE POLICY IF NOT EXISTS "Users can select own tasks" ON tasks
    FOR SELECT USING (assigned_to = auth.uid() OR created_by = auth.uid());

-- tasks: 先生は自分が作成したタスクを管理可能
CREATE POLICY IF NOT EXISTS "Teachers can manage created tasks" ON tasks
    FOR ALL USING (created_by = auth.uid());

-- tasks: 生徒は自分に割り当てられたタスクのみ更新可能
CREATE POLICY IF NOT EXISTS "Students can update assigned tasks" ON tasks
    FOR UPDATE USING (assigned_to = auth.uid());

-- test_periods: 自分の学年/クラスに関連、または自分が作成したものを参照
CREATE POLICY IF NOT EXISTS "Users can access relevant test periods" ON test_periods
    FOR SELECT USING (
        created_by = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
              AND up.grade_id = test_periods.grade_id
        )
    );

-- test_periods: 作成者は管理可能
CREATE POLICY IF NOT EXISTS "Teachers can manage test periods" ON test_periods
    FOR ALL USING (created_by = auth.uid());

-- classes: 担任または所属生徒のみ参照
CREATE POLICY IF NOT EXISTS "Users can access relevant classes" ON classes
    FOR SELECT USING (
        teacher_id = auth.uid() OR 
        auth.uid() = ANY(student_ids)
    );

-- classes: 担任は管理可能
CREATE POLICY IF NOT EXISTS "Teachers can manage their classes" ON classes
    FOR ALL USING (teacher_id = auth.uid());


