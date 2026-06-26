/**
 * Backend origin for sockets, uploads, and kitchen alert sounds.
 */

import {
  getProductionApiUrl,
  isProductionApi,
  LOCAL_API_URL,
  resolveApiOrigin,
} from "@/lib/appEnvironment";

const API_PORT = "2026";

function getEnvBackendUrl(): string | null {
  if (isProductionApi()) {
    const cloud = getProductionApiUrl();
    if (cloud) return cloud;
  }

  const url = (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL
  )?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isPrivateLanHost(hostname: string): boolean {
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const m = hostname.match(/^172\.(\d{1,3})\./);
  if (m) {
    const second = Number(m[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

/** localhost, 127.0.0.1, or private LAN IP — API runs beside merchant on :2026 */
export function isLocalDevHost(hostname: string): boolean {
  return isLoopbackHost(hostname) || isPrivateLanHost(hostname);
}

/**
 * Socket.io and absolute media URLs — needs the real API origin (not /api).
 * On Vercel set NEXT_PUBLIC_SOCKET_URL=https://qarego.onrender.com
 */
export function resolveBackendOrigin(): string {
  const fromEnv = getEnvBackendUrl();
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (isLocalDevHost(hostname)) {
      return `${protocol}//${hostname}:${API_PORT}`;
    }
  }

  return (
    process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") || `http://127.0.0.1:${API_PORT}`
  );
}

/**
 * Multipart uploads — local dev hits :2026 directly; deployed uses /api proxy (10mb limit in next.config).
 */
export function resolveMediaUploadBaseUrl(): string {
  const fromEnv = getEnvBackendUrl();
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    const { protocol, hostname, origin } = window.location;
    if (isLocalDevHost(hostname)) {
      return `${protocol}//${hostname}:${API_PORT}`;
    }
    return `${origin}/api`;
  }

  const serverTarget = resolveApiOrigin();
  if (serverTarget) return serverTarget.replace(/\/$/, "");
  return LOCAL_API_URL;
}

/** Rewrite localhost sound/upload URLs so LAN tablets can load them. */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    const base = resolveBackendOrigin();
    return `${base}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
  }

  if (typeof window === "undefined") return trimmed;

  try {
    const parsed = new URL(trimmed);
    const isLocalHost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const pageHost = window.location.hostname;
    if (isLocalHost && pageHost !== "localhost" && pageHost !== "127.0.0.1") {
      const backend = new URL(resolveBackendOrigin());
      parsed.protocol = backend.protocol;
      parsed.hostname = backend.hostname;
      parsed.port = backend.port;
      return parsed.toString();
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}
