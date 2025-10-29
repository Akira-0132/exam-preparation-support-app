-- 最近作成されたテスト期間（直近5件）
SELECT 
  tp.id,
  tp.title,
  tp.created_at,
  tp.start_date,
  tp.end_date,
  tp.deleted_at,
  g.school_id,
  g.grade_number,
  s.name as school_name
FROM test_periods tp
LEFT JOIN grades g ON tp.grade_id = g.id
LEFT JOIN schools s ON g.school_id = s.id
WHERE tp.deleted_at IS NULL
ORDER BY tp.created_at DESC
LIMIT 5;

-- 最近作成されたタスク（直近10件）
SELECT 
  t.id,
  t.title,
  t.subject,
  t.status,
  t.created_at,
  t.test_period_id,
  t.assigned_to,
  u.display_name as student_name,
  u.email as student_email
FROM tasks t
LEFT JOIN user_profiles u ON t.assigned_to = u.id
ORDER BY t.created_at DESC
LIMIT 10;

-- ユーザープロフィール（student roleのみ、直近5件）
SELECT 
  id,
  email,
  display_name,
  role,
  grade_id,
  created_at
FROM user_profiles
WHERE role = 'student'
ORDER BY created_at DESC
LIMIT 5;

