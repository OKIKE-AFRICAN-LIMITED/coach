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
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type ToolUIPart,
  type UIMessage,
} from "ai";
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
  ShieldAlert,
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
  const [seconds, setSeconds] = useState(0);

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

  const statusLabel = micMuted
    ? "Muted"
    : callState === "speaking"
      ? "Speaking"
      : callState === "thinking"
        ? activeToolName
          ? `Running ${activeToolName.replace(/_/g, " ")}`
          : "Thinking"
        : "Listening";

  const statusPillClass = micMuted
    ? "bg-destructive/10 text-destructive border-destructive/30"
    : callState === "speaking"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30"
      : callState === "thinking"
        ? "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30"
        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background/95 backdrop-blur-xl text-foreground p-5 sm:p-8 animate-in fade-in duration-150 select-none">
      {/* Top Bar */}
      <div className="w-full max-w-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Coach Ziri" className="h-8 w-auto object-contain" />
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusPillClass}`}>
              {statusLabel}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {mins}:{secs}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onMinimize}
          className="gap-1.5 text-xs"
        >
          <Minimize2 className="h-3.5 w-3.5" />
          <span>Minimize</span>
        </Button>
      </div>

      {/* Center Status & Live Captions */}
      <div className="flex flex-col items-center justify-center my-auto max-w-xl w-full text-center space-y-6 px-2">
        <div className="relative flex items-center justify-center">
          <div
            className={`h-28 w-28 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-card shadow-sm ${
              micMuted
                ? "border-destructive/40 opacity-75"
                : callState === "speaking"
                  ? "border-amber-500 ring-8 ring-amber-500/15 scale-105"
                  : callState === "thinking"
                    ? "border-blue-500 ring-8 ring-blue-500/10 animate-pulse"
                    : "border-emerald-500 ring-8 ring-emerald-500/15"
            }`}
          >
            <img src="/logo.png" alt="Coach Ziri" className="h-12 w-12 object-contain" />
          </div>
        </div>

        <div className="w-full rounded-2xl border bg-card/80 p-5 shadow-xs min-h-[120px] flex flex-col items-center justify-center space-y-2">
          {callState === "speaking" && spokenText ? (
            <>
              <span className="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Coach Ziri
              </span>
              <p className="text-sm sm:text-base font-medium leading-relaxed line-clamp-5">
                {spokenText}
              </p>
            </>
          ) : liveTranscript ? (
            <>
              <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                You
              </span>
              <p className="text-sm sm:text-base font-medium leading-relaxed">
                "{liveTranscript}"
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {micMuted
                ? "Microphone is muted. Tap Unmute to speak."
                : callState === "thinking"
                  ? "Thinking…"
                  : "Speak naturally — Ziri is listening."}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-3 pb-2">
        <Button
          type="button"
          variant={micMuted ? "destructive" : "outline"}
          size="lg"
          onClick={onToggleMute}
          className="rounded-full h-12 px-5 gap-2"
        >
          {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          <span>{micMuted ? "Unmute" : "Mute"}</span>
        </Button>

        {callState === "speaking" && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onInterrupt}
            className="rounded-full h-12 px-5 gap-2"
          >
            <Hand className="h-4 w-4" />
            <span>Interrupt</span>
          </Button>
        )}

        {callState === "listening" && liveTranscript.trim().length > 0 && (
          <Button
            type="button"
            size="lg"
            onClick={onForceSend}
            className="rounded-full h-12 px-5 gap-2"
          >
            <Sparkles className="h-4 w-4" />
            <span>Send Now</span>
          </Button>
        )}

        <Button
          type="button"
          variant="destructive"
          size="lg"
          onClick={onEndCall}
          className="rounded-full h-12 px-6 gap-2"
        >
          <PhoneOff className="h-4 w-4" />
          <span>End Call</span>
        </Button>
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
      const briefingParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("briefing")
          : null;
      const initialTitle =
        briefingParam === "morning"
          ? "Morning Briefing"
          : briefingParam === "evening"
            ? "Evening Check-In"
            : "New chat";
      createT({ data: { title: initialTitle } })
        .then((t) => {
          if (briefingParam === "morning") {
            sessionStorage.setItem(
              `ziri_initial_prompt_${t.id}`,
              "Give me my morning briefing: review what is due today, overdue tasks, habits, and upcoming calendar events, and help me prioritize my day.",
            );
          } else if (briefingParam === "evening") {
            sessionStorage.setItem(
              `ziri_initial_prompt_${t.id}`,
              "Let's do my evening check-in: review what I completed today, what is still open, and help me set priorities for tomorrow.",
            );
          }
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

  const { messages, sendMessage, status, addToolApprovalResponse } = useChat({
    id: threadId,
    messages: initial,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onError: (e) => {
      console.error("[Coach Ziri Chat Error]:", e);
      if (callActiveRef.current) {
        callStateRef.current = "listening";
        setCallState("listening");
        setLiveTranscript("");
      }
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
  const callStreamRef = useRef<MediaStream | null>(null);
  const callAudioCtxRef = useRef<AudioContext | null>(null);
  const callAnalyserRef = useRef<AnalyserNode | null>(null);
  const callVadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callRecorderRef = useRef<MediaRecorder | null>(null);
  const callChunksRef = useRef<Blob[]>([]);
  const speechDetectedRef = useRef(false);
  const speechStartRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const stopCallRecorderOnly = useCallback((discard = true) => {
    if (callVadTimerRef.current) {
      clearInterval(callVadTimerRef.current);
      callVadTimerRef.current = null;
    }
    discardRecordingRef.current = discard;
    const rec = callRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    callRecorderRef.current = null;
  }, []);

  /** Starts one VAD-guided MediaRecorder turn and transcribes via Groq Whisper (/api/public/stt). */
  const startListening = useCallback(() => {
    if (!callActiveRef.current || micMutedRef.current) return;
    if (callStateRef.current === "speaking" || callStateRef.current === "thinking") return;
    const stream = callStreamRef.current;
    const analyser = callAnalyserRef.current;
    if (!stream || !analyser) return;

    stopCallRecorderOnly(true);

    const mimeCandidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    const mimeType =
      typeof MediaRecorder !== "undefined"
        ? mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m))
        : undefined;

    let rec: MediaRecorder;
    try {
      rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      toast.error("Voice recording is not supported on this browser.");
      return;
    }

    callChunksRef.current = [];
    speechDetectedRef.current = false;
    speechStartRef.current = null;
    silenceStartRef.current = null;
    discardRecordingRef.current = false;

    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        callChunksRef.current.push(ev.data);
      }
    };

    rec.onstop = async () => {
      if (callVadTimerRef.current) {
        clearInterval(callVadTimerRef.current);
        callVadTimerRef.current = null;
      }
      callRecorderRef.current = null;

      if (discardRecordingRef.current || !callActiveRef.current || micMutedRef.current) {
        return;
      }

      const blob = new Blob(callChunksRef.current, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 1200 || !speechDetectedRef.current) {
        setLiveTranscript("");
        setCallStateSynced("listening");
        setTimeout(() => startListening(), 150);
        return;
      }

      setCallStateSynced("thinking");
      setLiveTranscript("Transcribing…");

      try {
        const fd = new FormData();
        fd.append("audio", blob, "speech.webm");
        const sttRes = await fetch("/api/public/stt", { method: "POST", body: fd });
        if (!sttRes.ok) {
          throw new Error(`STT failed (${sttRes.status})`);
        }
        const { text } = (await sttRes.json()) as { text?: string };
        const cleanText = (text ?? "").trim();
        if (!cleanText) {
          setLiveTranscript("");
          setCallStateSynced("listening");
          setTimeout(() => startListening(), 200);
          return;
        }
        setLiveTranscript(cleanText);
        await sendMessage({ text: cleanText });
      } catch (err) {
        console.error("[Voice Call STT/Send Error]:", err);
        setLiveTranscript("");
        if (callActiveRef.current) {
          setCallStateSynced("listening");
          setTimeout(() => startListening(), 350);
        }
      }
    };

    callRecorderRef.current = rec;
    rec.start(250);
    setCallStateSynced("listening");

    const dataBuf = new Uint8Array(analyser.fftSize);
    callVadTimerRef.current = setInterval(() => {
      if (!callActiveRef.current || micMutedRef.current || callStateRef.current !== "listening") {
        return;
      }
      analyser.getByteTimeDomainData(dataBuf);
      let sum = 0;
      for (let i = 0; i < dataBuf.length; i++) {
        const v = (dataBuf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataBuf.length);
      const now = Date.now();

      if (rms > 0.022) {
        if (!speechDetectedRef.current) {
          speechDetectedRef.current = true;
          speechStartRef.current = now;
          setLiveTranscript("Listening to you…");
        }
        silenceStartRef.current = null;
      } else if (speechDetectedRef.current) {
        if (!silenceStartRef.current) {
          silenceStartRef.current = now;
        } else if (
          now - silenceStartRef.current >= 1050 &&
          speechStartRef.current &&
          now - speechStartRef.current >= 300
        ) {
          if (callRecorderRef.current?.state === "recording") {
            callRecorderRef.current.stop();
          }
          return;
        }
      }

      if (speechStartRef.current && now - speechStartRef.current >= 25_000) {
        if (callRecorderRef.current?.state === "recording") {
          callRecorderRef.current.stop();
        }
      }
    }, 80);
  }, [sendMessage, setCallStateSynced, stopCallRecorderOnly]);

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

      // Stop recording before playing TTS so speaker audio isn't recorded as user input
      stopCallRecorderOnly(true);

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

      audio.onerror = () => {
        URL.revokeObjectURL(firstUrl);
        speakWithBrowserFallback(clean);
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

    if (!text) {
      if (callActiveRef.current) {
        setCallStateSynced("listening");
        setTimeout(() => startListening(), 350);
      }
      return;
    }

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
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
    stopCallRecorderOnly(true);
    try {
      callStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    callStreamRef.current = null;
    try {
      void callAudioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    callAudioCtxRef.current = null;
    callAnalyserRef.current = null;
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
  }, [setCallStateSynced, stopCallRecorderOnly]);

  const startCall = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone access is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      callStreamRef.current = stream;
      callAudioCtxRef.current = ctx;
      callAnalyserRef.current = analyser;
    } catch {
      toast.error("Microphone permission denied. Please allow mic access and try again.");
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
        callRecorderRef.current === null
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
      stopCallRecorderOnly(true);
      setLiveTranscript("");
    } else if (callActiveRef.current && callStateRef.current === "listening") {
      startListening();
    }
  }, [startListening, stopCallRecorderOnly]);

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
    if (callRecorderRef.current?.state === "recording" && speechDetectedRef.current) {
      discardRecordingRef.current = false;
      callRecorderRef.current.stop();
    }
  }, []);

  // Live microphone volume metering only for standalone mic dictation (avoid fighting SpeechRecognition during call)
  const isMicMeteringActive = recording;
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
                        state?: ToolUIPart["state"];
                        input?: Record<string, unknown>;
                        output?: unknown;
                        errorText?: string;
                        approval?: {
                          id: string;
                          approved?: boolean;
                          reason?: string;
                        };
                      };
                      const toolName = tp.type.slice(5);
                      const isApprovalRequested = tp.state === "approval-requested";
                      const approvalId = tp.approval?.id;
                      return (
                        <Tool key={i} defaultOpen={isApprovalRequested}>
                          <ToolHeader
                            type={tp.type}
                            state={tp.state ?? "output-available"}
                          />
                          <ToolContent>
                            {isApprovalRequested && approvalId && (
                              <div className="mx-3 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                                  <ShieldAlert className="size-4 shrink-0" />
                                  <span>
                                    {toolName === "send_email" || toolName === "reply_to_email"
                                      ? "Confirm sending email"
                                      : toolName === "delete_task"
                                        ? "Confirm deleting task"
                                        : toolName === "delete_calendar_event"
                                          ? "Confirm deleting calendar event"
                                          : `Confirm ${toolName.replaceAll("_", " ")}`}
                                  </span>
                                </div>
                                {(toolName === "send_email" || toolName === "reply_to_email") &&
                                  tp.input && (
                                    <div className="rounded-md bg-background/80 p-2.5 text-xs space-y-1 border">
                                      {typeof tp.input.to === "string" && (
                                        <div>
                                          <span className="font-medium text-muted-foreground">To: </span>
                                          <span>{tp.input.to}</span>
                                        </div>
                                      )}
                                      {typeof tp.input.subject === "string" && (
                                        <div>
                                          <span className="font-medium text-muted-foreground">Subject: </span>
                                          <span>{tp.input.subject}</span>
                                        </div>
                                      )}
                                      {typeof tp.input.body === "string" && (
                                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground line-clamp-4">
                                          {tp.input.body}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={() =>
                                      addToolApprovalResponse({
                                        id: approvalId,
                                        approved: true,
                                      })
                                    }
                                  >
                                    <Check className="size-3.5" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={() =>
                                      addToolApprovalResponse({
                                        id: approvalId,
                                        approved: false,
                                        reason: "User cancelled the action.",
                                      })
                                    }
                                  >
                                    <X className="size-3.5" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                            {tp.state === "output-denied" && (
                              <div className="mx-3 mt-3 rounded-md border border-orange-500/30 bg-orange-500/5 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
                                Action cancelled by user.
                              </div>
                            )}
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
