-- Add mode and visibility columns to test_periods
-- mode: 'solo' (student personal) | 'managed' (teacher-managed)
-- visibility: 'private' (owner only) | 'public' (class visible)

ALTER TABLE public.test_periods
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

-- Safety checks
ALTER TABLE public.test_periods
  ADD CONSTRAINT test_periods_mode_check CHECK (mode IN ('solo','managed'));

ALTER TABLE public.test_periods
  ADD CONSTRAINT test_periods_visibility_check CHECK (visibility IN ('private','public'));

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_test_periods_mode ON public.test_periods (mode);
CREATE INDEX IF NOT EXISTS idx_test_periods_visibility ON public.test_periods (visibility);

