import { getApiBaseUrl } from "./api";

/** Resolve stored path or Cloudinary URL for display in admin */
export function resolveMediaUrl(stored?: string | null): string | null {
  if (!stored) return null;
  if (stored.startsWith("http://") || stored.startsWith("https://")) return stored;
  if (stored.startsWith("/")) {
    return `${getApiBaseUrl().replace(/\/$/, "")}${stored}`;
  }
  return stored;
}
