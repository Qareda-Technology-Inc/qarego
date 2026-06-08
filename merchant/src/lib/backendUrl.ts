/**
 * Resolve the backend origin for sockets, uploads, and alert sounds.
 * Uses NEXT_PUBLIC_API_BASE_URL when set; otherwise same host as the merchant app on port 2026.
 */
export function resolveBackendOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:2026`;
  }

  return (
    process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") || "http://127.0.0.1:2026"
  );
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
