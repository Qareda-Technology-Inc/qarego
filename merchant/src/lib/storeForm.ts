export type StoreVertical = "FOOD" | "GROCERY" | "PHARMACY";

export interface StoreTypeOption {
  _id: string;
  name: string;
  vertical: StoreVertical;
  emoji: string;
}

export interface StoreFormValues {
  moduleVertical: StoreVertical | "";
  storeTypeIds: string[];
  name: string;
  address: string;
  description: string;
  deliveryFee: string;
  minOrderAmount: string;
  estimatedPrepMinutes: string;
  cuisine: string;
  imageEmoji: string;
  imageUrl: string;
  allowsPickup: boolean;
}

export const EMPTY_STORE_FORM: StoreFormValues = {
  moduleVertical: "",
  storeTypeIds: [],
  name: "",
  address: "",
  description: "",
  deliveryFee: "",
  minOrderAmount: "0",
  estimatedPrepMinutes: "",
  cuisine: "Local",
  imageEmoji: "🍽️",
  imageUrl: "",
  allowsPickup: false,
};

export const VERTICAL_META: Record<
  StoreVertical,
  { label: string; prepLabel: string; prepDefault: string; namePlaceholder: string }
> = {
  FOOD: {
    label: "Food & Restaurants",
    prepLabel: "Average prep time (minutes)",
    prepDefault: "25",
    namePlaceholder: "e.g. Mama's Kitchen — Osu",
  },
  GROCERY: {
    label: "Groceries & Supermarket",
    prepLabel: "Picking time (minutes)",
    prepDefault: "20",
    namePlaceholder: "e.g. Fresh Mart — East Legon",
  },
  PHARMACY: {
    label: "Pharmacy",
    prepLabel: "Fulfillment time (minutes)",
    prepDefault: "15",
    namePlaceholder: "e.g. City Chemist — Kaneshie",
  },
};

/** @deprecated Tags are chosen via multi-select store type picker. */
export const FOOD_CUISINE_SUGGESTIONS: string[] = [];

export function getVerticalMeta(vertical?: StoreVertical) {
  return VERTICAL_META[vertical ?? "FOOD"];
}

export function resolveFormVertical(
  form: StoreFormValues,
  storeTypes: StoreTypeOption[]
): StoreVertical | undefined {
  if (form.moduleVertical) return form.moduleVertical;
  const first = storeTypes.find((t) => form.storeTypeIds.includes(t._id));
  return first?.vertical;
}

export function toggleStoreTypeId(
  form: StoreFormValues,
  storeTypes: StoreTypeOption[],
  id: string
): StoreFormValues {
  const picked = storeTypes.find((t) => t._id === id);
  if (!picked) return form;

  const has = form.storeTypeIds.includes(id);
  const nextIds = has
    ? form.storeTypeIds.filter((x) => x !== id)
    : [...form.storeTypeIds, id];

  const selected = storeTypes.filter((t) => nextIds.includes(t._id));
  const primary = selected.sort((a, b) => a.name.localeCompare(b.name))[0];

  return {
    ...form,
    moduleVertical: picked.vertical,
    storeTypeIds: nextIds,
    imageEmoji: primary?.emoji ?? form.imageEmoji,
    estimatedPrepMinutes:
      form.estimatedPrepMinutes || getVerticalMeta(picked.vertical).prepDefault,
    deliveryFee: form.deliveryFee || (picked.vertical === "FOOD" ? "0" : "6"),
  };
}

export function setStoreModule(
  form: StoreFormValues,
  vertical: StoreVertical
): StoreFormValues {
  if (form.moduleVertical === vertical) return form;
  return {
    ...form,
    moduleVertical: vertical,
    storeTypeIds: [],
  };
}

export function buildStoreCreatePayload(
  form: StoreFormValues,
  location: { lat: number; lng: number },
  selectedVertical?: StoreVertical
) {
  return {
    name: form.name.trim(),
    storeTypeIds: form.storeTypeIds,
    address: form.address.trim(),
    description: form.description.trim(),
    deliveryFee: selectedVertical === "FOOD" ? 0 : Number(form.deliveryFee || 0),
    minOrderAmount: Number(form.minOrderAmount) || 0,
    estimatedPrepMinutes: Number(form.estimatedPrepMinutes) || 25,
    latitude: location.lat,
    longitude: location.lng,
    imageEmoji: form.imageEmoji.trim() || "🍽️",
    ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : {}),
    allowsPickup: form.allowsPickup,
  };
}
