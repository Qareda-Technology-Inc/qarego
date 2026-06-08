/** Must match server/utils/mediaLimits.js */
export const MAX_IMAGE_SIZE_BYTES = 500 * 1024;
export const MAX_IMAGE_SIZE_LABEL = "500 KB";

export function imageSizeErrorMessage(): string {
  return `Image must be under ${MAX_IMAGE_SIZE_LABEL}. Choose a smaller photo or compress it before uploading.`;
}

export function isImageMimeType(mime: string): boolean {
  return mime.toLowerCase().startsWith("image/");
}

export function assertImageBytesUnderLimit(sizeBytes: number): void {
  if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(imageSizeErrorMessage());
  }
}

/** Get byte size of a local file/content URI (React Native). */
export async function getLocalUriByteSize(uri: string): Promise<number> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return blob.size;
}

export async function assertLocalImageUriUnderLimit(uri: string, mimeType: string): Promise<void> {
  if (!isImageMimeType(mimeType)) return;
  const size = await getLocalUriByteSize(uri);
  assertImageBytesUnderLimit(size);
}
