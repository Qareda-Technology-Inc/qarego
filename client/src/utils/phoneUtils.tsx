
let Localization: any = null;

try {
  Localization = require("expo-localization");
} catch {
  Localization = { locale: "en-GH" };
}

// Country code mapping based on locale
const LOCALE_TO_COUNTRY: { [key: string]: string } = {
  "en-GH": "GH",
  "en-NG": "NG",
  "en-KE": "KE",
  "en-ZA": "ZA",
  "en-TZ": "TZ",
  "en-UG": "UG",
  "en-ET": "ET",
  "en-EG": "EG",
  "fr-CI": "CI",
  "fr-SN": "SN",
  "fr-CM": "CM",
  "en-ZW": "ZW",
  "en-ZM": "ZM",
  "en-MZ": "MZ",
  "pt-AO": "AO",
  "en-MW": "MW",
  "fr-ML": "ML",
  "fr-BF": "BF",
};

// Country dial codes
const COUNTRY_DIAL_CODES: { [key: string]: string } = {
  GH: "+233",
  NG: "+234",
  KE: "+254",
  ZA: "+27",
  TZ: "+255",
  UG: "+256",
  ET: "+251",
  EG: "+20",
  CI: "+225",
  SN: "+221",
  CM: "+237",
  ZW: "+263",
  ZM: "+260",
  MZ: "+258",
  AO: "+244",
  MW: "+265",
  ML: "+223",
  BF: "+226",
};

// Country flags
const COUNTRY_FLAGS: { [key: string]: string } = {
  GH: "🇬🇭",
  NG: "🇳🇬",
  KE: "🇰🇪",
  ZA: "🇿🇦",
  TZ: "🇹🇿",
  UG: "🇺🇬",
  ET: "🇪🇹",
  EG: "🇪🇬",
  CI: "🇨🇮",
  SN: "🇸🇳",
  CM: "🇨🇲",
  ZW: "🇿🇼",
  ZM: "🇿🇲",
  MZ: "🇲🇿",
  AO: "🇦🇴",
  MW: "🇲🇼",
  ML: "🇲🇱",
  BF: "🇧🇫",
};

// Country names
const COUNTRY_NAMES: { [key: string]: string } = {
  GH: "Ghana",
  NG: "Nigeria",
  KE: "Kenya",
  ZA: "South Africa",
  TZ: "Tanzania",
  UG: "Uganda",
  ET: "Ethiopia",
  EG: "Egypt",
  CI: "Ivory Coast",
  SN: "Senegal",
  CM: "Cameroon",
  ZW: "Zimbabwe",
  ZM: "Zambia",
  MZ: "Mozambique",
  AO: "Angola",
  MW: "Malawi",
  ML: "Mali",
  BF: "Burkina Faso",
};

export interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
}

/**
 * Auto-detect country from device locale
 */
export const getCountryFromLocale = (): Country => {
  let locale = "en-GH";
  try {
    if (Localization && Localization.locale) {
      locale = Localization.locale;
    }
  } catch (e) {
    console.warn("Could not get locale:", e);
  }
  
  const countryCode = LOCALE_TO_COUNTRY[locale] || "GH";
  
  return {
    name: COUNTRY_NAMES[countryCode] || "Ghana",
    code: countryCode,
    dialCode: COUNTRY_DIAL_CODES[countryCode] || "+233",
    flag: COUNTRY_FLAGS[countryCode] || "🇬🇭",
  };
};

/** Play forbids SMS/phone-state access unless the app is a default handler. Users type their number. */
export const getPhoneNumberFromDevice = async (): Promise<string | null> => {
  return null;
};

/**
 * Format phone number: strip leading 0 and combine with country code
 */
export const formatPhoneNumber = (
  phone: string,
  countryCode: string
): string => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // Strip leading 0 if present
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // Combine with country code (remove + if present)
  const dialCode = countryCode.replace("+", "");
  return `+${dialCode}${cleaned}`;
};

/**
 * Extract phone number from formatted number (remove country code)
 */
export const extractPhoneNumber = (
  formattedPhone: string,
  countryCode: string
): string => {
  const dialCode = countryCode.replace("+", "");
  const cleaned = formattedPhone.replace(/\D/g, "");
  
  if (cleaned.startsWith(dialCode)) {
    return cleaned.substring(dialCode.length);
  }
  
  return cleaned;
};

/**
 * Validate phone number format (10 digits for most African countries)
 */
export const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length === 10;
};

/**
 * Get country by dial code
 */
export const getCountryByDialCode = (dialCode: string): Country | null => {
  const code = Object.keys(COUNTRY_DIAL_CODES).find(
    (key) => COUNTRY_DIAL_CODES[key] === dialCode
  );
  
  if (!code) return null;
  
  return {
    name: COUNTRY_NAMES[code],
    code,
    dialCode: COUNTRY_DIAL_CODES[code],
    flag: COUNTRY_FLAGS[code],
  };
};
