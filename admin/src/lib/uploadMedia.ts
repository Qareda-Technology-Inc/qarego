import { getApiBaseUrl, logoutOn401 } from "./api";
import { assertImageFileUnderLimit } from "./mediaLimits";

export type UploadMediaResult = {
  url: string;
  publicId?: string;
  provider: "cloudinary" | "local";
  warning?: string;
};

const API_PORT = "2026";

/**
 * Uploads hit the API on port 2026 directly (Next /api proxy can fail on large multipart).
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

/** Upload image or PDF to POST /media/upload */
export async function uploadMediaFile(
  file: File,
  folder = "drivers/documents"
): Promise<UploadMediaResult> {
  assertImageFileUnderLimit(file);

  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (!token) {
    throw new Error("Please sign in again to upload files.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const uploadUrl = `${getMediaUploadBaseUrl()}/media/upload`;
  const timeoutMs = 90_000;

  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(
        `Upload timed out. Check the API is running at ${getMediaUploadBaseUrl()}.`
      );
    }
    throw new Error(
      `Could not reach the API at ${getMediaUploadBaseUrl()}. Start the server on port ${API_PORT}.`
    );
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    logoutOn401();
    throw new Error("Session expired — sign in again.");
  }
  if (!res.ok) {
    throw new Error(
      data.message ||
        data.msg ||
        (res.status === 500
          ? "Server error during upload. Images must be under 500 KB."
          : `Upload failed (${res.status})`)
    );
  }
  if (!data.url) {
    throw new Error("Upload succeeded but no URL was returned.");
  }
  return data;
}
