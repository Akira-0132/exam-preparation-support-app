-- ゴリラさんのgrade_idでフィルタされるテスト期間
SELECT 
  tp.id,
  tp.title,
  tp.grade_id,
  tp.start_date,
  tp.end_date,
  tp.created_at
FROM test_periods tp
WHERE tp.grade_id = '3d464dcc-957b-4fc8-8131-1abae665a70a'
  AND tp.deleted_at IS NULL
ORDER BY tp.created_at DESC;

-- ゴリラさんのタスクが紐付いているテスト期間のgrade_id
SELECT DISTINCT
  tp.id as period_id,
  tp.title as period_title,
  tp.grade_id as period_grade_id,
  '3d464dcc-957b-4fc8-8131-1abae665a70a' as gorira_grade_id,
  CASE 
    WHEN tp.grade_id = '3d464dcc-957b-4fc8-8131-1abae665a70a' THEN 'MATCH ✅'
    ELSE 'MISMATCH ❌'
  END as match_status
FROM tasks t
JOIN test_periods tp ON t.test_period_id = tp.id
WHERE t.assigned_to = 'd5423a30-9946-49ba-ad0f-81a9e84dbf2a';

-- 問題のテスト期間の詳細
SELECT 
  tp.id,
  tp.title,
  tp.grade_id,
  g.grade_number,
  g.school_id,
  s.name as school_name
FROM test_periods tp
LEFT JOIN grades g ON tp.grade_id = g.id
LEFT JOIN schools s ON g.school_id = s.id
WHERE tp.id = 'a9bc721c-de80-47e5-a268-408f8badee07';

-- ゴリラさんのgrade情報
SELECT 
  g.id as grade_id,
  g.grade_number,
  g.school_id,
  s.name as school_name
FROM grades g
LEFT JOIN schools s ON g.school_id = s.id
WHERE g.id = '3d464dcc-957b-4fc8-8131-1abae665a70a';

