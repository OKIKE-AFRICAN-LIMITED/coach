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
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  getThreadMessages,
  listThreads,
  createThread,
  deleteThread,
  renameThread,
} from "@/lib/threads.functions";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mic,
  MicOff,
  Square,
  Volume2,
  VolumeX,
  Phone,
  PhoneOff,
  Sparkles,
  Minimize2,
  Hand,
  Plus,
  Trash2,
  Ghost,
  ChevronDown,
  ArrowLeft,
  MessageSquare,
  Edit2,
  Check,
  X,
} from "lucide-react";

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

/** Strips Markdown syntax so TTS speaks naturally without reading symbols. */
function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~#>-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
          const norm = Math.min(1, avg / 55);
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

// ─── Inline Voice Pill (When Modal is Minimized or Single-Mic Active) ──────

function VoiceVisualizer({
  active,
  recording,
  callActive,
  callState,
  micVolume,
  onExpandModal,
}: {
  active: boolean;
  recording: boolean;
  callActive: boolean;
  callState: "idle" | "listening" | "thinking" | "speaking";
  micVolume: number;
  onExpandModal?: () => void;
}) {
  const [ticker, setTicker] = useState(0);

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
      statusBadge = "Listening";
      badgeColor = "bg-[#D4AF37]/20 text-[#E5C185] border-[#D4AF37]/30";
    }
  } else if (callState === "thinking") {
    statusText = "Thinking…";
    statusBadge = "Processing";
    badgeColor = "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30";
  } else if (callState === "speaking") {
    statusText = "Coach Ziri speaking";
    statusBadge = "Live Audio";
    badgeColor = "bg-[#D4AF37]/20 text-[#E5C185] border-[#D4AF37]/40";
  }

  const bars = [0.5, 0.95, 1.0, 0.8, 0.6];

  return (
    <button
      type="button"
      onClick={onExpandModal}
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-background/95 border border-[#D4AF37]/30 shadow-sm text-xs font-medium animate-in fade-in slide-in-from-bottom-2 hover:border-[#D4AF37] transition-all cursor-pointer"
      title={callActive ? "Click to open full Voice Conversation view" : undefined}
    >
      <div className="flex items-center gap-1 h-4 w-7 justify-center">
        {bars.map((factor, i) => {
          let heightPercent = 20;
          if (callState === "speaking") {
            heightPercent = 25 + Math.abs(Math.sin(ticker / 2 + i)) * 75;
          } else if (callState === "thinking") {
            heightPercent = 30 + Math.abs(Math.cos(ticker / 3 + i)) * 40;
          } else {
            heightPercent = Math.max(15, Math.min(100, micVolume * 100 * factor * 1.6));
          }

          return (
            <span
              key={i}
              className={`w-1 rounded-full transition-all duration-75 ${
                callState === "speaking"
                  ? "bg-[#D4AF37]"
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

      <span className="truncate max-w-[120px] text-xs font-medium">{statusText}</span>

      <span
        className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide transition-colors ${badgeColor}`}
      >
        {statusBadge}
      </span>
    </button>
  );
}

// ─── Full-Screen / Immersive Luxury Voice Conversation Modal ────────────────

function VoiceCallModal({
  open,
  callState,
  micMuted,
  micVolume,
  liveTranscript,
  spokenText,
  activeToolName,
  onToggleMute,
  onInterrupt,
  onForceSend,
  onMinimize,
  onEndCall,
}: {
  open: boolean;
  callState: "idle" | "listening" | "thinking" | "speaking";
  micMuted: boolean;
  micVolume: number;
  liveTranscript: string;
  spokenText: string;
  activeToolName: string | null;
  onToggleMute: () => void;
  onInterrupt: () => void;
  onForceSend: () => void;
  onMinimize: () => void;
  onEndCall: () => void;
}) {
  const [ticker, setTicker] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTicker((x) => (x + 1) % 360), 60);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSeconds(0);
      return;
    }
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [open]);

  if (!open) return null;

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  // Dynamic orb scale based on mic volume or speaking state
  const dynamicScale =
    callState === "speaking"
      ? 1.08 + Math.abs(Math.sin(ticker / 4)) * 0.16
      : callState === "thinking"
        ? 1.0 + Math.sin(ticker / 6) * 0.06
        : micMuted
          ? 0.95
          : 1.0 + micVolume * 0.35;

  const stateHeadline = micMuted
    ? "Microphone Muted"
    : callState === "speaking"
      ? "Coach Ziri is speaking"
      : callState === "thinking"
        ? activeToolName
          ? `Executing ${activeToolName.replace(/_/g, " ")}…`
          : "Coach Ziri is thinking…"
        : "Listening to you…";

  const stateSubtext = micMuted
    ? "Tap Unmute below whenever you're ready to speak"
    : callState === "speaking"
      ? "Speak anytime or tap Interrupt to jump in"
      : callState === "thinking"
        ? "Analyzing your workspace & preparing response"
        : liveTranscript
          ? `"${liveTranscript}"`
          : "Speak naturally — I'm listening";

  const waveBars = Array.from({ length: 24 }, (_, idx) => idx);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#050507]/95 backdrop-blur-2xl text-[#F3F4F6] p-6 sm:p-10 animate-in fade-in duration-200 select-none overflow-hidden">
      {/* Subtle Ambient Gold Glows */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-[#D4AF37]/10 blur-[140px]" />

      {/* Top Header Bar */}
      <div className="relative z-10 w-full max-w-3xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#0F111A] border border-[#D4AF37]/40 flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <Sparkles className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-white">Coach Ziri Live</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {mins}:{secs}
              </span>
            </div>
            <p className="text-[11px] text-[#8A8F9E]">Hands-free Neural Voice Session</p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onMinimize}
          className="rounded-xl bg-[#0F111A] border-[#1F2336] text-xs text-[#A0A5B5] hover:text-white hover:border-[#D4AF37]/40 gap-1.5"
        >
          <Minimize2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Minimize to Chat</span>
        </Button>
      </div>

      {/* Center Neural Orb & Live Captions */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto max-w-2xl w-full text-center space-y-8 px-4">
        {/* Animated Concentric Aura Rings */}
        <div className="relative flex items-center justify-center h-56 w-56 sm:h-64 sm:w-64">
          {/* Outer Pulse Ring */}
          <div
            className={`absolute inset-0 rounded-full transition-transform duration-150 ${
              callState === "speaking"
                ? "border-2 border-[#D4AF37]/40 bg-[#D4AF37]/5 shadow-[0_0_80px_rgba(212,175,55,0.3)]"
                : callState === "thinking"
                  ? "border border-blue-400/30 bg-blue-500/5 animate-spin"
                  : "border border-[#D4AF37]/25 bg-[#D4AF37]/5"
            }`}
            style={{ transform: `scale(${dynamicScale * 1.15})` }}
          />

          {/* Middle Harmonic Ring */}
          <div
            className={`absolute inset-6 rounded-full transition-transform duration-100 ${
              callState === "speaking"
                ? "border border-[#F5E0A3]/50 bg-gradient-to-b from-[#D4AF37]/20 to-transparent"
                : callState === "thinking"
                  ? "border border-blue-400/40 bg-blue-500/10"
                  : "border border-emerald-400/30 bg-emerald-500/5"
            }`}
            style={{ transform: `scale(${dynamicScale})` }}
          />

          {/* Core Luxury Orb */}
          <div
            onClick={
              callState === "speaking"
                ? onInterrupt
                : callState === "listening" && liveTranscript.trim().length > 0
                  ? onForceSend
                  : undefined
            }
            className={`relative h-32 w-32 sm:h-36 sm:w-36 rounded-full flex flex-col items-center justify-center transition-all duration-150 shadow-[0_0_50px_rgba(212,175,55,0.35)] border ${
              callState === "speaking"
                ? "bg-gradient-to-br from-[#F5E0A3] via-[#D4AF37] to-[#8C6508] border-[#FFF3C4] cursor-pointer"
                : callState === "thinking"
                  ? "bg-gradient-to-br from-[#141829] via-[#0F111A] to-[#050507] border-blue-400/50"
                  : micMuted
                    ? "bg-[#141624] border-red-500/40"
                    : liveTranscript.trim().length > 0
                      ? "bg-gradient-to-br from-[#1B1810] via-[#0F111A] to-[#050507] border-emerald-400 cursor-pointer"
                      : "bg-gradient-to-br from-[#1B1810] via-[#0F111A] to-[#050507] border-[#D4AF37]/60"
            }`}
            style={{ transform: `scale(${Math.max(0.92, Math.min(1.18, dynamicScale))})` }}
          >
            <img
              src="/logo.png"
              alt="Coach Ziri"
              className={`h-14 w-auto object-contain transition-transform ${
                callState === "speaking" ? "brightness-110 scale-105" : " drop-shadow-[0_0_12px_rgba(212,175,55,0.5)]"
              }`}
            />
          </div>
        </div>

        {/* 24-Bar Equalizer Spectrum */}
        <div className="flex items-center justify-center gap-1 h-10 w-full max-w-xs">
          {waveBars.map((i) => {
            const centerDist = Math.abs(i - 11.5) / 11.5;
            const envelope = 1 - centerDist * 0.65;
            let barH = 14;
            if (callState === "speaking") {
              barH = 18 + Math.abs(Math.sin(ticker / 2.2 + i * 0.55)) * 82 * envelope;
            } else if (callState === "thinking") {
              barH = 16 + Math.abs(Math.cos(ticker / 4 + i * 0.4)) * 45 * envelope;
            } else if (!micMuted) {
              barH = Math.max(12, Math.min(100, micVolume * 145 * envelope * (0.7 + ((i * 7) % 5) * 0.1)));
            }
            return (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-75 ${
                  callState === "speaking"
                    ? "bg-gradient-to-t from-[#AA7C11] to-[#F5E0A3]"
                    : callState === "thinking"
                      ? "bg-blue-400/80"
                      : micMuted
                        ? "bg-red-500/30"
                        : micVolume > 0.08
                          ? "bg-emerald-400"
                          : "bg-[#D4AF37]/40"
                }`}
                style={{ height: `${barH}%` }}
              />
            );
          })}
        </div>

        {/* Status Headline & Live Transcript / Subtitles */}
        <div className="space-y-3 max-w-xl min-h-[96px] flex flex-col items-center justify-center">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#D4AF37] font-semibold">
            {stateHeadline}
          </span>

          {callState === "speaking" && spokenText ? (
            <p className="text-base sm:text-lg font-medium text-white/95 leading-relaxed line-clamp-4 animate-in fade-in">
              "{spokenText}"
            </p>
          ) : (
            <p
              className={`text-sm sm:text-base leading-relaxed transition-colors ${
                liveTranscript ? "text-emerald-300 font-medium" : "text-[#8A8F9E]"
              }`}
            >
              {stateSubtext}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Call Control Dock */}
      <div className="relative z-10 flex items-center justify-center gap-4 sm:gap-6 pb-2">
        {/* Mute / Unmute Mic */}
        <button
          type="button"
          onClick={onToggleMute}
          className={`h-14 w-14 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
            micMuted
              ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
              : "bg-[#0F111A] border-[#1F2336] text-white hover:border-[#D4AF37]/50 hover:bg-[#141624]"
          }`}
          title={micMuted ? "Unmute microphone" : "Mute microphone"}
          aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Interrupt / Tap to Speak (Active while Ziri is speaking) */}
        {callState === "speaking" && (
          <button
            type="button"
            onClick={onInterrupt}
            className="h-14 px-6 rounded-full flex items-center gap-2 bg-[#141624] border border-[#D4AF37]/50 text-[#F5E0A3] text-xs font-bold uppercase tracking-wider hover:bg-[#D4AF37] hover:text-black transition-all shadow-[0_0_25px_rgba(212,175,55,0.2)] cursor-pointer"
          >
            <Hand className="h-4 w-4" />
            <span>Interrupt</span>
          </button>
        )}

        {/* Tap to Send Immediately (Active when words are heard in noisy environments) */}
        {callState === "listening" && liveTranscript.trim().length > 0 && (
          <button
            type="button"
            onClick={onForceSend}
            className="h-14 px-6 rounded-full flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-[#050507] text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(16,185,129,0.35)] cursor-pointer animate-in fade-in"
            title="Send spoken words now"
          >
            <Sparkles className="h-4 w-4" />
            <span>Send Now</span>
          </button>
        )}

        {/* End Call Button */}
        <button
          type="button"
          onClick={onEndCall}
          className="h-14 px-7 rounded-full flex items-center gap-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:scale-105 transition-all cursor-pointer"
          title="End voice call"
        >
          <PhoneOff className="h-4 w-4" />
          <span>End Call</span>
        </button>
      </div>
    </div>
  );
}

// ─── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  component: ChatThreadPage,
});

function ChatThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const createT = useServerFn(createThread);
  const creatingRef = useRef(false);

  useEffect(() => {
    if (threadId === "new" && !creatingRef.current) {
      creatingRef.current = true;
      createT({ data: { title: "New chat" } })
        .then((t) => {
          navigate({ to: "/chat/$threadId", params: { threadId: t.id }, replace: true });
        })
        .catch(() => {
          creatingRef.current = false;
        });
    }
  }, [threadId, createT, navigate]);

  if (threadId === "new") {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-[#8A8F9E]">
        <Sparkles className="h-4 w-4 text-[#D4AF37] animate-spin mr-2" />
        Starting a fresh chat…
      </div>
    );
  }

  return <ChatWindow key={threadId} threadId={threadId} />;
}

function ChatWindow({ threadId }: { threadId: string }) {
  const isTemporary = threadId === "temp";
  const getMsgs = useServerFn(getThreadMessages);
  const msgsQ = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: () => (isTemporary ? Promise.resolve([]) : getMsgs({ data: { threadId } })),
    enabled: !isTemporary,
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

  if (!isTemporary && msgsQ.isLoading) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Loading conversation…
      </div>
    );
  }

  return <Chat threadId={threadId} initial={initial} isTemporary={isTemporary} />;
}

// ─── Main Chat Component ─────────────────────────────────────────────────────

function Chat({
  threadId,
  initial,
  isTemporary = false,
}: {
  threadId: string;
  initial: UIMessage[];
  isTemporary?: boolean;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listT = useServerFn(listThreads);
  const createT = useServerFn(createThread);
  const deleteT = useServerFn(deleteThread);
  const renameT = useServerFn(renameThread);

  const threadsQ = useQuery({
    queryKey: ["threads"],
    queryFn: () => listT(),
  });

  const currentThread = (threadsQ.data ?? []).find((t) => t.id === threadId);

  const handleStartNewChat = useCallback(async () => {
    try {
      const t = await createT({ data: { title: "New chat" } });
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
      toast.success("New conversation started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create new chat");
    }
  }, [createT, navigate, qc]);

  const handleDeleteCurrentThread = useCallback(async () => {
    if (isTemporary || !currentThread) return;
    if (!window.confirm(`Delete "${currentThread.title}"? This cannot be undone.`)) return;
    try {
      await deleteT({ data: { id: threadId } });
      qc.invalidateQueries({ queryKey: ["threads"] });
      toast.success("Conversation deleted");
      const remaining = (threadsQ.data ?? []).filter((t) => t.id !== threadId);
      if (remaining.length > 0) {
        navigate({ to: "/chat/$threadId", params: { threadId: remaining[0].id } });
      } else {
        handleStartNewChat();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete chat");
    }
  }, [isTemporary, currentThread, deleteT, threadId, qc, threadsQ.data, navigate, handleStartNewChat]);

  const handleExitTemporaryChat = useCallback(() => {
    const saved = (threadsQ.data ?? [])[0];
    if (saved) {
      navigate({ to: "/chat/$threadId", params: { threadId: saved.id } });
    } else {
      handleStartNewChat();
    }
  }, [threadsQ.data, navigate, handleStartNewChat]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          const headers: Record<string, string> = {};
          if (data.session?.access_token) {
            headers.Authorization = `Bearer ${data.session.access_token}`;
          }
          if (data.session?.provider_token) {
            headers["X-Google-Access-Token"] = data.session.provider_token;
          }
          return {
            body: { messages, threadId, isTemporary },
            headers: Object.keys(headers).length > 0 ? headers : undefined,
          };
        },
      }),
    [threadId, isTemporary],
  );

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => {
      console.error("[Coach Ziri Chat Error]:", e);
      if (e.message?.toLowerCase().includes("abort") || e.name === "AbortError") return;
      toast.error(e.message || "An error occurred.");
    },
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  // Auto-send initial prompt if launched from Top-Bar Command Search
  const initialSentRef = useRef(false);
  useEffect(() => {
    if (initialSentRef.current || status !== "ready") return;
    const key = `ziri_initial_prompt_${threadId}`;
    const pendingPrompt = sessionStorage.getItem(key);
    if (pendingPrompt) {
      sessionStorage.removeItem(key);
      initialSentRef.current = true;
      void sendMessage({ text: pendingPrompt });
    }
  }, [threadId, status, sendMessage]);

  const isLoading = status === "submitted" || status === "streaming";

  // ── Call mode refs & state ────────────────────────────────────────────────
  const [callActive, setCallActive] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [spokenText, setSpokenText] = useState("");
  const [callState, setCallState] = useState<
    "idle" | "listening" | "thinking" | "speaking"
  >("idle");

  const callActiveRef = useRef(false);
  const micMutedRef = useRef(false);
  const callStateRef = useRef<"idle" | "listening" | "thinking" | "speaking">("idle");
  const callRecRef = useRef<ISpeechRecognition | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTranscriptRef = useRef("");

  const setCallStateSynced = useCallback(
    (s: "idle" | "listening" | "thinking" | "speaking") => {
      callStateRef.current = s;
      setCallState(s);
    },
    [],
  );

  // Pre-seed spokenRef with initial message IDs so historical messages never auto-play on page load
  const [voiceOn, setVoiceOn] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spokenRef = useRef<Set<string>>(new Set(initial.map((m) => m.id)));

  /** Commits and sends the accumulated spoken transcript even if background music prevented isFinal */
  const commitSpokenTranscript = useCallback(
    async (rawText: string, startListeningFn: () => void) => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      const text = rawText.trim();
      if (!text || callStateRef.current === "thinking") return;

      pendingTranscriptRef.current = "";
      setLiveTranscript(text);
      setCallStateSynced("thinking");
      try {
        callRecRef.current?.abort();
      } catch {
        /* ignore */
      }
      callRecRef.current = null;

      try {
        await sendMessage({ text });
      } catch {
        setLiveTranscript("");
        setCallStateSynced("listening");
        setTimeout(() => startListeningFn(), 350);
      }
    },
    [sendMessage, setCallStateSynced],
  );

  /** Starts one SpeechRecognition session. On end, re-arms itself unless stopped or muted. */
  const startListening = useCallback(() => {
    if (!callActiveRef.current || micMutedRef.current) return;
    if (callStateRef.current === "speaking" || callStateRef.current === "thinking") return;

    const SR = getSR();
    if (!SR) return;

    try {
      if (callRecRef.current) {
        callRecRef.current.abort();
      }
    } catch { /* ignore */ }
    callRecRef.current = null;

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";

    r.onresult = async (e: SpeechRecognitionEvent) => {
      if (micMutedRef.current || callStateRef.current === "thinking") return;

      let combined = "";
      let hasFinal = false;
      for (let i = 0; i < e.results.length; i++) {
        combined += e.results[i][0].transcript + " ";
        if (e.results[i].isFinal) {
          hasFinal = true;
        }
      }
      const cleanCombined = combined.trim();
      if (!cleanCombined) return;

      pendingTranscriptRef.current = cleanCombined;
      setLiveTranscript(cleanCombined);

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      if (hasFinal) {
        // Browser detected a natural sentence end — wait 650ms in case user keeps talking, then send
        silenceTimerRef.current = setTimeout(() => {
          void commitSpokenTranscript(pendingTranscriptRef.current, startListening);
        }, 650);
      } else {
        // Even with background music preventing isFinal, auto-send after 1.7s of no new words!
        silenceTimerRef.current = setTimeout(() => {
          void commitSpokenTranscript(pendingTranscriptRef.current, startListening);
        }, 1700);
      }
    };

    r.onend = () => {
      callRecRef.current = null;
      if (!callActiveRef.current || micMutedRef.current) return;
      const state = callStateRef.current;
      if (state === "thinking" || state === "speaking") return;
      // If browser ended the session while we had buffered words (e.g. background noise timeout), send them!
      if (pendingTranscriptRef.current.trim().length > 0) {
        void commitSpokenTranscript(pendingTranscriptRef.current, startListening);
        return;
      }
      setTimeout(() => startListening(), 250);
    };

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      callRecRef.current = null;
      if (!callActiveRef.current || micMutedRef.current || e.error === "aborted" || e.error === "no-speech") return;
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
      callRecRef.current = null;
      setTimeout(() => startListening(), 400);
    }
  }, [commitSpokenTranscript, setCallStateSynced]);

  /** Browser native speechSynthesis fallback (picks the highest-quality Natural/Google voice for 0ms latency) */
  const speakWithBrowserFallback = useCallback(
    (cleanText: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        if (callActiveRef.current) {
          setCallStateSynced("listening");
          setTimeout(() => startListening(), 350);
        }
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find((v) => /natural|online/i.test(v.name) && /en/i.test(v.lang) && /aria|jenny|ava|sonia|libby|female/i.test(v.name)) ||
        voices.find((v) => /google uk english female|google us english/i.test(v.name)) ||
        voices.find((v) => /natural|online/i.test(v.name) && /en/i.test(v.lang)) ||
        voices.find((v) => /en/i.test(v.lang));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      utterance.rate = 1.04;
      utterance.pitch = 1.0;
      utterance.onend = () => {
        setSpokenText("");
        if (callActiveRef.current) {
          setCallStateSynced("listening");
          setTimeout(() => startListening(), 350);
        }
      };
      utterance.onerror = () => {
        setSpokenText("");
        if (callActiveRef.current) {
          setCallStateSynced("listening");
          setTimeout(() => startListening(), 350);
        }
      };
      window.speechSynthesis.speak(utterance);
    },
    [setCallStateSynced, startListening],
  );

  // ── TTS: Ultra-Low Latency Sentence Pipelining + 2.2s Fast Fallback ────────
  const speak = useCallback(
    async (rawText: string) => {
      const clean = cleanTextForSpeech(rawText);
      if (!clean) return;

      setLiveTranscript("");
      setSpokenText(clean);
      if (callActiveRef.current) {
        setCallStateSynced("speaking");
      }

      // Abort mic before playing TTS so speaker audio isn't recorded as user input
      try { callRecRef.current?.abort(); } catch { /* ignore */ }
      callRecRef.current = null;

      // Split into first sentence + remainder so the first sentence synthesizes 3x faster!
      const match = clean.match(/^(.+?[.!?]+)\s+([\s\S]+)$/);
      const firstChunk = match && match[1].length >= 18 ? match[1].trim() : clean;
      const restChunk = match && match[1].length >= 18 ? match[2].trim() : "";

      const fetchChunkBlob = async (chunkText: string, timeoutMs: number): Promise<Blob | null> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch("/api/public/tts", {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunkText }),
          });
          clearTimeout(timer);
          if (!res.ok) return null;
          return await res.blob();
        } catch {
          clearTimeout(timer);
          return null;
        }
      };

      // Start fetching restChunk in parallel while the short first sentence synthesizes quickly in Aoede voice!
      const restPromise = restChunk ? fetchChunkBlob(restChunk, 12000) : Promise.resolve(null);
      const firstBlob =
        prewarmedRef.current?.text === firstChunk
          ? (await prewarmedRef.current.promise) ?? (await fetchChunkBlob(firstChunk, 9000))
          : await fetchChunkBlob(firstChunk, 9000);
      prewarmedRef.current = null;

      if (!firstBlob || !audioRef.current) {
        speakWithBrowserFallback(clean);
        return;
      }

      const audio = audioRef.current;
      const firstUrl = URL.createObjectURL(firstBlob);
      audio.src = firstUrl;
      audio.load();

      audio.onended = async () => {
        URL.revokeObjectURL(firstUrl);
        if (restChunk) {
          const restBlob = await restPromise;
          if (restBlob && audioRef.current) {
            const restUrl = URL.createObjectURL(restBlob);
            audio.src = restUrl;
            audio.load();
            audio.onended = () => {
              URL.revokeObjectURL(restUrl);
              setSpokenText("");
              if (callActiveRef.current) {
                setCallStateSynced("listening");
                setTimeout(() => startListening(), 300);
              }
            };
            await audio.play().catch(() => {
              URL.revokeObjectURL(restUrl);
              speakWithBrowserFallback(restChunk);
            });
            return;
          } else {
            speakWithBrowserFallback(restChunk);
            return;
          }
        }
        setSpokenText("");
        if (callActiveRef.current) {
          setCallStateSynced("listening");
          setTimeout(() => startListening(), 300);
        }
      };

      await audio.play().catch(() => {
        URL.revokeObjectURL(firstUrl);
        speakWithBrowserFallback(clean);
      });
    },
    [setCallStateSynced, startListening, speakWithBrowserFallback],
  );

  // Pre-warm the first sentence audio WHILE the text is still streaming!
  const prewarmedRef = useRef<{ text: string; promise: Promise<Blob | null> } | null>(null);
  useEffect(() => {
    if (status !== "streaming" && status !== "submitted") return;
    if (!voiceOn && !callActiveRef.current) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || spokenRef.current.has(last.id)) return;

    const rawText = last.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join(" ")
      .trim();
    const clean = cleanTextForSpeech(rawText);
    const match = clean.match(/^(.+?[.!?]+)\s+/);
    if (match && match[1].length >= 18) {
      const firstSentence = match[1].trim();
      if (prewarmedRef.current?.text !== firstSentence) {
        prewarmedRef.current = {
          text: firstSentence,
          promise: fetch("/api/public/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: firstSentence }),
          })
            .then((r) => (r.ok ? r.blob() : null))
            .catch(() => null),
        };
      }
    }
  }, [messages, status, voiceOn]);

  // Auto-speak new assistant messages when voice is on or call is active
  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;

    const text = last.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join(" ")
      .trim();

    if (!text) return;

    if (spokenRef.current.has(last.id)) return;
    spokenRef.current.add(last.id);

    if (voiceOn || callActiveRef.current) {
      void speak(text);
    } else if (callActiveRef.current) {
      setCallStateSynced("listening");
      setTimeout(() => startListening(), 350);
    }
  }, [messages, status, voiceOn, speak, setCallStateSynced, startListening]);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

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
    micMutedRef.current = false;
    pendingTranscriptRef.current = "";
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
    try { callRecRef.current?.abort(); } catch { /* ignore */ }
    callRecRef.current = null;
    audioRef.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setCallActive(false);
    setCallModalOpen(false);
    setMicMuted(false);
    setLiveTranscript("");
    setSpokenText("");
    setCallStateSynced("idle");
  }, [setCallStateSynced]);

  const startCall = useCallback(async () => {
    if (!getSR()) {
      toast.error("Call mode requires Chrome or Edge browser");
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    await primeAudioElement(audioRef.current);
    callActiveRef.current = true;
    micMutedRef.current = false;
    setMicMuted(false);
    setLiveTranscript("");
    setSpokenText("");
    setCallActive(true);
    setCallModalOpen(true);
    startListening();

    watchdogRef.current = setInterval(() => {
      if (
        callActiveRef.current &&
        !micMutedRef.current &&
        callStateRef.current === "listening" &&
        callRecRef.current === null
      ) {
        startListening();
      }
    }, 2_500);
  }, [startListening]);

  const toggleMicMute = useCallback(() => {
    const next = !micMutedRef.current;
    micMutedRef.current = next;
    setMicMuted(next);
    if (next) {
      try { callRecRef.current?.abort(); } catch { /* ignore */ }
      callRecRef.current = null;
      setLiveTranscript("");
    } else if (callActiveRef.current && callStateRef.current === "listening") {
      startListening();
    }
  }, [startListening]);

  const interruptSpeech = useCallback(() => {
    audioRef.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpokenText("");
    if (callActiveRef.current) {
      setCallStateSynced("listening");
      setTimeout(() => startListening(), 200);
    }
  }, [setCallStateSynced, startListening]);

  // Cleanup on unmount or thread change
  useEffect(() => () => stopCall(), [stopCall]);

  // Detect any currently executing tool name for modal feedback
  const activeToolName = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return null;
    for (let i = last.parts.length - 1; i >= 0; i--) {
      const p = last.parts[i];
      if (typeof p.type === "string" && p.type.startsWith("tool-")) {
        return p.type.replace(/^tool-/, "");
      }
    }
    return null;
  }, [messages]);

  const forceSendTranscript = useCallback(() => {
    const text = pendingTranscriptRef.current || liveTranscript;
    if (text.trim()) {
      void commitSpokenTranscript(text, startListening);
    }
  }, [liveTranscript, commitSpokenTranscript, startListening]);

  // Live microphone volume metering — keep stream open during call so getUserMedia doesn't fight SpeechRecognition
  const isMicMeteringActive =
    recording || (callActive && !micMuted);
  const micVolume = useMicVolume(isMicMeteringActive);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Hidden audio element for TTS playback */}
      <audio
        ref={audioRef}
        preload="auto"
        className="h-0 w-0 opacity-0"
        tabIndex={-1}
      />

      {/* Top Chat Header: Thread Switcher, New Chat, Temporary Chat Toggle */}
      <div className="h-12 border-b border-border px-3 sm:px-4 flex items-center justify-between shrink-0 bg-background/90 dark:bg-[#090A10]/95 backdrop-blur-md z-10 transition-colors">
        {/* Left Controls */}
        <div className="flex items-center gap-2 min-w-0">
          {isTemporary ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold">
              <Ghost className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
              <span>Temporary Chat</span>
              <span className="hidden sm:inline text-[10px] text-amber-600/80 dark:text-amber-400/80 font-normal">
                (Unsaved)
              </span>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card/60 hover:bg-muted text-xs font-semibold text-foreground max-w-[170px] sm:max-w-xs truncate border border-border/80 hover:border-[#D4AF37]/50 transition-all text-left shadow-2xs"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[#D4AF37] shrink-0" />
                  <span className="truncate">{currentThread?.title || "Current Chat"}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-72 max-h-80 overflow-y-auto bg-popover border border-border text-popover-foreground shadow-lg p-1"
              >
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 flex items-center justify-between">
                  <span>Your Conversations</span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {threadsQ.data?.length ?? 0} saved
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                {(threadsQ.data ?? []).map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: t.id } })}
                    className={`flex items-center justify-between text-xs px-2.5 py-2 cursor-pointer rounded-lg transition-colors ${
                      t.id === threadId
                        ? "bg-[#D4AF37]/15 text-[#D4AF37] dark:text-[#F5E0A3] font-semibold border border-[#D4AF37]/30"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="truncate pr-2">{t.title}</span>
                    {t.id === threadId && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* New Chat Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleStartNewChat}
            className="h-7 px-2.5 text-xs rounded-lg border-border hover:border-[#D4AF37]/60 bg-background hover:bg-muted text-foreground transition-all flex items-center gap-1 shrink-0 shadow-2xs"
            title="Start a new chat thread"
          >
            <Plus className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span className="hidden sm:inline">New Chat</span>
          </Button>

          {/* Temporary Chat Toggle */}
          {isTemporary ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleExitTemporaryChat}
              className="h-7 px-2 text-xs rounded-lg border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-200 transition-all flex items-center gap-1 shrink-0"
              title="Exit temporary chat and return to saved chats"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-500" />
              <span className="hidden sm:inline">Exit Temp</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: "temp" } })}
              className="h-7 px-2 text-xs rounded-lg border-border hover:border-amber-500/60 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 shrink-0 shadow-2xs"
              title="Start a private, unsaved temporary chat session"
            >
              <Ghost className="h-3.5 w-3.5 text-amber-500" />
              <span className="hidden sm:inline">Temporary</span>
            </Button>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Voice Audio Mute Toggle */}
          <button
            type="button"
            onClick={() => {
              setVoiceOn((v) => !v);
              toast.info(!voiceOn ? "Voice audio responses enabled" : "Voice audio responses muted");
            }}
            className={`p-1.5 rounded-lg border transition-all ${
              voiceOn
                ? "bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37]"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title={voiceOn ? "Mute Coach Ziri's voice audio" : "Enable Coach Ziri's voice audio"}
          >
            {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>

          {/* Ultra-Low Latency Voice Call CTA */}
          <Button
            size="sm"
            onClick={callActive ? stopCall : startCall}
            className={`h-7 px-2.5 text-xs rounded-lg font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
              callActive
                ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
                : "bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-105 text-neutral-950 font-bold"
            }`}
          >
            {callActive ? <PhoneOff className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{callActive ? "End Call" : "Voice Call"}</span>
          </Button>

          {/* Delete Thread Button (only for saved threads) */}
          {!isTemporary && currentThread && (
            <button
              type="button"
              onClick={handleDeleteCurrentThread}
              className="p-1.5 rounded-lg border border-transparent hover:border-red-500/30 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all"
              title="Delete this conversation"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Temporary Chat Notice Banner */}
      {isTemporary && (
        <div className="mx-3 sm:mx-4 mt-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200/90 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Ghost className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="truncate text-[11px] sm:text-xs">
              <strong>Temporary Chat:</strong> Messages in this session will not be saved to your history.
            </span>
          </div>
          <button
            type="button"
            onClick={handleStartNewChat}
            className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 underline shrink-0 ml-2"
          >
            Switch to Saved
          </button>
        </div>
      )}

      {/* Full-Screen / Immersive Voice Call Modal */}
      <VoiceCallModal
        open={callActive && callModalOpen}
        callState={isLoading && callState !== "speaking" ? "thinking" : callState}
        micMuted={micMuted}
        micVolume={micVolume}
        liveTranscript={liveTranscript}
        spokenText={spokenText}
        activeToolName={activeToolName}
        onToggleMute={toggleMicMute}
        onInterrupt={interruptSpeech}
        onForceSend={forceSendTranscript}
        onMinimize={() => setCallModalOpen(false)}
        onEndCall={stopCall}
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
                    ? "Coach Ziri is speaking…"
                    : callState === "thinking"
                      ? "Thinking…"
                      : "Listening…"
                  : "Type or tap the mic to talk to Coach Ziri…"
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
                  if (voiceOn) {
                    audioRef.current?.pause();
                    if (typeof window !== "undefined" && "speechSynthesis" in window) {
                      window.speechSynthesis.cancel();
                    }
                  }
                  setVoiceOn((v) => !v);
                }}
                aria-label={voiceOn ? "Mute Coach Ziri's voice" : "Unmute Coach Ziri's voice"}
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
                aria-label={callActive ? "End call" : "Start voice call with Coach Ziri"}
                title={callActive ? "End call" : "Start hands-free call with Coach Ziri"}
              >
                {callActive ? (
                  <PhoneOff className="h-4 w-4" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
              </Button>

              {/* Real-time Voice Equalizer Pill (clicks to re-open modal if minimized) */}
              <VoiceVisualizer
                active={recording || callActive}
                recording={recording}
                callActive={callActive}
                callState={callState}
                micVolume={micVolume}
                onExpandModal={callActive ? () => setCallModalOpen(true) : undefined}
              />
            </div>

            <PromptInputSubmit status={status} disabled={isLoading} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
