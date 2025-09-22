-- Add soft delete columns to test_periods
ALTER TABLE public.test_periods
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL;

-- Optional: indexes to speed up queries
CREATE INDEX IF NOT EXISTS idx_test_periods_deleted_at ON public.test_periods (deleted_at);
CREATE INDEX IF NOT EXISTS idx_test_periods_deleted_by ON public.test_periods (deleted_by);

-- Note: RLS policies may need updates to exclude deleted rows for non-admin users.
-- We intentionally do not modify existing policies here to avoid breaking behavior.

