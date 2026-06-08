/** Must match server/utils/mediaLimits.js */
export const MAX_IMAGE_SIZE_BYTES = 500 * 1024;
export const MAX_IMAGE_SIZE_LABEL = "500 KB";

export function imageSizeErrorMessage(): string {
  return `Image must be under ${MAX_IMAGE_SIZE_LABEL}. Choose a smaller photo or compress it before uploading.`;
}

export function isImageFile(file: File): boolean {
  const type = file.type?.toLowerCase() || "";
  if (type.startsWith("image/")) return true;
  const name = file.name?.toLowerCase() || "";
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(name);
}

export function assertImageFileUnderLimit(file: File): void {
  if (!isImageFile(file)) return;
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(imageSizeErrorMessage());
  }
}
