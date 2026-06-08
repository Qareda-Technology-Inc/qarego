import MenuCategory from "../models/MenuCategory.js";
import { layoutFromAdminDefaults } from "./menuDisplay.js";
import { enrichMenuItemForDisplay } from "./menuDiscount.js";
import { formatModifiersForMenuItem } from "./menuModifiers.js";

/**
 * Build categories + grouped menu for customer/merchant APIs.
 */
export async function buildMenuPayload(restaurantId, menuItems, adminLayouts) {
  const dbCategories = await MenuCategory.find({ restaurant: restaurantId })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const catById = new Map(dbCategories.map((c) => [String(c._id), c]));
  const catByName = new Map(dbCategories.map((c) => [c.name.toLowerCase(), c]));

  const ensureCategoryMeta = (item) => {
    let cat = null;
    if (item.menuCategory) {
      cat = catById.get(String(item.menuCategory));
    }
    if (!cat && item.category) {
      cat = catByName.get(String(item.category).trim().toLowerCase());
    }
    const name = cat?.name || (item.category && String(item.category).trim()) || "Other";
    const displayLayout =
      cat?.displayLayout || layoutFromAdminDefaults(name, adminLayouts);
    return {
      name,
      displayLayout,
      categoryId: cat?._id ? String(cat._id) : null,
      sortOrder: cat?.sortOrder ?? 999,
    };
  };

  const grouped = {};
  const itemCategoryNames = new Set();

  for (const item of menuItems) {
    const meta = ensureCategoryMeta(item);
    itemCategoryNames.add(meta.name);
    if (!grouped[meta.name]) grouped[meta.name] = [];
    grouped[meta.name].push({
      ...enrichMenuItemForDisplay(item),
      category: meta.name,
      displayLayout: meta.displayLayout,
      modifierGroups: formatModifiersForMenuItem(item),
    });
  }

  /** All merchant-defined categories (even if empty), plus any legacy item-only names */
  const categoriesOut = [];
  const seenNames = new Set();

  for (const cat of dbCategories) {
    seenNames.add(cat.name);
    categoriesOut.push({
      _id: cat._id,
      name: cat.name,
      displayLayout: cat.displayLayout || layoutFromAdminDefaults(cat.name, adminLayouts),
      sortOrder: cat.sortOrder ?? 0,
    });
  }

  for (const name of itemCategoryNames) {
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    categoriesOut.push({
      _id: null,
      name,
      displayLayout: layoutFromAdminDefaults(name, adminLayouts),
      sortOrder: 999,
    });
  }

  categoriesOut.sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
  );

  return {
    categories: categoriesOut,
    menu: grouped,
    menuByKey: grouped,
  };
}
