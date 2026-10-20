/**
 * Rider offer alert — admin URL + loop while offers pending.
 * Only loads expo-audio when its native module is linked in the build.
 */

import { Vibration } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { appAxios } from "@/service/apiInterceptors";
import { ensureApiBaseUrl, getApiBaseUrl } from "@/service/config";

type ExpoAudioModule = typeof import("expo-audio");
type Player = ReturnType<ExpoAudioModule["createAudioPlayer"]>;

let audioChecked = false;
let audioNativeLinked = false;
let ExpoAudio: ExpoAudioModule | null = null;
let audioLoadPromise: Promise<ExpoAudioModule | null> | null = null;

function isExpoAudioLinked(): boolean {
  if (!audioChecked) {
    audioChecked = true;
    audioNativeLinked = requireOptionalNativeModule("ExpoAudio") != null;
    if (!audioNativeLinked) {
      console.log(
        "expo-audio not in this build — rider mp3 needs: cd client && npx expo prebuild --clean && npm run android"
      );
    }
  }
  return audioNativeLinked;
}

/** Load JS only after native module exists (never require expo-audio otherwise). */
async function loadExpoAudio(): Promise<ExpoAudioModule | null> {
  if (!isExpoAudioLinked()) return null;
  if (ExpoAudio) return ExpoAudio;
  if (!audioLoadPromise) {
    audioLoadPromise = import("expo-audio")
      .then((mod) => {
        ExpoAudio = mod;
        return ExpoAudio;
      })
      .catch((e) => {
        console.warn("[rider] expo-audio import failed:", e);
        audioNativeLinked = false;
        return null;
      });
  }
  return audioLoadPromise;
}

/** Play over silent mode and duck other apps' audio while the offer rings. */
async function setRingAudioMode(audio: ExpoAudioModule): Promise<void> {
  await audio.setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: "duckOthers",
  });
}

export function isRiderOfferAudioAvailable(): boolean {
  return isExpoAudioLinked();
}

let cachedSoundUrl: string | null = null;
let soundUrlPromise: Promise<string | null> | null = null;
let offerSound: Player | null = null;
let startingRing = false;
let vibrationInterval: ReturnType<typeof setInterval> | null = null;

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "10.0.2.2";
}

/**
 * Backend may return media URLs with localhost which ExoPlayer cannot always resolve
 * the same way as appAxios on Android. Re-anchor to current API origin when needed.
 */
function normalizeRiderAlertUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  const apiBase = getApiBaseUrl();
  if (!apiBase) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    const api = new URL(apiBase);

    if (isLoopbackHost(parsed.hostname) || parsed.hostname !== api.hostname) {
      parsed.protocol = api.protocol;
      parsed.hostname = api.hostname;
      parsed.port = api.port;
      return parsed.toString();
    }
    return rawUrl;
  } catch {
    // Relative path fallback
    if (rawUrl.startsWith("/")) {
      return `${apiBase.replace(/\/$/, "")}${rawUrl}`;
    }
    return rawUrl;
  }
}

function stopVibrationFallback(): void {
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  try {
    Vibration.cancel();
  } catch {
    /* ignore */
  }
}

function startVibrationFallback(): void {
  if (vibrationInterval) return;
  const pulse = () => {
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
  };
  pulse();
  vibrationInterval = setInterval(pulse, 2800);
}

export async function loadRiderAlertSoundUrl(): Promise<string | null> {
  if (cachedSoundUrl) return cachedSoundUrl;
  if (!soundUrlPromise) {
    await ensureApiBaseUrl();
    soundUrlPromise = appAxios
      .get("/ride/rider-alert-sound")
      .then((res) => {
        const serverUrl = typeof res.data?.url === "string" ? res.data.url : null;
        cachedSoundUrl = normalizeRiderAlertUrl(serverUrl);
        return cachedSoundUrl;
      })
      .catch(() => {
        cachedSoundUrl = null;
        return null;
      });
  }
  return soundUrlPromise;
}

export function clearRiderAlertSoundCache(): void {
  cachedSoundUrl = null;
  soundUrlPromise = null;
}

export async function primeRiderOfferAudio(): Promise<boolean> {
  const audio = await loadExpoAudio();
  if (!audio) return false;
  try {
    const url = await loadRiderAlertSoundUrl();
    if (!url) return false;
    await setRingAudioMode(audio);
    // A near-silent blip so the first real ring starts without delay.
    const player = audio.createAudioPlayer({ uri: url });
    player.volume = 0.01;
    player.play();
    setTimeout(() => {
      try {
        player.pause();
        player.remove();
      } catch {
        /* ignore */
      }
    }, 300);
    return true;
  } catch {
    return false;
  }
}

export async function stopRiderOfferRing(): Promise<void> {
  startingRing = false;
  stopVibrationFallback();
  if (!offerSound) return;
  try {
    offerSound.pause();
    offerSound.remove();
  } catch {
    /* ignore */
  }
  offerSound = null;
}

export async function startRiderOfferRing(): Promise<void> {
  if (startingRing || offerSound || vibrationInterval) return;

  const audio = await loadExpoAudio();
  if (!audio) {
    startVibrationFallback();
    return;
  }

  const url = await loadRiderAlertSoundUrl();
  if (!url) {
    startVibrationFallback();
    return;
  }

  startingRing = true;
  try {
    await setRingAudioMode(audio);
    await stopRiderOfferRing();
    const player = audio.createAudioPlayer({ uri: url });
    player.loop = true;
    player.volume = 1.0;
    offerSound = player;
    player.play();
  } catch (e) {
    console.warn("[rider] offer alert sound failed:", e);
    offerSound = null;
    startVibrationFallback();
  } finally {
    startingRing = false;
  }
}

export async function playRingSound(): Promise<void> {
  await startRiderOfferRing();
}
