import fs from "fs";

let admin = null;
let messaging = null;

function loadServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json && json.trim()) {
    const trimmed = json.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      // Allow .env value wrapped in extra quotes
      return JSON.parse(trimmed.replace(/^['"]|['"]$/g, ""));
    }
  }
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath && fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  return null;
}

export function isFirebaseConfigured() {
  return !!loadServiceAccount();
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
