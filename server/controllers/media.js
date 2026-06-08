import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { StatusCodes } from "http-status-codes";
import {
  isCloudinaryConfigured,
  initCloudinary,
  uploadToCloudinary,
  safeUnlink,
  formatCloudinaryError,
} from "../utils/cloudinary.js";
import { BadRequestError } from "../errors/index.js";
import { localUploadToPublicPath } from "../utils/mediaStorage.js";
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_LABEL,
  assertImageUnderLimit,
  imageSizeErrorMessage,
} from "../utils/mediaLimits.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tmpDir = path.join(__dirname, "..", "uploads", "tmp");

/** GET /media/config — client checks if Cloudinary direct upload is available */
export const getMediaConfig = async (_req, res) => {
  res.status(StatusCodes.OK).json({
    cloudinaryEnabled: isCloudinaryConfigured(),
    uploadEndpoint: "/media/upload",
    maxImageSizeBytes: MAX_IMAGE_SIZE_BYTES,
    maxImageSizeLabel: MAX_IMAGE_SIZE_LABEL,
  });
};

function extFromMime(mimetype, originalname = "") {
  const map = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "application/pdf": ".pdf",
  };
  if (map[mimetype]) return map[mimetype];
  const ext = path.extname(originalname);
  return ext || ".jpg";
}

function isPdf(file) {
  return file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname || "");
}

/** POST /media/upload — image or PDF (auth required). Field: `file` or `image`. */
export const uploadImage = async (req, res) => {
  if (!req.file) {
    throw new BadRequestError(
      "No file provided. Use multipart field name 'file' or 'image'."
    );
  }

  try {
    assertImageUnderLimit(req.file.size, req.file.mimetype);
  } catch (sizeErr) {
    if (sizeErr.code === "IMAGE_TOO_LARGE") {
      throw new BadRequestError(imageSizeErrorMessage());
    }
    throw sizeErr;
  }

  const folder = `${process.env.CLOUDINARY_FOLDER || "qarego"}/${req.body?.folder || "uploads"}`;
  const resourceType = isPdf(req.file) ? "raw" : "image";

  const saveLocal = () => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const ext = extFromMime(req.file.mimetype, req.file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const diskPath = path.join(tmpDir, filename);
    fs.writeFileSync(diskPath, req.file.buffer);
    const publicPath = localUploadToPublicPath(diskPath);
    const base = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
    return {
      url: `${base.replace(/\/$/, "")}${publicPath}`,
      publicPath,
      provider: "local",
      resourceType,
    };
  };

  try {
    if (isCloudinaryConfigured()) {
      try {
        initCloudinary();
        const source = req.file.buffer?.length ? req.file.buffer : req.file.path;
        const result = await uploadToCloudinary(source, {
          folder,
          resourceType,
          timeoutMs: 30000,
        });
        if (req.file.path) safeUnlink(req.file.path);
        return res.status(StatusCodes.OK).json({
          url: result.url,
          publicId: result.publicId,
          provider: "cloudinary",
          resourceType,
        });
      } catch (cloudErr) {
        console.error("[media/upload] Cloudinary error:", cloudErr?.message || cloudErr);
        const code = cloudErr?.http_code || cloudErr?.error?.http_code;
        if (code === 403) {
          console.warn("[media/upload] Cloudinary 403:", formatCloudinaryError(cloudErr));
        }
        if (!req.file.buffer?.length) {
          throw new BadRequestError(
            "File was empty. Try again or use a smaller file (under 15 MB)."
          );
        }
        const local = saveLocal();
        return res.status(StatusCodes.OK).json({
          ...local,
          warning:
            code === 403
              ? formatCloudinaryError(cloudErr) + " File saved on API server for now."
              : "Cloudinary unavailable; file saved on API server for now.",
        });
      }
    }

    const local = saveLocal();
    return res.status(StatusCodes.OK).json(local);
  } catch (err) {
    console.error("[media/upload]", err?.message || err);
    const msg = err?.message || "Upload failed";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: msg, msg });
  }
};
