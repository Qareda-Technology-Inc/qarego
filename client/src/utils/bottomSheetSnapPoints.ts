import { Platform } from "react-native";

/** Pixel snap points — safe once window height is known (avoids % parse races in gorhom v5). */
export function buildFoodOrderSnapPoints(windowHeight: number): number[] {
  if (windowHeight < 100) return [200, 380];
  const collapsed = Platform.OS === "ios" ? 0.28 : 0.24;
  const expanded = Platform.OS === "ios" ? 0.52 : 0.46;
  const low = Math.max(160, Math.round(windowHeight * collapsed));
  const high = Math.max(low + 100, Math.round(windowHeight * expanded));
  return [low, high];
}

export function buildLiveRideSnapPoints(windowHeight: number): number[] {
  if (windowHeight < 100) return [180, 360];
  const collapsed = Platform.OS === "ios" ? 0.2 : 0.12;
  const expanded = Platform.OS === "ios" ? 0.5 : 0.42;
  const low = Math.max(100, Math.round(windowHeight * collapsed));
  const high = Math.max(low + 120, Math.round(windowHeight * expanded));
  return [low, high];
}

export function buildHomeSnapPoints(windowHeight: number): number[] {
  if (windowHeight < 100) return [280, 420, 560];
  const ratios = Platform.OS === "ios" ? [0.42, 0.62, 0.88] : [0.4, 0.6, 0.88];
  const points = ratios.map((r) => Math.max(160, Math.round(windowHeight * r)));
  for (let i = 1; i < points.length; i += 1) {
    if (points[i] <= points[i - 1]) points[i] = points[i - 1] + 80;
  }
  return points;
}
