import fs from "fs";

let admin = null;
let messaging = null;

function parseServiceAccountJson(raw) {
  const trimmed = raw?.trim?.();
  if (!trimmed) return null;
  const unwrapped = trimmed.replace(/^['"]|['"]$/g, "");
  // Render secret files are exposed as filesystem paths (commonly /etc/secrets/*).
  if (fs.existsSync(unwrapped)) {
    return JSON.parse(fs.readFileSync(unwrapped, "utf8"));
  }
  try {
    return JSON.parse(unwrapped);
  } catch {
    return null;
  }
}

function loadServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json && json.trim()) return parseServiceAccountJson(json);
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath && fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  return null;
}

export function isFirebaseConfigured() {
  return !!loadServiceAccount();
}

export function getFirebaseConfigSource() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json && json.trim()) {
    const trimmed = json.trim();
    const unwrapped = trimmed.replace(/^['"]|['"]$/g, "");
    if (fs.existsSync(unwrapped)) return "json_path";
    if (parseServiceAccountJson(json)) return "json";
    return "invalid_json";
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath && fs.existsSync(filePath)) return "path";
  if (filePath) return "missing_path_file";
  return "none";
}

export async function getFirebaseMessaging() {
  if (messaging) return messaging;
  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) return null;

  const firebaseAdmin = await import("firebase-admin");
  if (!admin) {
    admin = firebaseAdmin.default.apps.length
      ? firebaseAdmin.default.app()
      : firebaseAdmin.default.initializeApp({
          credential: firebaseAdmin.default.credential.cert(serviceAccount),
        });
  }
  messaging = admin.messaging();
  return messaging;
}
