-- このテスト期間の詳細を確認
SELECT 
  tp.id,
  tp.title,
  tp.grade_id,
  tp.start_date,
  tp.end_date,
  tp.created_at,
  tp.deleted_at,
  g.grade_number,
  g.school_id,
  s.name as school_name
FROM test_periods tp
LEFT JOIN grades g ON tp.grade_id = g.id
LEFT JOIN schools s ON g.school_id = s.id
WHERE tp.id = 'a9bc721c-de80-47e5-a268-408f8badee07';

-- このテスト期間に誰がアサインされているか確認
SELECT DISTINCT
  u.id,
  u.email,
  u.display_name,
  u.grade_id,
  COUNT(t.id) as task_count
FROM tasks t
JOIN user_profiles u ON t.assigned_to = u.id
WHERE t.test_period_id = 'a9bc721c-de80-47e5-a268-408f8badee07'
GROUP BY u.id, u.email, u.display_name, u.grade_id;

-- ゴリラさんの現在のgrade_idと比較
SELECT 
  id,
  email,
  display_name,
  grade_id
FROM user_profiles
WHERE email = 'gorira@gmail.com';

