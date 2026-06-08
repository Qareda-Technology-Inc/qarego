/**
 * Browser always uses same-origin proxy: /api → backend (next.config.ts rewrites).
 * Do NOT use NEXT_PUBLIC_* for client URLs (gets baked into old builds as :5000).
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  const target =
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:2026";
  return String(target).replace(/\/$/, "");
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

/** Multipart upload — prefers direct API port for large files when not on localhost proxy. */
export async function uploadToApi(
  path: string,
  formData: FormData,
  method: "POST" | "PATCH" = "POST"
) {
  let base = getApiBaseUrl();
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const onLoopback = hostname === "localhost" || hostname === "127.0.0.1";
    const envUrl = (
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_SOCKET_URL
    )?.trim();
    if (!onLoopback) {
      base = `${protocol}//${hostname}:2026`;
    } else if (envUrl) {
      base = envUrl.replace(/\/$/, "");
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
