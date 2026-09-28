-- Schedule daily keep-alive at 12:00 AM midnight (00:00 UTC)
-- This calls your app's /api/public/keep-alive endpoint every night.
-- When your app receives this request, it queries Supabase REST API, which resets the 7-day inactivity pause.

-- Replace 'https://your-deployed-domain.com' with your actual domain or Vercel URL
SELECT cron.schedule(
  'daily-keep-alive',
  '0 0 * * *',  -- At 00:00 (12:00 AM) every day
  $$
  SELECT net.http_get(
    url := 'https://coach-ziri.vercel.app/api/public/keep-alive'
  );
  $$
);

-- Helpful verification queries:
-- Check scheduled jobs:
-- SELECT jobid, jobname, schedule, active FROM cron.job;
--
-- Check recent execution logs:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
