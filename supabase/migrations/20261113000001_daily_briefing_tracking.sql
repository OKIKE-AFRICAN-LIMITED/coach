-- Track morning & evening daily briefing pushes per user in their local timezone
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS evening_push_time TEXT NOT NULL DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS timezone_offset_minutes INT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS last_morning_briefing_date DATE,
  ADD COLUMN IF NOT EXISTS last_evening_briefing_date DATE;

-- Optional Supabase pg_cron schedule (every 15 minutes) for /api/public/send-briefings:
-- SELECT cron.schedule(
--   'dispatch-daily-briefings',
--   '*/15 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://coach-ziri.okikeenterprises.com/api/public/send-briefings',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ziri-push-secret-2026'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
