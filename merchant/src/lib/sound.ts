/**
 * Kitchen new-order alert — URL from admin settings, loops until accept/decline.
 */

import { fetcher } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/backendUrl";

const SESSION_PRIMED = "merchant_audio_primed";

let audioCtx: AudioContext | null = null;
let unlocked = false;
let cancelRing: (() => void) | null = null;
let loopAudio: HTMLAudioElement | null = null;
let synthInterval: ReturnType<typeof setInterval> | null = null;
let primeAudio: HTMLAudioElement | null = null;
let cachedSoundUrl: string | null = null;
let soundUrlPromise: Promise<string | null> | null = null;

/** Load alert URL configured by admin (cached for session). */
export async function loadKitchenAlertSoundUrl(): Promise<string | null> {
  if (cachedSoundUrl) return cachedSoundUrl;
  if (!soundUrlPromise) {
    soundUrlPromise = fetcher("/merchant/kitchen-alert-sound")
      .then((data) => {
        cachedSoundUrl = resolveMediaUrl(
          typeof data?.url === "string" ? data.url : null
        );
        return cachedSoundUrl;
      })
      .catch(() => {
        cachedSoundUrl = null;
        return null;
      });
  }
  return soundUrlPromise;
}

export function clearKitchenAlertSoundCache(): void {
  cachedSoundUrl = null;
  soundUrlPromise = null;
  primeAudio = null;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

export function isRestaurantAudioUnlocked(): boolean {
  return unlocked;
}

export function unlockRestaurantAudio(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") void ctx.resume();
  unlocked = true;
  try {
    sessionStorage.setItem(SESSION_PRIMED, "1");
  } catch {
    /* ignore */
  }
}

export async function autoEnableRestaurantAudio(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  unlockRestaurantAudio();

  const url = await loadKitchenAlertSoundUrl();
  if (url) {
    if (!primeAudio) {
      primeAudio = new Audio(url);
      primeAudio.preload = "auto";
    } else if (primeAudio.src !== url) {
      primeAudio.src = url;
    }
    try {
      primeAudio.volume = 0.01;
      primeAudio.loop = false;
      await primeAudio.play();
      primeAudio.pause();
      primeAudio.currentTime = 0;
      primeAudio.volume = 0.9;
      unlocked = true;
      return true;
    } catch {
      /* may need sign-in gesture */
    }
  }

  const ctx = getCtx();
  if (ctx) {
    try {
      if (ctx.state === "suspended") await ctx.resume();
      unlocked = true;
      return true;
    } catch {
      /* ignore */
    }
  }

  try {
    if (sessionStorage.getItem(SESSION_PRIMED) === "1") {
      unlocked = true;
      return true;
    }
  } catch {
    /* ignore */
  }
  return unlocked;
}

export function stopNewOrderRing(): void {
  cancelRing?.();
  cancelRing = null;
  if (loopAudio) {
    loopAudio.pause();
    loopAudio.currentTime = 0;
    loopAudio = null;
  }
  if (synthInterval) {
    clearInterval(synthInterval);
    synthInterval = null;
  }
}

function ringBurst(ctx: AudioContext, startTime: number, volume = 0.42) {
  const tones = [880, 1175];
  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = startTime + i * 0.14;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  });
}

function playSynthesizedLoop(): void {
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume();
  const playOnce = () => {
    if (cancelRing === null) return;
    ringBurst(ctx, ctx.currentTime + 0.05);
  };
  playOnce();
  synthInterval = setInterval(playOnce, 2200);
  cancelRing = () => {
    if (synthInterval) clearInterval(synthInterval);
    synthInterval = null;
  };
}

function playCustomAudioLoop(url: string): void {
  const audio = loopAudio ?? new Audio(url);
  if (loopAudio !== audio) audio.src = url;
  audio.loop = true;
  audio.volume = 0.9;
  loopAudio = audio;
  cancelRing = () => {
    audio.pause();
    audio.currentTime = 0;
    if (loopAudio === audio) loopAudio = null;
  };
  void audio.play().then(() => {
    unlocked = true;
  }).catch(() => {
    loopAudio = null;
    playSynthesizedLoop();
  });
}

/** Loop until accept / decline on a PLACED order. */
export async function playNewOrderRing(): Promise<void> {
  unlockRestaurantAudio();
  stopNewOrderRing();
  const url = await loadKitchenAlertSoundUrl();
  if (url) {
    playCustomAudioLoop(url);
    return;
  }
  playSynthesizedLoop();
}

export function playNewOrderChime(): void {
  void playNewOrderRing();
}
