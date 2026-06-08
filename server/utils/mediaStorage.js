import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  isCloudinaryConfigured,
  initCloudinary,
  uploadToCloudinary,
  safeUnlink,
} from "./cloudinary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.join(__dirname, "..");
const tmpDir = path.join(serverRoot, "uploads", "tmp");

/** Turn multer disk path into a URL path served by express.static('/uploads') */
export function localUploadToPublicPath(absolutePath) {
  if (!absolutePath) return null;
  const uploadsRoot = path.join(serverRoot, "uploads");
  const relative = path.relative(uploadsRoot, absolutePath).replace(/\\/g, "/");
  if (relative.startsWith("..")) return absolutePath;
  return `/uploads/${relative}`;
}

function isPdfFile(file) {
  return (
    file.mimetype === "application/pdf" ||
    /\.pdf$/i.test(file.originalname || "")
  );
}

function isImageFile(file) {
  return file.mimetype?.startsWith("image/");
}

function writeBufferToTmp(file) {
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const ext = path.extname(file.originalname || "") || (isPdfFile(file) ? ".pdf" : ".jpg");
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const diskPath = path.join(tmpDir, filename);
  fs.writeFileSync(diskPath, file.buffer);
  return diskPath;
}

/**
 * After multer saves a file (disk or memory): Cloudinary if configured, else local /uploads path.
 * Supports images and PDFs.
 */
export async function persistMulterFile(file, subfolder = "misc") {
  if (!file) return null;
  if (!isImageFile(file) && !isPdfFile(file)) return null;

  let diskPath = file.path;
  let createdTemp = false;

  if (!diskPath && file.buffer?.length) {
    diskPath = writeBufferToTmp(file);
    createdTemp = true;
  }
  if (!diskPath) return null;

  if (isCloudinaryConfigured()) {
    initCloudinary();
    const folder = `${process.env.CLOUDINARY_FOLDER || "qarego"}/${subfolder}`;
    const resourceType = isPdfFile(file) ? "raw" : "image";
    const { url } = await uploadToCloudinary(diskPath, { folder, resourceType });
    if (file.path) safeUnlink(file.path);
    if (createdTemp) safeUnlink(diskPath);
    return url;
  }

  const publicPath = localUploadToPublicPath(diskPath);
  if (createdTemp) return publicPath;
  return publicPath;
}

/** @deprecated Use persistMulterFile */
export async function persistMulterImage(file, subfolder = "misc") {
  return persistMulterFile(file, subfolder);
}

/** Accept Cloudinary/https URLs or local /uploads paths only */
export function sanitizeMediaUrl(url) {
  if (url == null || url === "") return null;
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) return trimmed;
  if (trimmed.startsWith("/uploads/")) return trimmed;
  return null;
}

/** @deprecated Use sanitizeMediaUrl */
export function sanitizeImageUrl(url) {
  return sanitizeMediaUrl(url);
}

export function resolveMediaUrl(stored, req) {
  if (!stored) return null;
  if (stored.startsWith("http://") || stored.startsWith("https://")) return stored;
  const base =
    process.env.PUBLIC_API_URL ||
    (req ? `${req.protocol}://${req.get("host")}` : "");
  const pathPart = stored.startsWith("/") ? stored : `/${stored}`;
  return base ? `${base.replace(/\/$/, "")}${pathPart}` : pathPart;
}
