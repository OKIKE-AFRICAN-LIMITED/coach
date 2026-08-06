import { createFileRoute } from "@tanstack/react-router";

// Simple in-memory audio cache to avoid redundant API calls for frequent responses
const audioCache = new Map<string, { buffer: ArrayBuffer; contentType: string }>();
const MAX_CACHE_SIZE = 50;

function getCachedAudio(text: string) {
  return audioCache.get(text.trim().toLowerCase());
}

function setCachedAudio(text: string, buffer: ArrayBuffer, contentType: string) {
  if (audioCache.size >= MAX_CACHE_SIZE) {
    const firstKey = audioCache.keys().next().value;
    if (firstKey) audioCache.delete(firstKey);
  }
  audioCache.set(text.trim().toLowerCase(), { buffer, contentType });
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

/** Synthesize via Google Cloud Text-to-Speech API (Neural2 voice) */
async function tryCloudTts(text: string, apiKey: string): Promise<Response | null> {
  try {
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: text.slice(0, 1_000) },
          voice: {
            languageCode: "en-US",
            name: "en-US-Neural2-F",
            ssmlGender: "FEMALE",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.0,
            pitch: 0.0,
          },
        }),
      },
    );

    if (!res.ok) return null;

    const data = (await res.json()) as { audioContent?: string };
    if (!data.audioContent) return null;

    const binary = atob(data.audioContent);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    setCachedAudio(text, bytes.buffer, "audio/mpeg");
    return new Response(bytes.buffer, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch {
    return null;
  }
}

/** Synthesize via Google Gemini TTS API */
async function tryGeminiTts(text: string, apiKey: string): Promise<Response | null> {
  try {
    let r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
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

    // If 429 Rate Limit, wait 600ms and retry once
    if (r.status === 429) {
      await new Promise((res) => setTimeout(res, 600));
      r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: text.slice(0, 600) }] }],
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
    }

    if (!r.ok) return null;

    const data = (await r.json()) as {
      candidates?: {
        content?: {
          parts?: { inlineData?: { data?: string } }[];
        };
      }[];
    };

    const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) return null;

    const wavBuffer = pcmToWav(inlineData.data);
    setCachedAudio(text, wavBuffer, "audio/wav");

    return new Response(wavBuffer, {
      headers: { "Content-Type": "audio/wav" },
    });
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cloudKey = process.env.GOOGLE_CLOUD_API_KEY;
        const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        const key = cloudKey || geminiKey;

        if (!key) return new Response("TTS not configured", { status: 500 });

        const { text } = (await request.json()) as { text?: string };
        if (!text || text.trim().length === 0)
          return new Response("Missing text", { status: 400 });

        // 1. Check in-memory cache
        const cached = getCachedAudio(text);
        if (cached) {
          return new Response(cached.buffer.slice(0), {
            headers: { "Content-Type": cached.contentType },
          });
        }

        // 2. Try Cloud Text-to-Speech API first (Neural2 voice)
        const cloudRes = await tryCloudTts(text, key);
        if (cloudRes) return cloudRes;

        // 3. Fallback to Gemini TTS API (Aoede voice)
        const geminiRes = await tryGeminiTts(text, key);
        if (geminiRes) return geminiRes;

        return new Response("TTS rate limited", { status: 429 });
      },
    },
  },
});