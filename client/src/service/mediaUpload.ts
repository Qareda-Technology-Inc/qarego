import { appAxios } from "./apiInterceptors";
import { getApiBaseUrl } from "./config";
import { assertLocalImageUriUnderLimit } from "@/utils/mediaLimits";

export type UploadMediaResult = {
  url: string;
  publicId?: string;
  provider: "cloudinary" | "local";
  warning?: string;
};

/**
 * Upload a local image or document URI (images + PDF) via POST /media/upload.
 */
export async function uploadMediaUri(
  uri: string,
  folder = "profiles"
): Promise<UploadMediaResult> {
  const filename = uri.split("/").pop() || "file.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const ext = (match?.[1] || "jpg").toLowerCase();
  const type =
    ext === "pdf"
      ? "application/pdf"
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";

  await assertLocalImageUriUnderLimit(uri, type);

  const formData = new FormData();
  formData.append("folder", folder);
  // @ts-expect-error React Native FormData file blob
  formData.append("file", { uri, name: filename, type });

  const res = await appAxios.post("/media/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  const data = res.data ?? {};
  const storedUrl =
    typeof data.publicPath === "string" && data.publicPath.startsWith("/")
      ? data.publicPath
      : data.url;

  return {
    ...data,
    url: storedUrl,
  };
}

/** @deprecated Use uploadMediaUri */
export async function uploadImageUri(
  uri: string,
  folder = "profiles"
): Promise<UploadMediaResult> {
  return uploadMediaUri(uri, folder);
}

export function resolveImageUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith("http://") || stored.startsWith("https://")) return stored;
  if (stored.startsWith("/")) {
    return `${getApiBaseUrl().replace(/\/$/, "")}${stored}`;
  }
  return stored;
}

export const resolveMediaUrl = resolveImageUrl;
