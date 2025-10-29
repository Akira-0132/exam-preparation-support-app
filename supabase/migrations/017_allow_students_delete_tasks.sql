-- Allow students to delete tasks that are assigned to themselves (including distributed tasks)

DO $$ BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    -- cleanup if exists
    DROP POLICY IF EXISTS "Students can delete assigned tasks" ON public.tasks;
    
    CREATE POLICY "Students can delete assigned tasks" ON public.tasks
      FOR DELETE
      USING (assigned_to = auth.uid());
  END IF;
END $$;


