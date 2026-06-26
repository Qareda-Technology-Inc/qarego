import { storage } from "@/store/storage";

const SKIP_KEY = "dev_skip_active_ride_resume";

/** Dev-only: stay on rider/customer home instead of auto-opening live ride after reload. */
export function shouldSkipActiveRideResume(): boolean {
  return __DEV__ && storage.getString(SKIP_KEY) === "1";
}

export function setSkipActiveRideResume(skip: boolean): void {
  if (!__DEV__) return;
  if (skip) storage.set(SKIP_KEY, "1");
  else storage.delete(SKIP_KEY);
}

export function clearSkipActiveRideResume(): void {
  storage.delete(SKIP_KEY);
}
