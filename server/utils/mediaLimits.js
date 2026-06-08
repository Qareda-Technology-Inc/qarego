/** Cloudinary free tier storage cut — images must stay under 500 KB */
export const MAX_IMAGE_SIZE_BYTES = 500 * 1024;
export const MAX_IMAGE_SIZE_LABEL = "500 KB";

export function imageSizeErrorMessage() {
  return `Image must be under ${MAX_IMAGE_SIZE_LABEL}. Choose a smaller photo or compress it before uploading.`;
}

export function isImageMime(mimetype) {
  return Boolean(mimetype?.startsWith("image/"));
}

export function assertImageUnderLimit(sizeBytes, mimetype) {
  if (!isImageMime(mimetype)) return;
  const size = Number(sizeBytes) || 0;
  if (size > MAX_IMAGE_SIZE_BYTES) {
    const err = new Error(imageSizeErrorMessage());
    err.code = "IMAGE_TOO_LARGE";
    err.statusCode = 400;
    throw err;
  }
}
