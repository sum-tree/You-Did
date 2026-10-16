import kalamiCollisionUrl from "./assets/audio/kalami-collision.wav";
import corkUrl from "./assets/audio/cork.wav";

/**
 * Web Audio manager supporting user-provided audio assets with zero-dependency fallback.
 * - 卡拉米碰撞：使用第一个音效 (kalami-collision.wav)
 * - 木塞：使用第二个音效 (cork.wav)
 * - 两个音效同时出现时：木塞作为背景音衬托 (降低音量并加温和滤波，不抢占卡拉米碰撞主体)
 */

let sharedAudioCtx: AudioContext | null = null;
let kalamiBuffer: AudioBuffer | null = null;
let corkBuffer: AudioBuffer | null = null;
let isPreloading = false;

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

async function loadAudioBuffers() {
  if (typeof window === "undefined" || isPreloading) return;
  if (kalamiBuffer && corkBuffer) return;
  isPreloading = true;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const [res1, res2] = await Promise.all([
      fetch(kalamiCollisionUrl),
      fetch(corkUrl),
    ]);
    const [arr1, arr2] = await Promise.all([
      res1.arrayBuffer(),
      res2.arrayBuffer(),
    ]);
    const [buf1, buf2] = await Promise.all([
      ctx.decodeAudioData(arr1),
      ctx.decodeAudioData(arr2),
    ]);
    kalamiBuffer = buf1;
    corkBuffer = buf2;
  } catch (err) {
    console.warn("Failed to load audio assets, will use procedural fallback:", err);
  } finally {
    isPreloading = false;
  }
}

// Preload audio files as soon as module loads in browser
if (typeof window !== "undefined") {
  void loadAudioBuffers();

  const unlock = () => {
    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume();
    }
    if (!kalamiBuffer || !corkBuffer) {
      void loadAudioBuffers();
    }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

/**
 * 卡拉米碰撞音效（第一个音效）
 */
export function playKalamiCollision(volume = 0.85, pitchVariation = 0) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (!kalamiBuffer) {
      void loadAudioBuffers();
      fallbackJarBounce(ctx);
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = kalamiBuffer;
    if (pitchVariation > 0) {
      source.playbackRate.value = 1.0 + (Math.random() - 0.5) * pitchVariation;
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  } catch {
    // Ignore audio error
  }
}

/**
 * 木塞音效（第二个音效）
 * @param isBackground 是否作为背景音衬托。
 * 两个音效同时出现时，木塞音效音量降低至 0.28 并通过低通滤波软化，衬托卡拉米碰撞主体。
 */
export function playCorkSound(isBackground = false) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (!corkBuffer) {
      void loadAudioBuffers();
      fallbackCork(ctx, isBackground);
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = corkBuffer;

    const gain = ctx.createGain();
    // 当木塞作为背景音衬托时，音量减弱至 0.26，避免喧宾夺主；单独出现时为主音量 0.70
    const volume = isBackground ? 0.26 : 0.70;
    gain.gain.setValueAtTime(volume, ctx.currentTime);

    if (isBackground) {
      // 背景衬托时加入温和低通滤波，突出氛围感
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2800, ctx.currentTime);

      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    gain.connect(ctx.destination);
    source.start(0);
  } catch {
    // Ignore audio error
  }
}

/**
 * 罐子打开（木塞拔出）
 */
export function playCorkPop() {
  playCorkSound(false);
}

/**
 * 罐子关闭（木塞盖紧按实）
 */
export function playCorkThump() {
  playCorkSound(false);
}

/**
 * 点击罐子卡拉米弹起来（两个音效同时出现）
 * 卡拉米碰撞为主音，木塞作为背景音衬托
 */
export function playJarBounce() {
  playKalamiCollision(0.85);
  playCorkSound(true);
}

/**
 * 卡拉米掉落着地/碰撞（逐颗落入罐中）
 */
export function playJellyDrop(index = 0) {
  // 微调音高，使连续掉落音效更生动灵动
  const pitchVariation = 0.04 + (index % 5) * 0.02;
  playKalamiCollision(0.65, pitchVariation);
}

// --- Procedural Fallbacks (in case audio assets are loading or network delayed) ---

function fallbackJarBounce(ctx: AudioContext) {
  try {
    const t = ctx.currentTime;
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
    osc1.start(t);
    osc1.stop(t + 0.19);
  } catch {
    // Ignore error
  }
}

function fallbackCork(ctx: AudioContext, isBackground: boolean) {
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(1150, t + 0.045);

    gain.gain.setValueAtTime(isBackground ? 0.1 : 0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch {
    // Ignore error
  }
}
