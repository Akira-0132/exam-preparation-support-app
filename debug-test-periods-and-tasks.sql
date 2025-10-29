-- 1. ゴリラさんのテスト期間を確認
SELECT 
  tp.id,
  tp.title,
  tp.created_at,
  tp.start_date,
  tp.end_date,
  tp.grade_id,
  g.grade_number,
  s.name as school_name
FROM test_periods tp
LEFT JOIN grades g ON tp.grade_id = g.id
LEFT JOIN schools s ON g.school_id = s.id
WHERE tp.grade_id = '3d464dcc-957b-4fc8-8131-1abae665a70a'
  AND tp.deleted_at IS NULL
ORDER BY tp.created_at DESC;

-- 2. ゴリラさんのタスクを確認
SELECT 
  t.id,
  t.title,
  t.subject,
  t.status,
  t.created_at,
  t.test_period_id,
  tp.title as period_title
FROM tasks t
LEFT JOIN test_periods tp ON t.test_period_id = tp.id
WHERE t.assigned_to = 'd5423a30-9946-49ba-ad0f-81a9e84dbf2a'
ORDER BY t.created_at DESC
LIMIT 10;

-- 3. mytimer0118さんのテスト期間を確認
SELECT 
  tp.id,
  tp.title,
  tp.created_at,
  tp.grade_id,
  g.grade_number,
  s.name as school_name
FROM test_periods tp
LEFT JOIN grades g ON tp.grade_id = g.id
LEFT JOIN schools s ON g.school_id = s.id
WHERE tp.grade_id = 'e00c8729-43d2-4a86-aa5d-b6b2215665ae'
  AND tp.deleted_at IS NULL
ORDER BY tp.created_at DESC;

-- 4. mytimer0118さんのタスクを確認
SELECT 
  t.id,
  t.title,
  t.subject,
  t.status,
  t.created_at,
  t.test_period_id
FROM tasks t
WHERE t.assigned_to = '2eb290dc-4a1b-48fc-abfd-6b0fad1a32a5'
ORDER BY t.created_at DESC
LIMIT 10;

