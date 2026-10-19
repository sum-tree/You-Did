import kalamiCollisionUrl from "./assets/audio/kalami-collision.wav";
import corkUrl from "./assets/audio/cork.wav";

/**
 * Web Audio manager supporting user-provided audio assets with zero-dependency fallback.
 * - 卡拉米碰撞：使用第一个音效 (kalami-collision.wav)
 * - 木塞：使用第二个音效 (cork.wav)
 * - 两个音效同时出现时：木塞作为微弱背景音衬托 (降低音量至 0.08 并加温和低通滤波，突出卡拉米碰撞主体)
 * - 轻点玻璃罐：呈现卡拉米此起彼伏的跳跃碰撞波，木塞音量适度降低。
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
 * @param volume 音量相对系数
 * @param pitchVariation 随机音高微调范围
 * @param delaySeconds 距离当前的延迟启动时间（秒）
 * @param playbackRateMultiplier 音高/播放速率倍率
 */
export function playKalamiCollision(
  volume = 0.85,
  pitchVariation = 0,
  delaySeconds = 0,
  playbackRateMultiplier = 1.0
) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (!kalamiBuffer) {
      void loadAudioBuffers();
      fallbackJarBounce(ctx, delaySeconds, playbackRateMultiplier, volume * 0.26);
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = kalamiBuffer;
    const rate = playbackRateMultiplier * (1.0 + (Math.random() - 0.5) * pitchVariation);
    source.playbackRate.value = Math.max(0.5, Math.min(2.5, rate));

    const gain = ctx.createGain();
    // 适当提升基础增益（kalami-collision.wav 原峰值振幅约为 0.071）
    const effectiveVolume = volume * 2.2;
    const startTime = ctx.currentTime + Math.max(0, delaySeconds);
    gain.gain.setValueAtTime(effectiveVolume, startTime);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(startTime);
  } catch {
    // Ignore audio error
  }
}

/**
 * 木塞音效（第二个音效）
 * @param isBackground 是否作为背景音衬托。
 * 木塞音效整体音量适度降低（单独 0.28，背景 0.08 并加低通滤波软化），避免喧宾夺主。
 */
export function playCorkSound(isBackground = false, volumeOverride?: number) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (!corkBuffer) {
      void loadAudioBuffers();
      fallbackCork(ctx, isBackground, volumeOverride);
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = corkBuffer;

    const gain = ctx.createGain();
    // 当木塞作为背景音衬托时弱化至 0.08；单独出现时为主音量 0.28（大幅降低此前 0.70 的刺耳感）
    const defaultVolume = isBackground ? 0.08 : 0.28;
    const volume = volumeOverride ?? defaultVolume;
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

interface BounceScheduleItem {
  delay: number;
  rate: number;
  volume: number;
}

function getJarBounceSchedule(count: number): BounceScheduleItem[] {
  if (count <= 1) {
    return [
      { delay: 0.00, rate: 1.00, volume: 0.85 },
      { delay: 0.22, rate: 0.94, volume: 0.60 },
    ];
  }
  if (count === 2) {
    return [
      { delay: 0.00, rate: 1.05, volume: 0.85 },
      { delay: 0.11, rate: 1.20, volume: 0.75 },
      { delay: 0.26, rate: 0.92, volume: 0.58 },
    ];
  }
  if (count === 3) {
    return [
      { delay: 0.00, rate: 1.00, volume: 0.85 },
      { delay: 0.09, rate: 1.22, volume: 0.78 },
      { delay: 0.19, rate: 0.94, volume: 0.70 },
      { delay: 0.32, rate: 1.12, volume: 0.56 },
    ];
  }
  // 4 颗及以上：卡拉米较多，碰撞呈群体波浪式此起彼伏
  const items: BounceScheduleItem[] = [
    { delay: 0.00, rate: 1.00, volume: 0.85 },
    { delay: 0.07, rate: 1.24, volume: 0.78 },
    { delay: 0.15, rate: 0.92, volume: 0.74 },
    { delay: 0.24, rate: 1.30, volume: 0.68 },
    { delay: 0.35, rate: 1.06, volume: 0.60 },
    { delay: 0.46, rate: 0.88, volume: 0.52 },
  ];
  if (count >= 8) {
    items.push({ delay: 0.56, rate: 1.15, volume: 0.44 });
  }
  return items;
}

/**
 * 罐中卡拉米此起彼伏的跳跃碰撞波
 */
export function playKalamiBounceChorus(kalamiCount = 6) {
  if (kalamiCount <= 0) return;

  const schedule = getJarBounceSchedule(kalamiCount);
  schedule.forEach((item, index) => {
    // 首声瞬时触发，后续各声引入微小时差抖动与音高浮动，自然灵动
    const jitter = index === 0 ? 0 : (Math.random() - 0.5) * 0.024;
    const delay = Math.max(0, item.delay + jitter);
    const rateJitter = 1.0 + (Math.random() - 0.5) * 0.12;
    const rate = item.rate * rateJitter;
    const volJitter = 0.92 + Math.random() * 0.16;
    const vol = item.volume * volJitter;
    playKalamiCollision(vol, 0, delay, rate);
  });
}

/**
 * 点击罐子卡拉米弹起来（卡拉米此起彼伏碰撞合奏，木塞音量降低作为柔和背景衬托）
 */
export function playJarBounce(kalamiCount?: number) {
  // 木塞作为柔和背景衬托（降低音量至 0.08 并加低通滤波）
  playCorkSound(true);

  // 卡拉米群体碰撞此起彼伏
  playKalamiBounceChorus(kalamiCount ?? 6);
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

function fallbackJarBounce(
  ctx: AudioContext,
  delaySeconds = 0,
  pitchMultiplier = 1.0,
  volume = 0.22
) {
  try {
    const t = ctx.currentTime + Math.max(0, delaySeconds);
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    const baseFreq = 400 * pitchMultiplier;
    osc1.frequency.setValueAtTime(baseFreq, t);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.85, t + 0.065);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, t + 0.17);

    gain1.gain.setValueAtTime(volume, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.19);
  } catch {
    // Ignore error
  }
}

function fallbackCork(ctx: AudioContext, isBackground: boolean, volumeOverride?: number) {
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(1150, t + 0.045);

    const defaultVol = isBackground ? 0.04 : 0.14;
    const volume = volumeOverride ?? defaultVol;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch {
    // Ignore error
  }
}
