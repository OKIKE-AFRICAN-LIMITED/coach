/**
 * Web Audio API alarm sound generator.
 * No audio files needed — generates a looping beep pattern programmatically.
 * Works on all platforms (iOS PWA, Android, Windows, macOS).
 */

let audioCtx: AudioContext | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playBeep(ctx: AudioContext, startTime: number, frequency: number, duration: number, gain: number) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  gainNode.gain.setValueAtTime(gain, startTime + duration - 0.05);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

/** Play one "alarm burst" — three rising beeps */
function playBurst() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  const t = ctx.currentTime;
  // Three beeps, rising in pitch
  playBeep(ctx, t + 0.0, 880, 0.18, 0.6);
  playBeep(ctx, t + 0.22, 1046, 0.18, 0.7);
  playBeep(ctx, t + 0.44, 1318, 0.25, 0.8);
}

/** Start looping alarm — plays a burst every 2 seconds */
export function startAlarm() {
  stopAlarm(); // prevent double-start
  playBurst(); // play immediately
  intervalId = setInterval(playBurst, 2000);
}

/** Stop the looping alarm */
export function stopAlarm() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function isAlarmPlaying() {
  return intervalId !== null;
}
