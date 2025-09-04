-- タスクの階層構造をサポートするためのカラム追加
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_type VARCHAR(20) DEFAULT 'single' CHECK (task_type IN ('single', 'parent', 'subtask'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS total_units INTEGER; -- 総量（ページ数、問題数など）
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_units INTEGER DEFAULT 0; -- 完了した量
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS unit_type VARCHAR(20) DEFAULT 'pages' CHECK (unit_type IN ('pages', 'problems', 'hours', 'sections'));

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON public.tasks(task_type);

-- メインタスクの進捗を自動更新する関数
CREATE OR REPLACE FUNCTION update_parent_task_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- サブタスクが更新された場合、親タスクの進捗を再計算
  IF NEW.parent_task_id IS NOT NULL THEN
    UPDATE public.tasks 
    SET 
      completed_units = (
        SELECT COALESCE(SUM(completed_units), 0)
        FROM public.tasks 
        WHERE parent_task_id = NEW.parent_task_id
      ),
      status = CASE 
        WHEN (
          SELECT COALESCE(SUM(completed_units), 0)
          FROM public.tasks 
          WHERE parent_task_id = NEW.parent_task_id
        ) >= total_units THEN 'completed'
        WHEN (
          SELECT COUNT(*) 
          FROM public.tasks 
          WHERE parent_task_id = NEW.parent_task_id AND status = 'in_progress'
        ) > 0 THEN 'in_progress'
        ELSE 'not_started'
      END,
      updated_at = NOW()
    WHERE id = NEW.parent_task_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー作成
DROP TRIGGER IF EXISTS trigger_update_parent_task_progress ON public.tasks;
CREATE TRIGGER trigger_update_parent_task_progress
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_parent_task_progress();
