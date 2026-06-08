/**
 * Normalize Ghana-style numbers to E.164 (+233…).
 */
export function normalizePhone(phone) {
  if (phone == null || phone === "") return "";
  let p = String(phone).trim().replace(/[\s-]/g, "");
  if (p.startsWith("+")) return p;
  if (p.startsWith("00")) return `+${p.slice(2)}`;
  if (p.startsWith("0") && p.length >= 10) return `+233${p.slice(1)}`;
  if (p.startsWith("233")) return `+${p}`;
  if (/^\d{9}$/.test(p)) return `+233${p}`;
  return p;
}
