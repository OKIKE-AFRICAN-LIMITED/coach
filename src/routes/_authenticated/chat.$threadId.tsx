import { createFileRoute } from "@tanstack/react-router";

// ─── Web Speech API types (not exposed through vite/client global types) ────
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => ISpeechRecognition;
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { getThreadMessages } from "@/lib/threads.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Mic, Square, Volume2, VolumeX, Phone, PhoneOff } from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const SILENT_AUDIO_SRC =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAA==";

/** Unlocks the audio element for autoplay (required on iOS / strict browsers). */
async function primeAudioElement(audio: HTMLAudioElement) {
  audio.setAttribute("playsinline", "true");
  audio.preload = "auto";
  audio.muted = true;
  audio.src = SILENT_AUDIO_SRC;
  audio.load();
  try {
    await audio.play();
    audio.dataset.primed = "1";
  } catch {
    delete audio.dataset.primed;
  }
  audio.pause();
  audio.currentTime = 0;
  audio.muted = false;
}

/** Returns the browser's SpeechRecognition constructor (handles webkit prefix). */
function getSR(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SpeechRecognitionCtor | null;
}

// ─── Real-time Mic Volume Analyzer Hook ─────────────────────────────────────

function useMicVolume(enabled: boolean) {
  const [volume, setVolume] = useState(0); // 0 to 1

  useEffect(() => {
    if (!enabled) {
      setVolume(0);
      return;
    }
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let animId: number;

    async function setup() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        const AC =
          window.AudioContext ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).webkitAudioContext;
        audioCtx = new AC();
        if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Scale avg (0..255) to 0..1 with sensitivity curve
          const norm = Math.min(1, avg / 60);
          setVolume(norm);
          animId = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setVolume(0);
      }
    }

    void setup();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioCtx && audioCtx.state !== "closed") void audioCtx.close();
      setVolume(0);
    };
  }, [enabled]);

  return volume;
}

// ─── Voice Equalizer / Waveform Visualizer Component ────────────────────────

