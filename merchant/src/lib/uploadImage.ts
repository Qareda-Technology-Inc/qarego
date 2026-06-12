import { logoutOn401 } from "./api";
import { resolveMediaUploadBaseUrl } from "./backendUrl";
import { assertImageFileUnderLimit } from "./mediaLimits";

export type UploadImageResult = {
  url: string;
  publicId?: string;
  provider: "cloudinary" | "local";
  warning?: string;
};

export function getMediaUploadBaseUrl(): string {
  return resolveMediaUploadBaseUrl();
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

  const uploadBase = getMediaUploadBaseUrl();
  const uploadUrl = `${uploadBase}/media/upload`;
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
        `Upload timed out after ${timeoutMs / 1000}s. Check the API at ${uploadBase} and Cloudinary credentials in server/.env.`
      );
    }
    const hint =
      uploadBase.includes("/api")
        ? "Check API_PROXY_TARGET on Vercel points to your cloud server."
        : "Start the API on port 2026, or set NEXT_PUBLIC_API_BASE_URL in merchant/.env.";
    throw new Error(`Could not reach the API at ${uploadBase}. ${hint}`);
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
        ? "Server error during upload. Check Cloudinary credentials on the API server."
        : `Upload failed (${res.status})`);
    throw new Error(detail);
  }
  if (!data.url) {
    throw new Error("Upload succeeded but no image URL was returned.");
  }
  return data;
}
