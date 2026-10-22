import { authFetch, getApiBaseUrl } from "./api";
import { assertImageFileUnderLimit } from "./mediaLimits";

export type UploadMediaResult = {
  url: string;
  publicId?: string;
  provider: "cloudinary" | "local";
  warning?: string;
};

const API_PORT = "2026";

/** localhost or a private LAN address: the API runs beside the admin on :2026. */
function isLocalDevHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const m = hostname.match(/^172\.(\d{1,3})\./);
  return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31;
}

/**
 * Where uploads go. Local dev talks to the API on :2026 directly; the deployed admin
 * (admin.qarego.com) uploads through its own /api proxy, like every other request.
 */
export function getMediaUploadBaseUrl(): string {
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (isLocalDevHost(hostname)) {
      const envUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_SOCKET_URL)?.trim();
      return envUrl ? envUrl.replace(/\/$/, "") : `${protocol}//${hostname}:${API_PORT}`;
    }
  }
  return getApiBaseUrl();
}

/** Upload image or PDF to POST /media/upload */
export async function uploadMediaFile(
  file: File,
  folder = "drivers/documents"
): Promise<UploadMediaResult> {
  assertImageFileUnderLimit(file);

  if (typeof window !== "undefined" && !localStorage.getItem("accessToken")) {
    throw new Error("Please sign in again to upload files.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const uploadUrl = `${getMediaUploadBaseUrl()}/media/upload`;
  const timeoutMs = 90_000;

  let res: Response;
  try {
    res = await authFetch(uploadUrl, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Session expired") throw err;
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
