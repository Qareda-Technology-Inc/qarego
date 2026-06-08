import { getApiBaseUrl, logoutOn401 } from "./api";
import { assertImageFileUnderLimit } from "./mediaLimits";

export type UploadImageResult = {
  url: string;
  publicId?: string;
  provider: "cloudinary" | "local";
  warning?: string;
};

const API_PORT = "2026";

/**
 * Uploads must hit the API directly on port 2026 (not /api on 3001 — large files fail).
 * If you open merchant as http://192.168.x.x:3001, uploads must go to http://192.168.x.x:2026,
 * not 127.0.0.1 (that only works on the same computer as the API).
 */
export function getMediaUploadBaseUrl(): string {
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const onLoopback = hostname === "localhost" || hostname === "127.0.0.1";
    const envUrl = (
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_SOCKET_URL
    )?.trim();

    if (!onLoopback) {
      return `${protocol}//${hostname}:${API_PORT}`;
    }
    if (envUrl) return envUrl.replace(/\/$/, "");
    return `${protocol}//${hostname}:${API_PORT}`;
  }

  const direct =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (direct) return direct.replace(/\/$/, "");
  return getApiBaseUrl();
}

/**
 * Upload an image file to POST /media/upload (Cloudinary when configured).
 */
export async function uploadImageFile(file: File, folder = "stores"): Promise<UploadImageResult> {
  assertImageFileUnderLimit(file);

  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (!token) {
    throw new Error("Please sign in again to upload images.");
  }

  const activeRestaurantId =
    typeof window !== "undefined" ? localStorage.getItem("activeRestaurantId") : null;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const uploadUrl = `${getMediaUploadBaseUrl()}/media/upload`;
  const timeoutMs = 90_000;

  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(activeRestaurantId ? { "x-restaurant-id": activeRestaurantId } : {}),
      },
      body: formData,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(
        `Upload timed out after ${timeoutMs / 1000}s. Check the API is running at ${getMediaUploadBaseUrl()} and Cloudinary credentials in server/.env.`
      );
    }
    throw new Error(
      `Could not reach the API at ${getMediaUploadBaseUrl()}. Start the server (port ${API_PORT}) on the same machine, or open merchant at http://127.0.0.1:3001 if the API is local only.`
    );
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    logoutOn401();
    throw new Error("Session expired — sign in again.");
  }
  if (!res.ok) {
    const detail =
      data.message ||
      data.msg ||
      (res.status === 500
        ? "Server error during upload. Restart the API (port 2026) and use an image under 500 KB."
        : `Upload failed (${res.status})`);
    throw new Error(detail);
  }
  if (!data.url) {
    throw new Error("Upload succeeded but no image URL was returned.");
  }
  return data;
}
