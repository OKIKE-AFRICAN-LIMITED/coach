import { createClient } from "@supabase/supabase-js";

try {
  // Built into Node.js 20.6+
  // @ts-ignore
  process.loadEnvFile?.();
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function pingSupabase() {
  const timestamp = new Date().toLocaleString();
  console.log(`[${timestamp}] 🔄 Pinging Supabase to keep project active...`);

  try {
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error(`[${timestamp}] ❌ Ping error:`, error.message);
    } else {
      console.log(`[${timestamp}] ✅ Success! Supabase active. Profiles count:`, count);
    }
  } catch (err: any) {
    console.error(`[${timestamp}] ❌ Exception:`, err?.message || err);
  }
}

function scheduleNextMidnight() {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0
  );

  const msUntilMidnight = nextMidnight.getTime() - now.getTime();
  const hoursUntil = (msUntilMidnight / (1000 * 60 * 60)).toFixed(1);

  console.log(`⏳ Next keep-alive scheduled for 12:00 AM (in ~${hoursUntil} hours)`);

  setTimeout(async () => {
    await pingSupabase();
    // Schedule the next 12:00 AM
    scheduleNextMidnight();
  }, msUntilMidnight);
}

// 1. Ping immediately on start to verify connection
pingSupabase().then(() => {
  // 2. Schedule for 12:00 AM every night
  scheduleNextMidnight();
});
