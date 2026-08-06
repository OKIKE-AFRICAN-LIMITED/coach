import { createFileRoute } from "@tanstack/react-router";

// In-memory audio cache so repeated or identical phrases respond in 0ms
const audioCache = new Map<string, ArrayBuffer>();
const MAX_CACHE_SIZE = 100;

function getCachedAudio(text: string): ArrayBuffer | undefined {
  return audioCache.get(text.trim().toLowerCase());
}

function setCachedAudio(text: string, buffer: ArrayBuffer) {
  if (audioCache.size >= MAX_CACHE_SIZE) {
    const firstKey = audioCache.keys().next().value;
    if (firstKey) audioCache.delete(firstKey);
  }
  audioCache.set(text.trim().toLowerCase(), buffer);
}

/**
 * Converts raw PCM (L16 @ 24 kHz, mono, 16-bit) returned by Gemini TTS
 * into a valid WAV ArrayBuffer the browser can play natively.
 */
function pcmToWav(base64Pcm: string, sampleRate = 24_000): ArrayBuffer {
  const binary = atob(base64Pcm);
  const pcmBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    pcmBytes[i] = binary.charCodeAt(i);
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataLen = pcmBytes.length;

  const wavBuf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(wavBuf);

  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  str(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  str(36, "data");
  view.setUint32(40, dataLen, true);
  new Uint8Array(wavBuf).set(pcmBytes, 44);

  return wavBuf;
}

/** Synthesize via Gemini Flash TTS API using smooth "Aoede" voice */
async function fetchGeminiAudio(
  text: string,
  apiKey: string,
): Promise<{ buffer: ArrayBuffer | null; lastError: string }> {
  const models = [
    "gemini-2.5-flash-preview-tts",
    "gemini-2.0-flash-exp",
  ];

  let lastError = "";

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: text.slice(0, 800) }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Aoede" },
                },
              },
            },
          }),
        },
      );

      if (!res.ok) {
        lastError = `Model ${model} returned HTTP ${res.status}: ${await res.text()}`;
        console.error("Gemini TTS fetch error:", lastError);
        continue;
      }

      const data = (await res.json()) as {
        candidates?: {
          content?: {
            parts?: { inlineData?: { data?: string } }[];
          };
        }[];
      };

      const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (inlineData?.data) {
        return { buffer: pcmToWav(inlineData.data), lastError: "" };
      }
    } catch (e) {
      lastError = String(e);
      console.error("Gemini TTS exception:", e);
    }
  }

  return { buffer: null, lastError };
}

export const Route = createFileRoute("/api/public/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!key) return new Response("TTS not configured", { status: 500 });

        const { text } = (await request.json()) as { text?: string };
        if (!text || text.trim().length === 0)
          return new Response("Missing text", { status: 400 });

        const cleanText = text.trim();

        // 1. Check in-memory cache
        const cached = getCachedAudio(cleanText);
        if (cached) {
          return new Response(cached.slice(0), {
            headers: { "Content-Type": "audio/wav" },
          });
        }

        // 2. Fetch smooth Aoede audio from Gemini
        const { buffer, lastError } = await fetchGeminiAudio(cleanText, key);
        if (!buffer) {
          return new Response(`TTS Error: ${lastError || "Could not generate audio"}`, {
            status: 502,
          });
        }

        setCachedAudio(cleanText, buffer);
        return new Response(buffer, {
          headers: { "Content-Type": "audio/wav" },
        });
      },
    },
  },
});