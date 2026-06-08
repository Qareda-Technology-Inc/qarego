/**
 * Masks a phone number for privacy
 * Example: +233501234567 -> +233 501 *** 567
 */
export const maskPhone = (phone: string): string => {
  if (!phone) return "";

  // Remove any non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, "");

  // If phone starts with +, preserve country code
  if (cleaned.startsWith("+")) {
    // Extract country code (usually 1-3 digits after +)
    const match = cleaned.match(/^(\+\d{1,3})(\d{3})(\d+)(\d{3})$/);
    if (match) {
      const [, countryCode, first3, middle, last3] = match;
      return `${countryCode} ${first3} *** ${last3}`;
    }
  }

  // For numbers without country code
  if (cleaned.length >= 6) {
    const first3 = cleaned.slice(0, 3);
    const last3 = cleaned.slice(-3);
    return `${first3} *** ${last3}`;
  }

  // If too short, just mask middle
  if (cleaned.length >= 4) {
    const first2 = cleaned.slice(0, 2);
    const last2 = cleaned.slice(-2);
    return `${first2} *** ${last2}`;
  }

  return "***";
};
