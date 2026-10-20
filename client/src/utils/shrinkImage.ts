import {
  MAX_IMAGE_SIZE_BYTES,
  assertImageBytesUnderLimit,
  getLocalUriByteSize,
} from "@/utils/mediaLimits";

type Manipulator = typeof import("expo-image-manipulator");
let Manip: Manipulator | null = null;
try {
  Manip = require("expo-image-manipulator");
} catch {
  /* app built before the module was added: fall back to the size check */
}

/** Longest side for each kind of photo. */
export const SHRINK_MAX_EDGE = {
  profile: 800,
  parcel: 1280,
  /** Prescriptions must stay readable */
  document: 1800,
} as const;

type Picked = { uri: string; width?: number; height?: number; fileSize?: number | null };

/**
 * Make a picked photo fit the upload limit: scale the longest side down to `maxEdge`,
 * then save as JPEG, lowering quality and then size until it is under 500 KB.
 * Throws the usual "too large" message only if that still fails.
 */
export async function shrinkPickedImage(asset: Picked, maxEdge: number): Promise<string> {
  if (!Manip) {
    if (asset.fileSize != null) assertImageBytesUnderLimit(asset.fileSize);
    return asset.uri;
  }
  const { ImageManipulator, SaveFormat } = Manip;
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  let edge = Math.min(maxEdge, Math.max(w, h) || maxEdge);

  for (let attempt = 0; attempt < 4; attempt++) {
    const ctx = ImageManipulator.manipulate(asset.uri);
    // Resize by the longest side; the other side keeps the photo's shape.
    if (w && h && Math.max(w, h) > edge) ctx.resize(w >= h ? { width: edge } : { height: edge });
    const image = await ctx.renderAsync();
    try {
      for (const compress of [0.8, 0.7, 0.6]) {
        const out = await image.saveAsync({ compress, format: SaveFormat.JPEG });
        if ((await getLocalUriByteSize(out.uri)) <= MAX_IMAGE_SIZE_BYTES) return out.uri;
      }
    } finally {
      image.release();
      ctx.release();
    }
    edge = Math.round(edge * 0.75);
  }
  assertImageBytesUnderLimit(MAX_IMAGE_SIZE_BYTES + 1);
  return asset.uri;
}
