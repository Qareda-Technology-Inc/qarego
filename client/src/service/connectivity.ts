import { AppState } from "react-native";
import { create } from "zustand";
import { getApiBaseUrl } from "./config";

/**
 * App-wide connectivity, inferred from what the app already sees (failed API requests,
 * the live socket) plus a small probe while offline. No native module needed, and it also
 * catches "phone is online but our server isn't answering".
 *
 * - online: last check reached the API
 * - noInternet: when offline, the public connectivity check also failed (vs. server down)
 * - reconnectedAt: bumps each time we come back online, so screens can refetch
 */
type ConnectivityState = {
  online: boolean;
  noInternet: boolean;
  reconnectedAt: number;
};

export const useConnectivity = create<ConnectivityState>(() => ({
  online: true,
  noInternet: false,
  reconnectedAt: 0,
}));

const PROBE_INTERVAL_MS = 5000;
const PROBE_TIMEOUT_MS = 4000;
// Android's own captive-portal check: a tiny 204 response, no data sent.
const INTERNET_CHECK_URL = "https://connectivitycheck.gstatic.com/generate_204";

let probeTimer: ReturnType<typeof setTimeout> | null = null;
let probing = false;

async function reachable(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, cache: "no-store" });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function probe() {
  if (probing) return;
  probing = true;
  try {
    const base = getApiBaseUrl();
    if (base && (await reachable(`${base}/health`))) {
      markOnline();
      return;
    }
    const internet = await reachable(INTERNET_CHECK_URL);
    useConnectivity.setState({ noInternet: !internet });
    scheduleProbe();
  } finally {
    probing = false;
  }
}

function scheduleProbe() {
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = setTimeout(probe, PROBE_INTERVAL_MS);
}

/** Call when a request failed without any response from the server. */
export function markOffline() {
  if (useConnectivity.getState().online) {
    useConnectivity.setState({ online: false });
    void probe();
  }
}

/** Call whenever the server answered (any status). */
export function markOnline() {
  if (probeTimer) {
    clearTimeout(probeTimer);
    probeTimer = null;
  }
  if (!useConnectivity.getState().online) {
    useConnectivity.setState({ online: true, noInternet: false, reconnectedAt: Date.now() });
  }
}

/** Manual "Try again" from the banner. */
export function retryConnectivityNow() {
  void probe();
}

/** True for axios/fetch errors where the request never got a response. */
export function isNoResponseError(error: unknown): boolean {
  const e = error as { response?: unknown; request?: unknown; message?: string; code?: string };
  if (!e || e.response) return false;
  const msg = String(e.message || "");
  return (
    e.code === "ERR_NETWORK" ||
    e.code === "ECONNABORTED" ||
    /network error|network request failed|timeout|timed out/i.test(msg)
  );
}

// Coming back to the app is a good moment to re-check.
AppState.addEventListener("change", (state) => {
  if (state === "active" && !useConnectivity.getState().online) void probe();
});

/**
 * Message for a create/submit that never got an answer. The request may or may not have
 * reached us; retrying is safe because the same request id is sent again.
 */
export function lostConnectionMessage(what: string): string {
  return `We lost the connection before your ${what} was confirmed. Your details are saved — try again and it won't be placed twice.`;
}

