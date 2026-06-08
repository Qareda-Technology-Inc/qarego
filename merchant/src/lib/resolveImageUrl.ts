/**
 * Turn API-relative /uploads paths into a full URL the browser can load.
 * Cloudinary https URLs are returned unchanged.
 */
export function resolveImageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (!url.startsWith("/")) return url;

  const base =
    (typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_BASE_URL
      : process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_PROXY_TARGET) ||
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    "";

  const trimmed = String(base).replace(/\/$/, "");
  return trimmed ? `${trimmed}${url}` : url;
}
