-- 問題のテスト期間の詳細情報
SELECT 
  tp.id,
  tp.title,
  tp.grade_id,
  tp.created_by,
  tp.created_at,
  g.grade_number,
  g.school_id,
  s.name as school_name,
  creator.display_name as created_by_name,
  creator.role as creator_role
FROM test_periods tp
LEFT JOIN grades g ON tp.grade_id = g.id
LEFT JOIN schools s ON g.school_id = s.id
LEFT JOIN user_profiles creator ON tp.created_by = creator.id
WHERE tp.id = 'a9bc721c-de80-47e5-a268-408f8badee07';

-- このテスト期間に紐付いているタスクの数
SELECT 
  COUNT(*) as total_tasks,
  COUNT(DISTINCT assigned_to) as unique_students
FROM tasks
WHERE test_period_id = 'a9bc721c-de80-47e5-a268-408f8badee07';

-- ゴリラさんとこのテスト期間のgrade_idを比較
SELECT 
  'ゴリラさんのgrade_id' as description,
  '3d464dcc-957b-4fc8-8131-1abae665a70a' as grade_id
UNION ALL
SELECT 
  'テスト期間のgrade_id' as description,
  grade_id
FROM test_periods
WHERE id = 'a9bc721c-de80-47e5-a268-408f8badee07';

