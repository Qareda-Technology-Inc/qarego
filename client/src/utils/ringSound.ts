/**
 * Rider offer alert — admin URL + loop while offers pending.
 * Only loads expo-av when ExponentAV is linked in the native build.
 */

import { Vibration } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { appAxios } from "@/service/apiInterceptors";
import { ensureApiBaseUrl, getApiBaseUrl } from "@/service/config";

type ExpoAVModule = {
  Audio: {
    setAudioModeAsync: (mode: object) => Promise<void>;
    Sound: {
      createAsync: (
        source: { uri: string },
        initialStatus?: object
      ) => Promise<{
        sound: {
          stopAsync: () => Promise<void>;
          unloadAsync: () => Promise<void>;
          playAsync: () => Promise<void>;
        };
      }>;
    };
  };
};

let avChecked = false;
let avNativeLinked = false;
let ExpoAV: ExpoAVModule | null = null;
let avLoadPromise: Promise<ExpoAVModule | null> | null = null;

function isExponentAVLinked(): boolean {
  if (!avChecked) {
    avChecked = true;
    avNativeLinked = requireOptionalNativeModule("ExponentAV") != null;
    if (!avNativeLinked) {
      console.log(
        "expo-av (ExponentAV) not in this build — rider mp3 needs: cd client && npx expo prebuild --clean && npm run android"
      );
    }
  }
  return avNativeLinked;
}

/** Load JS only after native module exists (never require expo-av otherwise). */
async function loadExpoAV(): Promise<ExpoAVModule | null> {
  if (!isExponentAVLinked()) return null;
  if (ExpoAV) return ExpoAV;
  if (!avLoadPromise) {
    avLoadPromise = import("expo-av")
      .then((mod) => {
        ExpoAV = mod as ExpoAVModule;
        return ExpoAV;
      })
      .catch((e) => {
        console.warn("[rider] expo-av import failed:", e);
        avNativeLinked = false;
        return null;
      });
  }
  return avLoadPromise;
}

export function isRiderOfferAudioAvailable(): boolean {
  return isExponentAVLinked();
}

let cachedSoundUrl: string | null = null;
let soundUrlPromise: Promise<string | null> | null = null;
let offerSound: {
  stopAsync: () => Promise<void>;
  unloadAsync: () => Promise<void>;
  playAsync: () => Promise<void>;
} | null = null;
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
  const av = await loadExpoAV();
  if (!av) return false;
  try {
    const url = await loadRiderAlertSoundUrl();
    if (!url) return false;
    await av.Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
    const { sound } = await av.Audio.Sound.createAsync(
      { uri: url },
      { volume: 0.01, shouldPlay: true }
    );
    await sound.stopAsync();
    await sound.unloadAsync();
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
    await offerSound.stopAsync();
    await offerSound.unloadAsync();
  } catch {
    /* ignore */
  }
  offerSound = null;
}

export async function startRiderOfferRing(): Promise<void> {
  if (startingRing || offerSound || vibrationInterval) return;

  const av = await loadExpoAV();
  if (!av) {
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
    await av.Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
    await stopRiderOfferRing();
    const { sound } = await av.Audio.Sound.createAsync(
      { uri: url },
      { isLooping: true, volume: 1.0, shouldPlay: true }
    );
    offerSound = sound;
    await sound.playAsync();
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
