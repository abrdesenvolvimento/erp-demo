/**
 * Notification sound utility for the salon module.
 * Generates a pleasant ascending chime using Web Audio API.
 * Works on mobile and desktop browsers.
 *
 * iOS/Safari require user interaction to unlock audio context.
 * Call `unlockAudio()` on a user gesture (button tap) before playing sounds.
 *
 * iOS KEEP-ALIVE STRATEGY:
 * After the user taps to enable alerts, we start a silent <audio> element
 * looping continuously. This keeps the iOS audio session alive so that
 * subsequent Web Audio API calls (from polling/timers) can produce sound
 * even without a direct user gesture.
 *
 * Persistence: uses localStorage key "salon_sound_enabled" to remember state across page navigations.
 */

const STORAGE_KEY = "salon_sound_enabled";

let audioContext: AudioContext | null = null;
let audioUnlocked = false;
let keepAliveAudio: HTMLAudioElement | null = null;

/**
 * Read persisted sound preference from localStorage.
 */
export function getSoundEnabledFromStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Persist sound preference to localStorage.
 */
function setSoundEnabledInStorage(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    // ignore
  }
}

/**
 * Create a tiny silent WAV as a data URI.
 * This is a valid 44-byte WAV file with 1 sample of silence.
 * Used to keep the iOS audio session alive.
 */
function createSilentWavDataUri(): string {
  // Minimal WAV: 44 bytes header + 2 bytes of silence (1 sample, 16-bit mono)
  const buffer = new ArrayBuffer(46);
  const view = new DataView(buffer);
  // "RIFF" chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 38, true); // file size - 8
  writeString(view, 8, "WAVE");
  // "fmt " sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, 8000, true); // sample rate
  view.setUint32(28, 16000, true); // byte rate
  view.setUint16(32, 2, true);  // block align
  view.setUint16(34, 16, true); // bits per sample
  // "data" sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, 2, true); // data size
  view.setInt16(44, 0, true);  // one silent sample

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return "data:audio/wav;base64," + btoa(binary);
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Start a silent audio loop to keep the iOS audio session alive.
 * Must be called from a user gesture context.
 */
function startKeepAlive() {
  try {
    if (keepAliveAudio) {
      // Already running
      keepAliveAudio.play().catch(() => {});
      return;
    }
    const audio = new Audio(createSilentWavDataUri());
    audio.loop = true;
    audio.volume = 0.01; // near-silent but not zero (iOS may ignore volume=0)
    audio.setAttribute("playsinline", "true");
    // Play from user gesture context
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {
        // If play fails, we'll try again on next user gesture
        console.warn("[KeepAlive] Silent audio play failed");
      });
    }
    keepAliveAudio = audio;
  } catch {
    console.warn("[KeepAlive] Failed to start silent audio loop");
  }
}

/**
 * Stop the keep-alive audio loop.
 */
function stopKeepAlive() {
  if (keepAliveAudio) {
    keepAliveAudio.pause();
    keepAliveAudio.src = "";
    keepAliveAudio = null;
  }
}

/**
 * Ensure AudioContext is created and running.
 * On iOS, the context may be suspended after page navigation — this resumes it.
 */
async function ensureAudioContext(): Promise<AudioContext | null> {
  try {
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Must be called once from a user gesture (tap/click) to unlock audio on iOS.
 * Returns true if audio is now unlocked.
 * Also starts the silent keep-alive loop and persists the preference.
 */
export async function unlockAudio(): Promise<boolean> {
  try {
    const ctx = await ensureAudioContext();
    if (!ctx) return false;

    // Play a silent buffer to fully unlock Web Audio API on iOS
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    // Start the silent keep-alive loop to maintain iOS audio session
    startKeepAlive();

    // Also pre-create the notification Audio element during user gesture
    preloadNotificationAudio();

    audioUnlocked = true;
    setSoundEnabledInStorage(true);
    return true;
  } catch {
    return false;
  }
}

/**
 * Disable audio and clear localStorage preference.
 */
export function disableAudio() {
  audioUnlocked = false;
  setSoundEnabledInStorage(false);
  stopKeepAlive();
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked && audioContext !== null && audioContext.state === "running";
}

/**
 * Re-activate audio on page return (visibility change).
 * Call this when the page becomes visible again.
 */
export async function reactivateAudio(): Promise<void> {
  if (!getSoundEnabledFromStorage()) return;
  try {
    const ctx = await ensureAudioContext();
    if (ctx) {
      audioUnlocked = true;
      // Restart keep-alive if it stopped
      if (keepAliveAudio) {
        keepAliveAudio.play().catch(() => {});
      } else {
        startKeepAlive();
      }
    }
  } catch {
    // ignore
  }
}

// ============================================================
// HTML Audio element approach for notification sound
// This works better on iOS because the Audio element was created
// during a user gesture, and the keep-alive maintains the session.
// ============================================================

let notificationAudioElement: HTMLAudioElement | null = null;

/**
 * Pre-create an Audio element during user gesture.
 * We'll reuse it for notification sounds.
 */
function preloadNotificationAudio() {
  try {
    if (!notificationAudioElement) {
      // Create a short beep using oscillator and record it to a blob
      // For now, we'll use the Web Audio API approach but with the keep-alive
      notificationAudioElement = new Audio();
      notificationAudioElement.volume = 1.0;
    }
  } catch {
    // ignore
  }
}

/**
 * Play a pleasant ascending chime notification sound.
 * Uses Web Audio API for better mobile compatibility.
 * The silent keep-alive audio loop ensures iOS allows this even outside user gesture.
 */
export async function playNotificationSound(): Promise<void> {
  const ctx = await ensureAudioContext();
  if (!ctx) return;

  // Force resume if suspended (iOS may suspend between polls)
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }

  if (ctx.state !== "running") return;

  const now = ctx.currentTime;

  // Three ascending notes: C5, E5, G5 (major chord)
  const notes = [
    { freq: 523.25, start: 0, duration: 0.25 },    // C5
    { freq: 659.25, start: 0.15, duration: 0.25 },  // E5
    { freq: 783.99, start: 0.30, duration: 0.35 },  // G5
  ];

  notes.forEach(({ freq, start, duration }) => {
    // Main oscillator
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    // Gain envelope (bell curve)
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.3, now + start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + start);
    osc.stop(now + start + duration);

    // Soft harmonic (octave above, quieter)
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 2;

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, now + start);
    gain2.gain.linearRampToValueAtTime(0.08, now + start + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + start);
    osc2.stop(now + start + duration);
  });
}

/**
 * Vibrate the device with an urgent pattern.
 * Works on Android without any permission.
 * iOS (PWA mode) may support it on some versions.
 * Pattern: buzz-pause-buzz-pause-buzz (200ms each, 100ms pauses)
 */
export function vibrateUrgent(): void {
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  } catch {
    // ignore — vibration not supported
  }
}

/**
 * Play a repeated notification (3 chimes with pauses) and vibrate.
 * Good for urgent alerts on mobile.
 */
export async function playUrgentNotification(): Promise<void> {
  vibrateUrgent();
  await playNotificationSound();
  setTimeout(() => playNotificationSound(), 800);
  setTimeout(() => playNotificationSound(), 1600);
}
