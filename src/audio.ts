/**
 * Zero-dependency Web Audio synthesizer for cute, satisfying physics sound effects.
 * Requires no external audio assets, works offline, and has zero network latency.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    // Resume context on user gesture
    void sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

if (typeof window !== "undefined") {
  const unlock = () => {
    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume();
    }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

/**
 * Clean crisp pop sound when cork plug is pulled from jar mouth
 */
export function playCorkPop() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Pitch rises swiftly like a vacuum cork pop
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(1150, t + 0.045);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.08);
  } catch {
    // Audio failures should never interrupt UI interaction
  }
}

/**
 * Dull warm thump when cork cap settles and seals jar tightly
 */
export function playCorkThump() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.1);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.12);
  } catch {
    // Ignore audio error
  }
}

/**
 * Bouncy, elastic "Duang~" sound when tapping jar to bounce jellies
 */
export function playJarBounce() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // Oscillator 1: Main elastic rising tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(400, t);
    osc1.frequency.exponentialRampToValueAtTime(740, t + 0.065);
    osc1.frequency.exponentialRampToValueAtTime(510, t + 0.17);

    gain1.gain.setValueAtTime(0.26, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Oscillator 2: Sub-octave body warmth
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(200, t);
    osc2.frequency.exponentialRampToValueAtTime(370, t + 0.065);
    osc2.frequency.exponentialRampToValueAtTime(255, t + 0.17);

    gain2.gain.setValueAtTime(0.16, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.19);
    osc2.stop(t + 0.19);
  } catch {
    // Ignore audio error
  }
}

/**
 * Delicate cute droplet plop when each jelly drops into jar
 */
export function playJellyDrop(index: number = 0) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Gentle pentatonic variation based on index so multi-drop plays a cute musical cascade
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const baseFreq = scale[index % scale.length];

    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq * 0.85, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, t + 0.04);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.09);
  } catch {
    // Ignore audio error
  }
}
