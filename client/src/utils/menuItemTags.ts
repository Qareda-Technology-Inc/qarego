/** Platform menu item tags — keep in sync with server/utils/menuDisplay.js */
export const MENU_ITEM_TAGS = ["popular", "new", "spicy"] as const;

export type MenuItemTag = (typeof MENU_ITEM_TAGS)[number];

export const MENU_ITEM_TAG_CONFIG: Record<
  MenuItemTag,
  { label: string; backgroundColor: string; color: string }
> = {
  popular: { label: "Popular", backgroundColor: "#fde047", color: "#111827" },
  new: { label: "New", backgroundColor: "#dbeafe", color: "#1d4ed8" },
  spicy: { label: "Spicy", backgroundColor: "#fee2e2", color: "#b91c1c" },
};

export function getMenuItemTags(tags?: string[]): MenuItemTag[] {
  if (!tags?.length) return [];
  const normalized = new Set(tags.map((t) => String(t).trim().toLowerCase()));
  return MENU_ITEM_TAGS.filter((tag) => normalized.has(tag));
}
