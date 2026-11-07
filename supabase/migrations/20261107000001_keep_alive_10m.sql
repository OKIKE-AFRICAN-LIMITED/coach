-- Update keep-alive cron to run every 10 minutes (* /10 * * * *)
-- This ensures:
-- 1. Render Python backend is pinged before the 15-minute inactivity timer, preventing sleep.
-- 2. Supabase receives frequent REST API traffic, preventing the 7-day pause.
-- 3. Any pending task alarms are processed promptly.

-- Unschedule old daily job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('daily-keep-alive');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule high-frequency keep-alive ping every 10 minutes
SELECT cron.schedule(
  'render-python-keep-alive',
  '*/10 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://coach-ziri.vercel.app/api/public/keep-alive'
  );
  $$
);

-- Check scheduled jobs:
-- SELECT jobid, jobname, schedule, active FROM cron.job;
