import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

let configured = false;

/** Prefer explicit CLOUDINARY_* vars (reliable); CLOUDINARY_URL is optional fallback */
export function getCloudinaryCredentials() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cloud_name && api_key && api_secret) {
    return { cloud_name, api_key, api_secret, secure: true };
  }
  return null;
}

export function isCloudinaryConfigured() {
  return !!getCloudinaryCredentials() || !!process.env.CLOUDINARY_URL?.trim();
}

export function initCloudinary() {
  const creds = getCloudinaryCredentials();
  if (creds) {
    cloudinary.config(creds);
    configured = true;
    return true;
  }
  // SDK reads CLOUDINARY_URL from process.env when passed true
  if (process.env.CLOUDINARY_URL?.trim()) {
    cloudinary.config(true);
    configured = true;
    return true;
  }
  configured = false;
  return false;
}

function ensureInit() {
  if (!configured) initCloudinary();
  if (!configured) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_* env variables.");
  }
  const cfg = cloudinary.config();
  if (!cfg?.api_key) {
    throw new Error(
      "Cloudinary api_key missing after init. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env"
    );
  }
}

/**
 * Upload from a local file path (multer disk) or buffer.
 * @returns {{ url: string, publicId: string }}
 */
function withTimeout(promise, ms, label = "upload") {
  if (!ms || ms <= 0) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/** Turn Cloudinary HTTP errors into actionable messages */
export function formatCloudinaryError(err) {
  const raw = err?.error?.message || err?.message || String(err);
  if (raw.includes('actions=["create"]') || raw.includes("missing permissions")) {
    return (
      "This Cloudinary API key cannot upload (missing create permission). " +
      "In Cloudinary Console → Settings → API Keys → open your key → enable Upload / create, " +
      "or create a new key with full access, then update server/.env."
    );
  }
  if (err?.http_code === 403) {
    return `Cloudinary forbidden (403): ${raw}`;
  }
  return raw;
}

export async function uploadToCloudinary(source, options = {}) {
  ensureInit();
  const folder = options.folder || process.env.CLOUDINARY_FOLDER || "qarego";
  const timeoutMs = options.timeoutMs ?? 45000;

  const uploadOptions = {
    folder,
    resource_type: options.resourceType || "image",
    ...(options.publicId ? { public_id: options.publicId } : {}),
  };

  let result;
  if (Buffer.isBuffer(source)) {
    result = await withTimeout(
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, res) => {
          if (err) reject(err);
          else if (!res) reject(new Error("Empty Cloudinary response"));
          else resolve(res);
        });
        stream.end(source);
      }),
      timeoutMs,
      "Cloudinary upload"
    );
  } else {
    result = await withTimeout(
      cloudinary.uploader.upload(source, uploadOptions),
      timeoutMs,
      "Cloudinary upload"
    );
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
}

export async function deleteFromCloudinary(publicId, resourceType = "image") {
  if (!publicId || !isCloudinaryConfigured()) return;
  ensureInit();
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

/**
 * Public id + resource type from a Cloudinary delivery URL, e.g.
 * https://res.cloudinary.com/<cloud>/image/upload/v123/qarego/drivers/abc.jpg
 *   → { publicId: "qarego/drivers/abc", resourceType: "image" }
 * Raw files (PDFs) keep their extension in the public id.
 */
export function parseCloudinaryUrl(url) {
  const m = String(url || "").match(/res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\/(.+)$/);
  if (!m) return null;
  const resourceType = m[1];
  let parts = decodeURIComponent(m[2].split("?")[0]).split("/");
  const versionAt = parts.findIndex((p) => /^v\d+$/.test(p));
  if (versionAt >= 0) {
    parts = parts.slice(versionAt + 1);
  } else {
    // No version: drop leading transformation segments like "c_fill,w_200".
    while (parts.length > 1 && /^[a-z]{1,3}_[^/]*$/.test(parts[0])) parts.shift();
  }
  const path = parts.join("/");
  if (!path) return null;
  const publicId = resourceType === "raw" ? path : path.replace(/\.[a-z0-9]+$/i, "");
  return { publicId, resourceType };
}

/** Remove temp multer file after Cloudinary upload */
export function safeUnlink(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}
