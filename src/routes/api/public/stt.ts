import { createFileRoute } from "@tanstack/react-router";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {
  // ignore
}

/**
 * Server-side Speech-to-Text via Groq Whisper (`whisper-large-v3-turbo`).
 * Works reliably across all browsers & PWAs (iOS, Android, Brave, Chrome, Safari, Firefox)
 * without depending on browser-proprietary Web Speech API servers.
 */
export const Route = createFileRoute("/api/public/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);
        const rl = checkRateLimit(`stt:min:${ip}`, 25, 60_000);
        if (!rl.allowed) {
          return rateLimitResponse(rl.retryAfterSeconds, "Speech rate limit reached. Please pause a moment.");
        }

        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) {
          return Response.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
        }

        try {
          const formData = await request.formData();
          const audio = formData.get("audio");
          if (!(audio instanceof Blob) || audio.size === 0) {
            return Response.json({ error: "Missing audio file" }, { status: 400 });
          }
          if (audio.size > 10 * 1024 * 1024) {
            return Response.json({ error: "Audio clip too large (max 10MB)" }, { status: 413 });
          }

          const groqForm = new FormData();
          const ext = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : "webm";
          groqForm.append("file", audio, `speech.${ext}`);
          groqForm.append("model", "whisper-large-v3-turbo");
          groqForm.append("language", "en");
          groqForm.append("response_format", "json");

          const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${groqKey}`,
            },
            body: groqForm,
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error("[api/public/stt] Groq Whisper error:", res.status, errText);
            return Response.json({ error: "Transcription failed" }, { status: 502 });
          }

          const data = (await res.json()) as { text?: string };
          return Response.json({ text: (data.text ?? "").trim() });
        } catch (err) {
          console.error("[api/public/stt] Error:", err);
          return Response.json({ error: "Failed to process audio" }, { status: 500 });
        }
      },
    },
  },
});
