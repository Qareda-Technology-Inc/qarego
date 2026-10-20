/** Same as merchant/src/lib/prepareImage.ts, plus the admin-only shapes. */
import { MAX_IMAGE_SIZE_BYTES } from "./mediaLimits";

/** A rectangle in the source image's own pixels (what react-easy-crop calls croppedAreaPixels). */
export type PixelArea = { x: number; y: number; width: number; height: number };

/** The shape and size an upload slot needs. Without a crop the whole photo is kept, only shrunk. */
export type ImageShape =
  | { crop: true; aspect: number; width: number; height: number }
  | { crop: false; maxEdge: number };

export const IMAGE_SHAPES = {
  /** Menu items and products */
  square: { crop: true, aspect: 1, width: 800, height: 800 },
  /** Store cover: grid cards are ~1.6:1, the store page and wide cards are wider */
  wide: { crop: true, aspect: 16 / 9, width: 1280, height: 720 },
  /** Licences and documents: never cut anything off */
  document: { crop: false, maxEdge: 1800 },
  /** Home-screen promo banner in the customer app (2.4:1) */
  promoBanner: { crop: true, aspect: 1080 / 450, width: 1080, height: 450 },
  /** Rider profile photo: the form has no crop step, so keep the whole photo, just smaller */
  profile: { crop: false, maxEdge: 800 },
} satisfies Record<string, ImageShape>;

export type ImageShapeName = keyof typeof IMAGE_SHAPES;

const HEIC_HELP =
  "This browser can't open that photo (iPhone HEIC). In Photos choose “Most Compatible”, export it as JPEG, or try Safari.";

/** Read a picked file into an image the canvas can draw. Throws a readable message if the browser can't decode it. */
export async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    // onload, not img.decode(): decode() can stall while the tab is in the background.
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    if (!img.naturalWidth) throw new Error("empty image");
    return img;
  } catch {
    URL.revokeObjectURL(url);
    const t = file.type.toLowerCase();
    const heic = t.includes("heic") || t.includes("heif") || /\.hei[cf]$/i.test(file.name);
    throw new Error(heic ? HEIC_HELP : "Couldn't open that image. Use a JPG or PNG photo.");
  }
  // The URL stays alive on purpose: browsers may re-read it when the canvas draws the image later.
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process the image"))), "image/jpeg", quality)
  );
}

/**
 * Crop (optional), scale to the slot's size and save as JPEG under the upload limit.
 * Quality steps down first; if that isn't enough the picture gets smaller.
 */
export async function prepareImage(
  img: HTMLImageElement,
  shape: ImageShape,
  area?: PixelArea,
  baseName = "photo"
): Promise<File> {
  const src = area ?? { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
  let outW: number;
  let outH: number;
  if (shape.crop) {
    // Never blow a small photo up past what it has.
    const scale = Math.min(1, src.width / shape.width);
    outW = Math.round(shape.width * scale);
    outH = Math.round(shape.height * scale);
  } else {
    const scale = Math.min(1, shape.maxEdge / Math.max(src.width, src.height));
    outW = Math.round(src.width * scale);
    outH = Math.round(src.height * scale);
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the image in this browser");

  for (let attempt = 0; attempt < 6; attempt++) {
    canvas.width = Math.max(1, outW);
    canvas.height = Math.max(1, outH);
    // JPEG has no transparency: put PNG logos on white, not black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, src.x, src.y, src.width, src.height, 0, 0, canvas.width, canvas.height);

    for (const q of [0.86, 0.78, 0.7, 0.6]) {
      const blob = await toBlob(canvas, q);
      if (blob.size <= MAX_IMAGE_SIZE_BYTES) {
        const name = `${baseName.replace(/\.[^.]+$/, "") || "photo"}.jpg`;
        return new File([blob], name, { type: "image/jpeg" });
      }
    }
    outW = Math.round(outW * 0.8);
    outH = Math.round(outH * 0.8);
  }
  throw new Error("Couldn't make this photo small enough. Try a different photo.");
}
