import { MenuItem } from "@/service/foodService";

function parsePercentFromItem(item: MenuItem): number | null {
  if (item.discountPercent != null && item.discountPercent > 0) {
    return Math.round(item.discountPercent);
  }
  const label = item.discountLabel?.trim();
  if (!label) return null;
  const m = label.match(/-?\s*(\d+(?:\.\d+)?)\s*%?/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n >= 100) return null;
  return Math.round(n);
}

function isDiscountItem(item: MenuItem): boolean {
  return (
    item.badge === "discount" ||
    parsePercentFromItem(item) != null ||
    Boolean(item.discountLabel?.trim())
  );
}

export function getDiscountBadgeLabel(item: MenuItem): string | null {
  if (!isDiscountItem(item)) return null;
  const percent = parsePercentFromItem(item);
  if (percent != null) return `-${percent}%`;
  const label = item.discountLabel?.trim();
  if (label) {
    const m = label.match(/-?\s*(\d+)\s*%?/);
    if (m) return `-${m[1]}%`;
    return label.startsWith("-") ? label : `-${label}`;
  }
  return null;
}

export function getMenuItemPricing(item: MenuItem) {
  const sale = Number(item.price) || 0;
  let original: number | null =
    item.originalPrice != null && item.originalPrice > 0 ? Number(item.originalPrice) : null;

  const discount = isDiscountItem(item);
  const percent = parsePercentFromItem(item);

  if (discount && percent != null && sale > 0 && (!original || original <= sale)) {
    original = Math.round((sale / (1 - percent / 100)) * 100) / 100;
  }

  const showOriginal = discount && original != null && original > sale;

  return {
    salePrice: sale,
    originalPrice: showOriginal ? original : null,
    hasDiscount: showOriginal,
    discountBadge: getDiscountBadgeLabel(item),
  };
}
