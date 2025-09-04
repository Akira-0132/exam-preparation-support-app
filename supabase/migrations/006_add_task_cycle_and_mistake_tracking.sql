-- タスクに周回情報を追加
ALTER TABLE tasks ADD COLUMN cycle_number INTEGER DEFAULT 1;
ALTER TABLE tasks ADD COLUMN learning_stage VARCHAR(20) DEFAULT 'overview';

-- タスクの関連性を記録するテーブル
CREATE TABLE task_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  child_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  page_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 間違い記録テーブル
CREATE TABLE task_mistakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  problem_numbers INTEGER[], -- [2,4,7] のような配列
  cycle_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスを追加
CREATE INDEX idx_tasks_cycle_stage ON tasks(cycle_number, learning_stage);
CREATE INDEX idx_task_relationships_parent ON task_relationships(parent_task_id);
CREATE INDEX idx_task_relationships_child ON task_relationships(child_task_id);
CREATE INDEX idx_task_mistakes_task_id ON task_mistakes(task_id);
