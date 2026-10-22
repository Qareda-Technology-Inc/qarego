/**
 * Browser uses same-origin /api proxy (see next.config.ts) → backend.
 * Avoids CORS and stale baked-in hosts.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  const target = process.env.API_PROXY_TARGET || "http://127.0.0.1:2026";
  return String(target).replace(/\/$/, "");
}

export function logoutOn401() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("merchantUser");
  localStorage.removeItem("merchantRestaurants");
  localStorage.removeItem("activeRestaurantId");
  window.location.href = "/login";
}

function getStoreHeaders(customHeaders?: HeadersInit): Record<string, string> {
  const activeRestaurantId =
    typeof window !== "undefined" ? localStorage.getItem("activeRestaurantId") : null;
  return {
    "Content-Type": "application/json",
    ...(activeRestaurantId ? { "x-restaurant-id": activeRestaurantId } : {}),
    ...(customHeaders as Record<string, string>),
  };
}

// Responses are untyped JSON, as in the admin portal; each page reads the fields it expects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetcher(url: string, options: RequestInit = {}): Promise<any> {
  const base = getApiBaseUrl();
  const res = await authFetch(`${base}${url}`, {
    ...options,
    headers: getStoreHeaders(options.headers as HeadersInit),
  });

  const raw = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: Record<string, any> = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { msg: raw.trim() };
    }
  }

  // Still on a temporary password: the server refuses everything until it's changed.
  if (res.status === 403 && data.code === "PASSWORD_CHANGE_REQUIRED" && typeof window !== "undefined") {
    if (window.location.pathname !== "/set-password") window.location.assign("/set-password");
    throw new Error(data.msg || "Choose your own password first");
  }

  if (!res.ok) {
    const fallback =
      res.status === 404
        ? "API route not found — restart the server if you just added endpoints"
        : "Something went wrong";
    throw new Error(data.message || data.msg || fallback);
  }
  return data;
}

/* ---------------- Session renewal ---------------- */
// The server's access token lasts 30 minutes; the refresh token lasts much longer. Renew the
// access token shortly before it runs out (and once more if the server still says 401), so
// people stay signed in instead of being logged out every half hour.

const RENEW_EARLY_MS = 60_000;

function tokenExpiresAt(token: string): number | null {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

let renewing: Promise<string | null> | null = null;

/**
 * Swap the refresh token for a new pair. Resolves null when the session is really over (no or
 * expired refresh token); throws when the server can't be reached, so a blip doesn't log anyone out.
 * Concurrent callers share one request.
 */
export function renewSession(): Promise<string | null> {
  renewing ??= (async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;
    const res = await fetch(`${getApiBaseUrl()}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (res.status === 400 || res.status === 401) return null;
    if (!res.ok) throw new Error("Couldn't reach the server. Try again.");
    const data = await res.json().catch(() => ({}));
    if (!data.access_token) return null;
    localStorage.setItem("accessToken", data.access_token);
    if (data.refresh_token) localStorage.setItem("refreshToken", data.refresh_token);
    return data.access_token as string;
  })().finally(() => {
    renewing = null;
  });
  return renewing;
}

/** The access token, renewed first when it's about to run out. */
export async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  const exp = tokenExpiresAt(token);
  if (exp === null || exp - Date.now() > RENEW_EARLY_MS) return token;
  const fresh = await renewSession();
  if (!fresh) {
    logoutOn401();
    throw new Error("Session expired");
  }
  return fresh;
}

/**
 * fetch with the session token. If the server still answers 401, renew once and retry; log out
 * only when the session can't be renewed.
 */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const send = (t: string | null) => {
    const headers = new Headers(init.headers);
    if (t) headers.set("Authorization", `Bearer ${t}`);
    return fetch(url, { ...init, headers });
  };
  const res = await send(token);
  if (res.status !== 401 || !token) return res;
  const fresh = await renewSession();
  if (!fresh) {
    logoutOn401();
    throw new Error("Session expired");
  }
  const retry = await send(fresh);
  if (retry.status === 401) {
    logoutOn401();
    throw new Error("Session expired");
  }
  return retry;
}
