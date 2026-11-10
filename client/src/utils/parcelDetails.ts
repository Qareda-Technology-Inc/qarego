/** Mirrors server/utils/parcelDetails.js (sizes, contents and the one-line summary). */
export type ParcelSize = "DOCUMENT" | "SMALL" | "MEDIUM" | "LARGE";
export type ParcelCategory = "CLOTHES" | "ELECTRONICS" | "FOOD" | "DOCUMENTS" | "OTHER";

export const PARCEL_SIZES: {
  key: ParcelSize;
  label: string;
  hint: string;
  icon: "document-text-outline" | "cube-outline" | "briefcase-outline" | "car-outline";
  vehicle: "motorcycle" | "pragya";
}[] = [
  { key: "DOCUMENT", label: "Document", hint: "envelope", icon: "document-text-outline", vehicle: "motorcycle" },
  { key: "SMALL", label: "Small", hint: "shoebox", icon: "cube-outline", vehicle: "motorcycle" },
  { key: "MEDIUM", label: "Medium", hint: "backpack", icon: "briefcase-outline", vehicle: "motorcycle" },
  { key: "LARGE", label: "Large", hint: "tricycle", icon: "car-outline", vehicle: "pragya" },
];

export const PARCEL_CATEGORIES: { key: ParcelCategory; label: string }[] = [
  { key: "CLOTHES", label: "Clothes" },
  { key: "ELECTRONICS", label: "Phone, electronics" },
  { key: "FOOD", label: "Food" },
  { key: "DOCUMENTS", label: "Documents" },
  { key: "OTHER", label: "Other" },
];

export function parcelSummary(ride: {
  parcelSize?: string | null;
  parcelCategory?: string | null;
  fragile?: boolean | null;
}): string {
  return [
    PARCEL_SIZES.find((s) => s.key === ride?.parcelSize)?.label,
    PARCEL_CATEGORIES.find((c) => c.key === ride?.parcelCategory)?.label,
    ride?.fragile ? "Fragile" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
