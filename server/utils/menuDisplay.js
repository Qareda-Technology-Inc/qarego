/** Platform tags merchants can apply to menu items */
export const MENU_ITEM_TAGS = ["popular", "new", "spicy"];

export const DEFAULT_MENU_CATEGORY_LAYOUTS = [
  { name: "Drinks", displayLayout: "row" },
  { name: "Sides", displayLayout: "row" },
  { name: "Snacks", displayLayout: "row" },
  { name: "Desserts", displayLayout: "row" },
  { name: "Mains", displayLayout: "column" },
  { name: "Starters", displayLayout: "column" },
];

/**
 * Admin default layout for a category name (case-insensitive), else column.
 */
export function layoutFromAdminDefaults(categoryName, adminLayouts) {
  const list = Array.isArray(adminLayouts) ? adminLayouts : DEFAULT_MENU_CATEGORY_LAYOUTS;
  const key = String(categoryName || "").trim().toLowerCase();
  const hit = list.find((e) => String(e?.name || "").trim().toLowerCase() === key);
  return hit?.displayLayout === "row" ? "row" : "column";
}

export function normalizeMenuTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter((t) => MENU_ITEM_TAGS.includes(t)))];
}
