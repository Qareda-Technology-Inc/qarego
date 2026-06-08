import { getApiBaseUrl } from "@/service/config";

/** Turn API-stored image path or URL into something Image can load */
export function resolveMediaUrl(stored?: string | null): string | null {
  if (!stored) return null;
  if (stored.startsWith("http://") || stored.startsWith("https://")) return stored;
  if (stored.startsWith("/")) {
    return `${getApiBaseUrl().replace(/\/$/, "")}${stored}`;
  }
  return stored;
}
