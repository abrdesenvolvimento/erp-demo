/**
 * Notification sound utility for the salon module.
 * Generates a pleasant ascending chime using Web Audio API.
 * Works on mobile and desktop browsers.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Play a pleasant ascending chime notification sound.
 * Uses Web Audio API for better mobile compatibility.
 */
export function playNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

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
 * Play a repeated notification (3 chimes with pauses).
 * Good for urgent alerts on mobile.
 */
export function playUrgentNotification() {
  playNotificationSound();
  setTimeout(() => playNotificationSound(), 800);
  setTimeout(() => playNotificationSound(), 1600);
}
