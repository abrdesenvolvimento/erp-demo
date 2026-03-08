/**
 * Notification sound utility for the salon module.
 *
 * iOS STRATEGY (the key insight):
 * iOS Safari blocks audio playback unless it originates from a user gesture.
 * However, once an HTMLAudioElement has been .play()'d during a user gesture,
 * that SAME element can be .play()'d again later without a gesture.
 *
 * So the approach is:
 * 1. On user tap ("Ativar Alertas"), create an <audio> element with a real WAV sound
 * 2. Play it muted to "bless" it with iOS
 * 3. Then unmute and play it for real (user hears the test sound)
 * 4. On polling callbacks, reuse the SAME element: currentTime=0, play()
 *
 * We also keep a silent <audio> loop running to maintain the iOS audio session.
 *
 * Persistence: uses localStorage key "salon_sound_enabled".
 */

const STORAGE_KEY = "salon_sound_enabled";

let audioUnlocked = false;
let keepAliveAudio: HTMLAudioElement | null = null;
let notificationAudio: HTMLAudioElement | null = null;

// ============================================================
// localStorage persistence
// ============================================================

export function getSoundEnabledFromStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setSoundEnabledInStorage(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    // ignore
  }
}

// ============================================================
// WAV generation helpers
// ============================================================

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Generate a notification chime as a WAV data URI.
 * Three ascending notes (C5, E5, G5) — a pleasant major chord arpeggio.
 * Duration: ~0.7 seconds, 22050 Hz sample rate, 16-bit mono.
 */
function generateChimeWavDataUri(): string {
  const sampleRate = 22050;
  const duration = 0.75; // seconds
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);       // PCM sub-chunk size
  view.setUint16(20, 1, true);        // PCM format
  view.setUint16(22, 1, true);        // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);        // block align
  view.setUint16(34, 16, true);       // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Generate three ascending notes: C5 (523Hz), E5 (659Hz), G5 (784Hz)
  const notes = [
    { freq: 523.25, start: 0.0,  end: 0.30 },
    { freq: 659.25, start: 0.15, end: 0.45 },
    { freq: 783.99, start: 0.30, end: 0.70 },
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (const note of notes) {
      if (t >= note.start && t <= note.end) {
        const noteT = t - note.start;
        const noteDur = note.end - note.start;
        // Bell-curve envelope: quick attack, exponential decay
        const attack = Math.min(noteT / 0.02, 1); // 20ms attack
        const decay = Math.exp(-4 * noteT / noteDur);
        const envelope = attack * decay;
        // Fundamental + soft octave harmonic
        sample += envelope * 0.35 * Math.sin(2 * Math.PI * note.freq * noteT);
        sample += envelope * 0.10 * Math.sin(2 * Math.PI * note.freq * 2 * noteT);
      }
    }

    // Clamp to [-1, 1] and convert to 16-bit
    sample = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
  }

  // Convert to base64 data URI
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return "data:audio/wav;base64," + btoa(binary);
}

/**
 * Generate a tiny silent WAV for the keep-alive loop.
 */
function generateSilentWavDataUri(): string {
  const buffer = new ArrayBuffer(46);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 38, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, 2, true);
  view.setInt16(44, 0, true);

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return "data:audio/wav;base64," + btoa(binary);
}

// ============================================================
// Keep-alive: silent audio loop to maintain iOS audio session
// ============================================================

function startKeepAlive() {
  try {
    if (keepAliveAudio) {
      keepAliveAudio.play().catch(() => {});
      return;
    }
    const audio = new Audio(generateSilentWavDataUri());
    audio.loop = true;
    // iOS ignores volume=0, so use near-silent. Use muted=false to keep session.
    audio.volume = 0.01;
    audio.setAttribute("playsinline", "true");
    audio.play().catch(() => {
      console.warn("[KeepAlive] Silent audio play failed");
    });
    keepAliveAudio = audio;
  } catch {
    console.warn("[KeepAlive] Failed to start");
  }
}

function stopKeepAlive() {
  if (keepAliveAudio) {
    keepAliveAudio.pause();
    keepAliveAudio.src = "";
    keepAliveAudio = null;
  }
}

// ============================================================
// Notification Audio element — the core iOS trick
// ============================================================

/**
 * Create and "bless" the notification audio element.
 * MUST be called from a user gesture (tap).
 * We play it muted first to unlock it on iOS, then unmute for the real sound.
 */
function createAndBlessNotificationAudio(): HTMLAudioElement {
  const wavUri = generateChimeWavDataUri();
  const audio = new Audio(wavUri);
  audio.setAttribute("playsinline", "true");
  // iOS Safari bug: audio.volume may be read-only on mobile, so use muted instead
  audio.muted = true;
  // Play muted to "bless" this element on iOS
  const p = audio.play();
  if (p) {
    p.then(() => {
      // Now unmute — the element is blessed
      audio.pause();
      audio.muted = false;
      audio.currentTime = 0;
    }).catch(() => {
      // Still try to unmute
      audio.muted = false;
    });
  }
  return audio;
}

// ============================================================
// Public API
// ============================================================

/**
 * Must be called once from a user gesture (tap/click) to unlock audio on iOS.
 * Returns true if audio is now unlocked.
 */
export async function unlockAudio(): Promise<boolean> {
  try {
    // Start keep-alive loop
    startKeepAlive();

    // Create and bless the notification audio element
    notificationAudio = createAndBlessNotificationAudio();

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
  if (notificationAudio) {
    notificationAudio.pause();
    notificationAudio = null;
  }
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked && notificationAudio !== null;
}

/**
 * Re-activate audio on page return (visibility change).
 * Call this when the page becomes visible again.
 */
export async function reactivateAudio(): Promise<void> {
  if (!getSoundEnabledFromStorage()) return;
  try {
    audioUnlocked = true;
    // Restart keep-alive if it stopped
    if (keepAliveAudio) {
      keepAliveAudio.play().catch(() => {});
    } else {
      startKeepAlive();
    }
    // Re-bless the notification audio if it was lost
    if (!notificationAudio) {
      // Can't create new blessed audio without user gesture,
      // but we can try to play the keep-alive to maintain session
    }
  } catch {
    // ignore
  }
}

/**
 * Play the notification chime sound.
 * Uses the pre-blessed HTMLAudioElement — works on iOS even from polling/timers.
 */
export async function playNotificationSound(): Promise<void> {
  if (!notificationAudio) {
    console.warn("[Sound] No notification audio element — call unlockAudio() first");
    return;
  }
  try {
    notificationAudio.muted = false;
    notificationAudio.currentTime = 0;
    const p = notificationAudio.play();
    if (p) {
      await p.catch((err) => {
        console.warn("[Sound] Play failed:", err.message);
      });
    }
  } catch (err) {
    console.warn("[Sound] playNotificationSound error:", err);
  }
}

/**
 * Vibrate the device with an urgent pattern.
 * Works on Android without any permission.
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
  // Replay the same element after delays for urgency effect
  setTimeout(() => {
    if (notificationAudio) {
      notificationAudio.currentTime = 0;
      notificationAudio.play().catch(() => {});
    }
  }, 900);
  setTimeout(() => {
    if (notificationAudio) {
      notificationAudio.currentTime = 0;
      notificationAudio.play().catch(() => {});
    }
  }, 1800);
}
