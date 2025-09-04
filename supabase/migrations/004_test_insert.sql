-- Test direct insert to user_profiles table
-- This will help identify if the issue is with the table structure or RLS policies

-- First, check if the table exists and its structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Try to insert a test user profile directly (replace with actual auth.users id if needed)
-- Note: This is for testing only
INSERT INTO public.user_profiles (
    id,
    email,
    display_name,
    role
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid, -- Test UUID
    'direct_test@example.com',
    'Direct Test User',
    'student'
);

-- If successful, delete the test record
DELETE FROM public.user_profiles WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;