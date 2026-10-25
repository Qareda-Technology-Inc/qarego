// Arkesel's OTP service (https://developers.arkesel.com → One Time Password): Arkesel makes the
// code, sends it on its OTP route and checks it, so nothing about the code is kept here.
// Uses the main SMS API key (ARKASEL_API_KEY); Arkesel's OTP doesn't work with sub-keys.
import axios from "axios";

const BASE = process.env.ARKESEL_OTP_URL || "https://sms.arkesel.com/api/otp";
/** Arkesel's codes are 6–15 characters. */
export const ARKESEL_OTP_LENGTH = 6;
export const ARKESEL_OTP_EXPIRY_MIN = 5;

export const isArkeselOtpConfigured = () =>
  !!process.env.ARKASEL_API_KEY && process.env.ARKESEL_OTP_ENABLED !== "false";

/** "+233241234567" → "233241234567" */
const toNumber = (phone) => String(phone || "").replace(/\D/g, "");

const client = () =>
  axios.create({
    baseURL: BASE,
    timeout: 15_000,
    headers: { "api-key": process.env.ARKASEL_API_KEY, "Content-Type": "application/json" },
    // Arkesel answers errors with JSON and a 4xx/5xx; read the body either way.
    validateStatus: () => true,
  });

/**
 * Send a sign-in code. Returns { ok: true, ussdCode } (the code can also be read by dialling
 * that USSD code from the same phone), or { ok: false, code, error }.
 */
export async function sendArkeselOtp(phone) {
  try {
    const res = await client().post("/generate", {
      expiry: ARKESEL_OTP_EXPIRY_MIN,
      length: ARKESEL_OTP_LENGTH,
      medium: "sms",
      message: "Your QareGO code is %otp_code%. It expires in %expiry% minutes. Never share it with anyone.",
      number: toNumber(phone),
      sender_id: (process.env.ARKASEL_SENDER_ID || "QareGO").slice(0, 11),
      type: "numeric",
    });
    const code = String(res.data?.code ?? "");
    if (code === "1000") return { ok: true, ussdCode: res.data?.ussd_code || null };
    return { ok: false, code, error: res.data?.message || `Arkesel OTP failed (HTTP ${res.status})` };
  } catch (err) {
    return { ok: false, code: null, error: err.message || "Arkesel OTP unreachable" };
  }
}

/**
 * Check a code with Arkesel. Returns { ok: true } or { ok: false, reason: "invalid" | "expired" | "error", error }.
 */
export async function verifyArkeselOtp(phone, otp) {
  try {
    const res = await client().post("/verify", { code: String(otp), number: toNumber(phone) });
    const code = String(res.data?.code ?? "");
    if (code === "1100") return { ok: true };
    if (code === "1104") return { ok: false, reason: "invalid", error: res.data?.message };
    if (code === "1105") return { ok: false, reason: "expired", error: res.data?.message };
    // 1102/1103: Arkesel has no code waiting for this number (never sent, already used or gone).
    if (code === "1102" || code === "1103") return { ok: false, reason: "expired", error: res.data?.message };
    return { ok: false, reason: "error", error: res.data?.message || `Arkesel verify failed (HTTP ${res.status})` };
  } catch (err) {
    return { ok: false, reason: "error", error: err.message || "Arkesel OTP unreachable" };
  }
}
