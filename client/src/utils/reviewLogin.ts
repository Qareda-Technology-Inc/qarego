export type ReviewRole = "customer" | "rider";

export type ReviewAccount = {
  role: ReviewRole;
  otp: string;
};

function localDigits(rawPhone: string) {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("233")) local = local.slice(3);
  if (local.startsWith("0") && local.length >= 10) local = local.slice(1);
  return { digits, local };
}

/** Google Play review phones: 22222222 (customer), 11111111 (rider). */
export function getReviewAccount(rawPhone: string | null | undefined): ReviewAccount | null {
  if (rawPhone == null || rawPhone === "") return null;

  const { digits, local } = localDigits(rawPhone);

  if (/^2{8,}$/.test(local) || /^2{8,}$/.test(digits)) {
    return { role: "customer", otp: "0000" };
  }
  if (/^1{8,}$/.test(local) || /^1{8,}$/.test(digits)) {
    return { role: "rider", otp: "1111" };
  }
  return null;
}

export function isReviewPhone(rawPhone: string | null | undefined): boolean {
  return getReviewAccount(rawPhone) != null;
}

export function getReviewOtp(rawPhone: string | null | undefined): string | null {
  return getReviewAccount(rawPhone)?.otp ?? null;
}
