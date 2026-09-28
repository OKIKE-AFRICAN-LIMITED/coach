-- Add remind_at column to tasks for per-task reminder scheduling
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ;

-- Index for efficient reminder lookups
CREATE INDEX IF NOT EXISTS tasks_remind_at_idx ON public.tasks(user_id, remind_at)
  WHERE remind_at IS NOT NULL AND status = 'todo';
