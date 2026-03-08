/**
 * Notification sound utility for the salon module.
 * Generates a pleasant ascending chime using Web Audio API.
 * Works on mobile and desktop browsers.
 *
 * iOS/Safari require user interaction to unlock audio context.
 * Call `unlockAudio()` on a user gesture (button tap) before playing sounds.
 *
 * Persistence: uses localStorage key "salon_sound_enabled" to remember state across page navigations.
 */

const STORAGE_KEY = "salon_sound_enabled";

let audioContext: AudioContext | null = null;
let audioUnlocked = false;

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
 * Also persists the preference to localStorage.
 */
export async function unlockAudio(): Promise<boolean> {
  try {
    const ctx = await ensureAudioContext();
    if (!ctx) return false;

    // Play a silent buffer to fully unlock on iOS
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

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
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked && audioContext !== null && audioContext.state === "running";
}

/**
 * Get or create a running AudioContext.
 * Automatically resumes suspended context (happens after iOS page navigation).
 */
async function getRunningAudioContext(): Promise<AudioContext | null> {
  return ensureAudioContext();
}

/**
 * Play a pleasant ascending chime notification sound.
 * Uses Web Audio API for better mobile compatibility.
 * Async to handle iOS context resume.
 */
export async function playNotificationSound(): Promise<void> {
  const ctx = await getRunningAudioContext();
  if (!ctx || ctx.state !== "running") return;

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
