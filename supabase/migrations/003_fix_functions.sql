-- Drop functions with CASCADE to remove ALL dependencies at once
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.update_progress_on_task_change() CASCADE;

-- Create updated_at trigger function with proper search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers only for tables that exist
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_periods_updated_at
    BEFORE UPDATE ON test_periods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add triggers for other tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'progress') THEN
        CREATE TRIGGER update_progress_updated_at
            BEFORE UPDATE ON progress
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schedules') THEN
        CREATE TRIGGER update_schedules_updated_at
            BEFORE UPDATE ON schedules
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can create own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Teachers can view students" ON user_profiles;
DROP POLICY IF EXISTS "Temporary allow all for development" ON user_profiles;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON user_profiles;
DROP POLICY IF EXISTS "Enable insert for all users" ON user_profiles;

-- Create simple development policies for user_profiles (allow all operations)
CREATE POLICY "Allow all for authenticated users" ON user_profiles
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Policies for other tables
DROP POLICY IF EXISTS "Temporary allow all for classes" ON classes;
DROP POLICY IF EXISTS "Enable all for authenticated users on classes" ON classes;

CREATE POLICY "Allow all for classes" ON classes
    FOR ALL 
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Temporary allow all for test_periods" ON test_periods;
DROP POLICY IF EXISTS "Enable all for authenticated users on test_periods" ON test_periods;

CREATE POLICY "Allow all for test_periods" ON test_periods
    FOR ALL 
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Temporary allow all for tasks" ON tasks;
DROP POLICY IF EXISTS "Enable all for authenticated users on tasks" ON tasks;

CREATE POLICY "Allow all for tasks" ON tasks
    FOR ALL 
    USING (true)
    WITH CHECK (true);