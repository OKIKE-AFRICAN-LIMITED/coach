import { createFileRoute } from "@tanstack/react-router";

/**
 * Converts raw PCM (L16 @ 24 kHz, mono, 16-bit) returned by Gemini TTS
 * into a valid WAV ArrayBuffer the browser can play natively.
 *
 * Uses only standard Web APIs (atob, DataView, Uint8Array) — NO Node.js
 * built-ins — so it runs safely in Nitro's Vite edge runner.
 */
function pcmToWav(base64Pcm: string, sampleRate = 24_000): ArrayBuffer {
  // Decode base64 → raw bytes
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

  // 44-byte WAV header + PCM payload
  const wavBuf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(wavBuf);

  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  // RIFF chunk descriptor
  str(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  str(8, "WAVE");
  // fmt sub-chunk
  str(12, "fmt ");
  view.setUint32(16, 16, true);          // sub-chunk size
  view.setUint16(20, 1, true);           // PCM = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // data sub-chunk
  str(36, "data");
  view.setUint32(40, dataLen, true);
  new Uint8Array(wavBuf).set(pcmBytes, 44);

  return wavBuf;
}

/**
 * Available Gemini TTS voices:
 *  Aoede   – warm, natural female  ← Alice's voice
 *  Kore    – soft, gentle female
 *  Charon  – calm, deep male
 *  Fenrir  – expressive male
 *  Puck    – playful, energetic male
 *  Leda    – young, bright female
 *  Orus    – authoritative male
 */
const ALICE_VOICE = "Aoede";

export const Route = createFileRoute("/api/public/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!key) return new Response("TTS not configured", { status: 500 });

        const { text } = (await request.json()) as { text?: string };
        if (!text || text.length === 0)
          return new Response("Missing text", { status: 400 });

        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: text.slice(0, 1_000) }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: ALICE_VOICE },
                  },
                },
              },
            }),
          },
        );

        if (!r.ok) return new Response(await r.text(), { status: r.status });

        const data = (await r.json()) as {
          candidates?: {
            content?: {
              parts?: { inlineData?: { data?: string; mimeType?: string } }[];
            };
          }[];
        };

        const inlineData =
          data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (!inlineData?.data)
          return new Response("No audio returned by Gemini", { status: 502 });

        // Convert PCM → WAV and return as audio/wav
        const wavBuffer = pcmToWav(inlineData.data);
        return new Response(wavBuffer, {
          headers: { "Content-Type": "audio/wav" },
        });
      },
    },
  },
});