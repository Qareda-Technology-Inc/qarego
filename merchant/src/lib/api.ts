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

function getAuthHeaders(customHeaders?: HeadersInit): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const activeRestaurantId =
    typeof window !== "undefined" ? localStorage.getItem("activeRestaurantId") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeRestaurantId ? { "x-restaurant-id": activeRestaurantId } : {}),
    ...customHeaders,
  };
}

export async function fetcher(url: string, options: RequestInit = {}) {
  const base = getApiBaseUrl();
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const res = await fetch(`${base}${url}`, {
    ...options,
    headers: getAuthHeaders(options.headers as HeadersInit),
  });

  if (res.status === 401 && token) {
    logoutOn401();
    throw new Error("Session expired");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.msg || "Something went wrong");
  }
  return data;
}
