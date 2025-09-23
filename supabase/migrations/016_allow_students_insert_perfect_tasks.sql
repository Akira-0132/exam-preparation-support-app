-- Allow students to insert generated perfect-check tasks for themselves

DO $$ BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Students can insert perfect tasks" ON public.tasks;
    CREATE POLICY "Students can insert perfect tasks" ON public.tasks
      FOR INSERT
      WITH CHECK (
        assigned_to = auth.uid()
        AND parent_task_id IS NOT NULL
        AND learning_stage = 'perfect'
        AND cycle_number = 3
      );
  END IF;
END $$;


