/**
 * Browser uses same-origin /api proxy (next.config.ts rewrites).
 */
import { resolveApiOrigin } from "@/lib/appEnvironment";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  return resolveApiOrigin();
}

/** Call when API returns 401 and we had a token – clears session and redirects to login */
export function logoutOn401() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

function getAuthHeaders(customHeaders?: HeadersInit): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || error.msg || "Something went wrong");
  }

  return res.json();
}

/** Multipart upload — local dev hits :2026; production uses cloud API origin. */
export async function uploadToApi(
  path: string,
  formData: FormData,
  method: "POST" | "PATCH" = "POST"
) {
  let base = getApiBaseUrl();
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const onLoopback = hostname === "localhost" || hostname === "127.0.0.1";
    if (!onLoopback) {
      base = `${protocol}//${hostname}:2026`;
    } else {
      base = resolveApiOrigin();
    }
  }
  const url = `${base}${path}`;
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const res = await fetch(url, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401 && token) {
    logoutOn401();
    throw new Error("Session expired");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.msg || `Request failed (${res.status})`);
  }
  return data;
}
