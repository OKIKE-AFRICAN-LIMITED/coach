-- Optional: Supabase pg_cron + pg_net extension to automatically trigger push reminders every minute
-- Note: pg_cron and pg_net can be enabled in Supabase Dashboard > Database > Extensions

-- Enable required extensions if available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Scheduled job that calls the /api/public/send-reminders endpoint every minute
-- Replace https://your-domain.com with your deployed domain or Vercel URL
-- (and optionally configure the Authorization header with your PUSH_CRON_SECRET)
/*
SELECT cron.schedule(
  'dispatch-task-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-domain.com/api/public/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ziri-push-secret-2026'
    ),
    body := '{}'::jsonb
  );
  $$
);
*/
