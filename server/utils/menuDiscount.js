/** Parse "30", "30%", "-30%" → percent 1–99 */
export function parseDiscountPercent(value) {
  if (value == null || value === "") return null;
  const m = String(value).trim().match(/-?\s*(\d+(?:\.\d+)?)\s*%?/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n >= 100) return null;
  return Math.round(n);
}

export function formatDiscountLabel(percent) {
  const p = Math.round(Number(percent));
  if (!Number.isFinite(p) || p <= 0) return null;
  return `-${p}%`;
}

/**
 * Apply discount: originalPrice is the pre-discount price; price becomes the sale amount.
 */
export function applyMenuDiscount({
  price,
  originalPrice,
  discountPercent,
  discountLabel,
  badge,
}) {
  if (badge !== "discount") {
    return {
      price: Number(price) || 0,
      originalPrice: null,
      discountPercent: null,
      discountLabel: null,
      badge: null,
    };
  }

  let percent =
    discountPercent != null && discountPercent !== ""
      ? parseDiscountPercent(discountPercent)
      : parseDiscountPercent(discountLabel);

  const base =
    originalPrice != null && Number(originalPrice) > 0
      ? Number(originalPrice)
      : Number(price) || 0;

  if (percent != null) {
    const sale = Math.round(base * (1 - percent / 100) * 100) / 100;
    return {
      price: sale,
      originalPrice: base,
      discountPercent: percent,
      discountLabel: formatDiscountLabel(percent),
      badge: "discount",
    };
  }

  const sale = Number(price) || 0;
  if (base > sale) {
    const derived = Math.round((1 - sale / base) * 100);
    return {
      price: sale,
      originalPrice: base,
      discountPercent: derived,
      discountLabel: formatDiscountLabel(derived),
      badge: "discount",
    };
  }

  return {
    price: sale,
    originalPrice: base > sale ? base : null,
    discountPercent: null,
    discountLabel: discountLabel?.trim() || null,
    badge: "discount",
  };
}

/** Ensure API payloads include originalPrice + label for discounted items */
export function enrichMenuItemForDisplay(item) {
  const doc = item?.toObject ? item.toObject() : { ...item };
  const sale = Number(doc.price) || 0;
  let percent =
    doc.discountPercent != null
      ? parseDiscountPercent(doc.discountPercent)
      : parseDiscountPercent(doc.discountLabel);

  const hasDiscount =
    doc.badge === "discount" || percent != null || Boolean(doc.discountLabel?.trim());

  if (!hasDiscount) return doc;

  let original =
    doc.originalPrice != null && Number(doc.originalPrice) > 0
      ? Number(doc.originalPrice)
      : null;

  if (percent != null && sale > 0) {
    const computedOriginal = Math.round((sale / (1 - percent / 100)) * 100) / 100;
    if (!original || original <= sale) original = computedOriginal;
    return {
      ...doc,
      badge: "discount",
      price: sale,
      originalPrice: original,
      discountPercent: percent,
      discountLabel: formatDiscountLabel(percent),
    };
  }

  if (original != null && original > sale) {
    const derived = Math.round((1 - sale / original) * 100);
    return {
      ...doc,
      badge: "discount",
      price: sale,
      originalPrice: original,
      discountPercent: doc.discountPercent ?? derived,
      discountLabel: doc.discountLabel?.trim() || formatDiscountLabel(derived),
    };
  }

  return { ...doc, badge: "discount", price: sale, originalPrice: original };
}