function VoiceVisualizer({
  active,
  recording,
  callActive,
  callState,
  micVolume,
}: {
  active: boolean;
  recording: boolean;
  callActive: boolean;
  callState: "idle" | "listening" | "thinking" | "speaking";
  micVolume: number;
}) {
  const [ticker, setTicker] = useState(0);

  // Force tick animation for AI speaking/thinking modes
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTicker((t) => (t + 1) % 100), 80);
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;

  let statusText = "Listening…";
  let statusBadge = "Quiet";
  let badgeColor = "bg-muted text-muted-foreground border-border";

  if (recording || (callActive && callState === "listening")) {
    if (micVolume > 0.25) {
      statusBadge = "Audible ✓";
      badgeColor = "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    } else if (micVolume > 0.05) {
      statusBadge = "Low Sound";
      badgeColor = "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30";
    } else {
      statusBadge = "Silent";
      badgeColor = "bg-zinc-500/20 text-zinc-500 border-zinc-500/30";
    }
  } else if (callState === "thinking") {
    statusText = "Thinking…";
    statusBadge = "Processing";
    badgeColor = "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30";
  } else if (callState === "speaking") {
    statusText = "Alice speaking";
    statusBadge = "Audio Output";
    badgeColor = "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30";
  }

  const bars = [0.5, 0.95, 1.0, 0.8, 0.6];

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-background/95 border shadow-sm text-xs font-medium animate-in fade-in slide-in-from-bottom-2">
      {/* Equalizer bars */}
      <div className="flex items-center gap-1 h-4 w-7 justify-center">
        {bars.map((factor, i) => {
          let heightPercent = 20;
          if (callState === "speaking") {
            heightPercent = 25 + Math.abs(Math.sin((ticker / 2) + i)) * 75;
          } else if (callState === "thinking") {
            heightPercent = 30 + Math.abs(Math.cos((ticker / 3) + i)) * 40;
          } else {
            heightPercent = Math.max(15, Math.min(100, micVolume * 100 * factor * 1.6));
          }

          return (
            <span
              key={i}
              className={`w-1 rounded-full transition-all duration-75 ${
                callState === "speaking"
                  ? "bg-purple-500"
                  : callState === "thinking"
                    ? "bg-blue-500 animate-pulse"
                    : micVolume > 0.2
                      ? "bg-emerald-500"
                      : micVolume > 0.05
                        ? "bg-amber-500"
                        : "bg-muted-foreground/30"
              }`}
              style={{ height: `${heightPercent}%` }}
            />
          );
        })}
      </div>

      <span className="truncate max-w-[110px] text-xs font-medium">{statusText}</span>

      <span
        className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide transition-colors ${badgeColor}`}
      >
        {statusBadge}
      </span>
    </div>
  );
}

// ─── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  component: ChatThreadPage,
});

function ChatThreadPage() {
  const { threadId } = Route.useParams();
  return <ChatWindow key={threadId} threadId={threadId} />;
}

function ChatWindow({ threadId }: { threadId: string }) {
  const getMsgs = useServerFn(getThreadMessages);
  const msgsQ = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: () => getMsgs({ data: { threadId } }),
  });

  const initial = useMemo<UIMessage[]>(
    () =>
      (msgsQ.data ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts as UIMessage["parts"],
      })),
    [msgsQ.data],
  );

  if (msgsQ.isLoading) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Loading conversation…
      </div>
    );
  }

  return <Chat threadId={threadId} initial={initial} />;
}

// ─── Main Chat Component ─────────────────────────────────────────────────────

function Chat({
  threadId,
  initial,
}: {
  threadId: string;
  initial: UIMessage[];
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          return {
            body: { messages, threadId },
            headers: data.session?.access_token
              ? { Authorization: `Bearer ${data.session.access_token}` }
              : undefined,
          };
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => toast.error(e.message),
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  const isLoading = status === "submitted" || status === "streaming";

  // ── Call mode refs & helpers ───────────────────────────────────────────────
  const [callActive, setCallActive] = useState(false);
  const [callState, setCallState] = useState<
    "idle" | "listening" | "thinking" | "speaking"
  >("idle");

  const callActiveRef = useRef(false);
  const callStateRef = useRef<"idle" | "listening" | "thinking" | "speaking">("idle");
  const callRecRef = useRef<ISpeechRecognition | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setCallStateSynced = useCallback(
    (s: "idle" | "listening" | "thinking" | "speaking") => {
      callStateRef.current = s;
      setCallState(s);
    },
    [],
  );

  /** Starts one SpeechRecognition session. On end, re-arms itself unless stopped. */
  const startListening = useCallback(() => {
    if (!callActiveRef.current) return;
    if (callStateRef.current === "speaking" || callStateRef.current === "thinking") return;

    const SR = getSR();
    if (!SR) return;

    // Abort any previous instance before creating a new one
    try {
      if (callRecRef.current) {
        callRecRef.current.abort();
      }
    } catch { /* ignore */ }
    callRecRef.current = null;

    const r = new SR();
    r.continuous = false;       // one utterance → natural pauses trigger onend
    r.interimResults = true;    // enables barge-in detection on interim results
    r.lang = "en-US";

    r.onresult = async (e: SpeechRecognitionEvent) => {
      // Barge-in: stop TTS the moment we detect speech
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }

      const last = e.results[e.results.length - 1];
      if (!last.isFinal) return; // interim result — keep waiting

      const text = last[0].transcript.trim();
      if (!text) return;

      setCallStateSynced("thinking");
      try { r.abort(); } catch { /* ignore */ }
      callRecRef.current = null;

      try {
        await sendMessage({ text });
      } catch {
        setCallStateSynced("listening");
        setTimeout(() => startListening(), 400);
      }
    };

    r.onend = () => {
      callRecRef.current = null; // mark as dead so watchdog can detect it
      if (!callActiveRef.current) return;
      const state = callStateRef.current;
      if (state === "thinking" || state === "speaking") return;
      // no-speech timeout or silence — restart quickly
      setTimeout(() => startListening(), 250);
    };

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      callRecRef.current = null; // mark dead on error
      if (!callActiveRef.current || e.error === "aborted" || e.error === "no-speech") return;
      if (e.error === "network") {
        setTimeout(() => startListening(), 800);
        return;
      }
      toast.error(`Mic error: ${e.error}`);
    };

    callRecRef.current = r;
    try {
      r.start();
      setCallStateSynced("listening");
    } catch {
      // If start failed, reset ref to null so watchdog/retry can pick it up
      callRecRef.current = null;
      setTimeout(() => startListening(), 400);
    }
  }, [sendMessage, setCallStateSynced]);

  // ── TTS: Gemini "Aoede" Neural Voice Playback ──────────────────────────────
  const [voiceOn, setVoiceOn] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spokenRef = useRef<Set<string>>(new Set());

  const speak = useCallback(async (text: string) => {
    // Show speaking indicator immediately while fetching audio
    if (callActiveRef.current) {
      setCallStateSynced("speaking");
    }

    try {
      const res = await fetch("/api/public/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        if (callActiveRef.current) {
          setCallStateSynced("listening");
          setTimeout(() => startListening(), 400);
        }
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current;
      if (!audio) {
        if (callActiveRef.current) {
          setCallStateSynced("listening");
          setTimeout(() => startListening(), 400);
        }
        return;
      }

      audio.src = url;
      audio.load();
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (callActiveRef.current) {
          setCallStateSynced("listening");
          setTimeout(() => startListening(), 400);
        }
      };

      // Abort mic before playing TTS so speaker audio isn't recorded as user input
      try { callRecRef.current?.abort(); } catch { /* ignore */ }
      callRecRef.current = null;

      await audio.play().catch(() => {
        if (callActiveRef.current) {
          setCallStateSynced("listening");
          setTimeout(() => startListening(), 400);
        }
      });
    } catch {
      if (callActiveRef.current) {
        setCallStateSynced("listening");
        setTimeout(() => startListening(), 400);
      }
    }
  }, [setCallStateSynced, startListening]);

  // Auto-speak new assistant messages when voice is on
  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;

    // Extract text parts
    const text = last.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join(" ")
      .trim();

    // If message only contains tool calls (no text response yet), stay in thinking state
    if (!text) return;

    // Check if this text response has already been spoken
    if (spokenRef.current.has(last.id)) return;
    spokenRef.current.add(last.id);

    if (voiceOn) {
      void speak(text);
    } else if (callActiveRef.current) {
      // Voice off: resume listening in call mode
      setCallStateSynced("listening");
      setTimeout(() => startListening(), 400);
    }
  }, [messages, status, voiceOn, speak, setCallStateSynced, startListening]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // ── STT: mic button (single utterance via Web Speech API) ─────────────────
  const [recording, setRecording] = useState(false);
  const micRef = useRef<ISpeechRecognition | null>(null);

  const startRecording = useCallback(() => {
    const SR = getSR();
    if (!SR) {
      toast.error("Microphone requires Chrome or Edge browser");
      return;
    }
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-US";

    r.onstart = () => setRecording(true);
    r.onend = () => setRecording(false);
    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      setRecording(false);
      if (e.error !== "aborted" && e.error !== "no-speech") {
        toast.error(`Microphone error: ${e.error}`);
      }
    };
    r.onresult = async (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript.trim();
      if (text) await sendMessage({ text });
    };

    micRef.current = r;
    try {
      r.start();
    } catch {
      toast.error("Could not start microphone");
      setRecording(false);
    }
  }, [sendMessage]);

  const stopRecording = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    setRecording(false);
  }, []);

  const stopCall = useCallback(() => {
    callActiveRef.current = false;
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
    try { callRecRef.current?.abort(); } catch { /* ignore */ }
    callRecRef.current = null;
    audioRef.current?.pause();
    setCallActive(false);
    setCallStateSynced("idle");
  }, [setCallStateSynced]);

  const startCall = useCallback(async () => {
    if (!getSR()) {
      toast.error("Call mode requires Chrome or Edge browser");
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    await primeAudioElement(audioRef.current); // unlock autoplay
    callActiveRef.current = true;
    setCallActive(true);
    startListening();

    // Watchdog: every 2.5 s, revive recognition if it silently died
    watchdogRef.current = setInterval(() => {
      if (
        callActiveRef.current &&
        callStateRef.current === "listening" &&
        callRecRef.current === null
      ) {
        startListening();
      }
    }, 2_500);
  }, [startListening]);

  // Restart listening after TTS finishes speaking during a call
  useEffect(() => {
    if (!callActive) return;
    const a = audioRef.current;
    if (!a) return;

    const onPlay = () => setCallStateSynced("speaking");
    const onEnded = () => {
      if (callActiveRef.current) {
        setCallStateSynced("listening");
        // Give browser a short breath before re-arming recognition
        setTimeout(() => startListening(), 400);
      }
    };

    a.addEventListener("play", onPlay);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("ended", onEnded);
    };
  }, [callActive, startListening, setCallStateSynced]);

  // Cleanup on unmount or thread change
  useEffect(() => () => stopCall(), [stopCall]);

  // ─── UI ───────────────────────────────────────────────────────────────────

  // Live microphone volume metering (active during mic recording or call listening)
  const isMicMeteringActive = recording || (callActive && callState === "listening");
  const micVolume = useMicVolume(isMicMeteringActive);

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Hidden audio element for TTS playback */}
      <audio
        ref={audioRef}
        preload="auto"
        className="h-0 w-0 opacity-0"
        tabIndex={-1}
      />

      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={
                <img
                  src="/logo.png"
                  alt="Coach Ziri Logo"
                  className="h-14 w-auto object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                />
              }
              title="Hi, I'm Coach Ziri"
              description="Talk or type. I can manage your tasks, analyze your day, check your calendar, and coordinate your schedule."
            />
          ) : (
            messages.map((m) => (
              <Message from={m.role === "user" ? "user" : "assistant"} key={m.id}>
                <MessageContent>
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      return m.role === "assistant" ? (
                        <MessageResponse key={i}>{part.text}</MessageResponse>
                      ) : (
                        <span key={i}>{part.text}</span>
                      );
                    }
                    if (
                      typeof part.type === "string" &&
                      part.type.startsWith("tool-")
                    ) {
                      const tp = part as {
                        type: `tool-${string}`;
                        state?:
                          | "input-streaming"
                          | "input-available"
                          | "output-available"
                          | "output-error";
                        input?: unknown;
                        output?: unknown;
                        errorText?: string;
                      };
                      return (
                        <Tool key={i} defaultOpen={false}>
                          <ToolHeader
                            type={tp.type}
                            state={tp.state ?? "output-available"}
                          />
                          <ToolContent>
                            {tp.input != null && <ToolInput input={tp.input} />}
                            {(tp.output != null || tp.errorText) && (
                              <ToolOutput
                                output={
                                  tp.output != null ? (
                                    <pre className="text-xs whitespace-pre-wrap">
                                      {JSON.stringify(tp.output, null, 2)}
                                    </pre>
                                  ) : null
                                }
                                errorText={tp.errorText}
                              />
                            )}
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Thinking…</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input bar */}
      <div className="border-t p-3">
        <PromptInput
          onSubmit={async (message) => {
            const text = message.text.trim();
            if (!text || isLoading) return;
            await sendMessage({ text });
          }}
          className="max-w-3xl mx-auto"
        >
          <PromptInputTextarea
            ref={textareaRef}
            placeholder={
              recording
                ? "Listening…"
                : callActive
                  ? callState === "speaking"
                    ? "Alice is speaking…"
                    : callState === "thinking"
                      ? "Thinking…"
                      : "Listening…"
                  : "Type or tap the mic to talk to Alice…"
            }
          />
          <PromptInputFooter className="justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Mic button (single utterance) */}
              <Button
                type="button"
                size="icon"
                variant={recording ? "destructive" : "ghost"}
                onClick={recording ? stopRecording : startRecording}
                disabled={isLoading || callActive}
                aria-label={recording ? "Stop recording" : "Start recording"}
                title={recording ? "Stop recording" : "Tap to speak"}
              >
                {recording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>

              {/* Speaker toggle */}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (voiceOn) audioRef.current?.pause();
                  setVoiceOn((v) => !v);
                }}
                aria-label={voiceOn ? "Mute Alice's voice" : "Unmute Alice's voice"}
                title={voiceOn ? "Voice on — click to mute" : "Voice muted — click to unmute"}
              >
                {voiceOn ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>

              {/* Call mode button */}
              <Button
                type="button"
                size="icon"
                variant={callActive ? "destructive" : "ghost"}
                onClick={callActive ? stopCall : startCall}
                disabled={recording}
                aria-label={callActive ? "End call" : "Start voice call with Alice"}
                title={callActive ? "End call" : "Start hands-free call with Alice"}
              >
                {callActive ? (
                  <PhoneOff className="h-4 w-4" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
              </Button>

              {/* Real-time Voice Equalizer & Sound Level Visualizer */}
              <VoiceVisualizer
                active={recording || callActive}
                recording={recording}
                callActive={callActive}
                callState={callState}
                micVolume={micVolume}
              />
            </div>

            <PromptInputSubmit status={status} disabled={isLoading} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
