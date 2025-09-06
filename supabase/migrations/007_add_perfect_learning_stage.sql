-- learning_stageに'perfect'値を追加するためのマイグレーション
-- 既存のVARCHAR(20)フィールドに制約はないので、新しいマイグレーションは不要
-- ただし、型定義の整合性を保つためにコメントを追加

-- learning_stageの可能な値:
-- 'overview' - 1周目の概要学習
-- 'review' - 2周目の復習学習  
-- 'mastery' - 3周目の習熟学習
-- 'perfect' - 完璧チェック（3周目完了後）
