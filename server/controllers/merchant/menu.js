import MenuItem from "../../models/MenuItem.js";
import MenuCategory from "../../models/MenuCategory.js";
import Restaurant from "../../models/Restaurant.js";
import { sanitizeImageUrl } from "../../utils/mediaStorage.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, NotFoundError } from "../../errors/index.js";
import { getSettings } from "../../utils/tripSettlement.js";
import {
  defaultMenuCategory,
  layoutFromAdminDefaults,
  normalizeMenuTags,
  MENU_ITEM_TAGS,
} from "../../utils/menuDisplay.js";
import { applyMenuDiscount, enrichMenuItemForDisplay } from "../../utils/menuDiscount.js";
import { buildMenuPayload } from "../../utils/menuResponse.js";
import { formatModifiersForMenuItem, normalizeModifierGroups } from "../../utils/menuModifiers.js";

/** GET /merchant/menu-categories */
export const listMyMenuCategories = async (req, res) => {
  const categories = await MenuCategory.find({ restaurant: req.restaurantId })
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  res.status(StatusCodes.OK).json({ categories, availableTags: MENU_ITEM_TAGS });
};

/** POST /merchant/menu-categories */
export const createMyMenuCategory = async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) throw new BadRequestError("Category name is required");

  const settings = await getSettings();
  const displayLayout =
    req.body.displayLayout === "row" || req.body.displayLayout === "column"
      ? req.body.displayLayout
      : layoutFromAdminDefaults(name, settings.menuCategoryLayouts);

  const sortOrder = Number.isFinite(Number(req.body.sortOrder))
    ? Number(req.body.sortOrder)
    : (await MenuCategory.countDocuments({ restaurant: req.restaurantId }));

  try {
    const category = await MenuCategory.create({
      restaurant: req.restaurantId,
      name,
      sortOrder,
      displayLayout,
    });
    res.status(StatusCodes.CREATED).json({ message: "Category created", category });
  } catch (err) {
    if (err?.code === 11000) throw new BadRequestError("This category name already exists");
    throw err;
  }
};

/** PATCH /merchant/menu-categories/:id */
export const updateMyMenuCategory = async (req, res) => {
  const category = await MenuCategory.findOne({
    _id: req.params.id,
    restaurant: req.restaurantId,
  });
  if (!category) throw new NotFoundError("Category not found");

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw new BadRequestError("Category name cannot be empty");
    category.name = name;
  }
  if (req.body.displayLayout === "row" || req.body.displayLayout === "column") {
    category.displayLayout = req.body.displayLayout;
  }
  if (req.body.sortOrder !== undefined && Number.isFinite(Number(req.body.sortOrder))) {
    category.sortOrder = Number(req.body.sortOrder);
  }

  await category.save();

  if (req.body.name !== undefined) {
    await MenuItem.updateMany(
      { restaurant: req.restaurantId, menuCategory: category._id },
      { $set: { category: category.name } }
    );
  }

  res.status(StatusCodes.OK).json({ message: "Category updated", category });
};

/** DELETE /merchant/menu-categories/:id */
export const deleteMyMenuCategory = async (req, res) => {
  const category = await MenuCategory.findOneAndDelete({
    _id: req.params.id,
    restaurant: req.restaurantId,
  });
  if (!category) throw new NotFoundError("Category not found");

  await MenuItem.updateMany(
    { restaurant: req.restaurantId, menuCategory: category._id },
    { $set: { menuCategory: null, category: "Other" } }
  );

  res.status(StatusCodes.OK).json({ message: "Category removed" });
};

async function resolveMenuCategoryForItem(restaurantId, { menuCategoryId, category }) {
  if (menuCategoryId) {
    const cat = await MenuCategory.findOne({ _id: menuCategoryId, restaurant: restaurantId });
    if (!cat) throw new BadRequestError("Invalid menu category");
    return { menuCategory: cat._id, category: cat.name };
  }
  let name = String(category || "").trim();
  if (!name) {
    const store = await Restaurant.findById(restaurantId).select("vertical").lean();
    name = defaultMenuCategory(store?.vertical);
  }
  let cat = await MenuCategory.findOne({
    restaurant: restaurantId,
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  });
  if (!cat) {
    const settings = await getSettings();
    cat = await MenuCategory.create({
      restaurant: restaurantId,
      name,
      sortOrder: await MenuCategory.countDocuments({ restaurant: restaurantId }),
      displayLayout: layoutFromAdminDefaults(name, settings.menuCategoryLayouts),
    });
  }
  return { menuCategory: cat._id, category: cat.name };
}

/** GET /merchant/menu — my menu */
export const listMyMenu = async (req, res) => {
  const menuItems = await MenuItem.find({ restaurant: req.restaurantId })
    .sort({ category: 1, name: 1 })
    .lean();
  const settings = await getSettings();
  const { categories, menu } = await buildMenuPayload(
    req.restaurantId,
    menuItems,
    settings.menuCategoryLayouts
  );
  const itemsOut = menuItems.map((item) => ({
    ...enrichMenuItemForDisplay(item),
    modifierGroups: formatModifiersForMenuItem(item),
  }));
  res.status(StatusCodes.OK).json({ menuItems: itemsOut, categories, menu });
};

/** POST /merchant/menu — owner adds an item */
export const createMyMenuItem = async (req, res) => {
  const {
    name,
    description,
    price,
    category,
    menuCategoryId,
    isAvailable,
    imageUrl,
    tags,
    badge,
    discountLabel,
    discountPercent,
    originalPrice,
  } = req.body;
  if (!name || (price == null && originalPrice == null)) {
    throw new BadRequestError("Menu item name and price are required");
  }

  const catFields = await resolveMenuCategoryForItem(req.restaurantId, {
    menuCategoryId,
    category,
  });

  const pricing = applyMenuDiscount({
    price,
    originalPrice: originalPrice ?? price,
    discountPercent,
    discountLabel,
    badge: badge === "discount" ? "discount" : null,
  });

  if (pricing.price < 0) throw new BadRequestError("Price cannot be negative");

  const item = await MenuItem.create({
    restaurant: req.restaurantId,
    name: name.trim(),
    description: description?.trim() || "",
    price: pricing.price,
    ...catFields,
    isAvailable: isAvailable !== false,
    imageUrl: sanitizeImageUrl(imageUrl),
    tags: normalizeMenuTags(tags),
    badge: pricing.badge,
    discountLabel: pricing.discountLabel,
    discountPercent: pricing.discountPercent,
    originalPrice: pricing.originalPrice,
  });

  res.status(StatusCodes.CREATED).json({ message: "Menu item added", item });
};

/**
 * PATCH /merchant/menu/:itemId
 * Owner can edit everything; cooks can only flip availability (mark sold out / back).
 */
export const updateMyMenuItem = async (req, res) => {
  const item = await MenuItem.findOne({
    _id: req.params.itemId,
    restaurant: req.restaurantId,
  });
  if (!item) throw new NotFoundError("Menu item not found");

  const isOwner = req.user.role === "merchant";

  if (req.body.isAvailable !== undefined) {
    item.isAvailable = !!req.body.isAvailable;
  }

  if (isOwner) {
    const {
      name,
      description,
      price,
      category,
      menuCategoryId,
      imageUrl,
      tags,
      badge,
      discountLabel,
      discountPercent,
      originalPrice,
    } = req.body;
    if (name !== undefined) item.name = name.trim();
    if (description !== undefined) item.description = description.trim();
    if (menuCategoryId !== undefined || category !== undefined) {
      const catFields = await resolveMenuCategoryForItem(req.restaurantId, {
        menuCategoryId,
        category: category ?? item.category,
      });
      item.menuCategory = catFields.menuCategory;
      item.category = catFields.category;
    }
    if (imageUrl !== undefined) item.imageUrl = sanitizeImageUrl(imageUrl);
    if (tags !== undefined) item.tags = normalizeMenuTags(tags);

    const pricingTouched =
      badge !== undefined ||
      price !== undefined ||
      originalPrice !== undefined ||
      discountPercent !== undefined ||
      discountLabel !== undefined;

    if (pricingTouched) {
      const pricing = applyMenuDiscount({
        price: price !== undefined ? price : item.price,
        originalPrice:
          originalPrice !== undefined ? originalPrice : item.originalPrice ?? item.price,
        discountPercent:
          discountPercent !== undefined ? discountPercent : item.discountPercent,
        discountLabel:
          discountLabel !== undefined ? discountLabel : item.discountLabel,
        badge:
          badge !== undefined
            ? badge === "discount"
              ? "discount"
              : null
            : item.badge,
      });
      if (pricing.price < 0) throw new BadRequestError("Price cannot be negative");
      item.price = pricing.price;
      item.badge = pricing.badge;
      item.discountLabel = pricing.discountLabel;
      item.discountPercent = pricing.discountPercent;
      item.originalPrice = pricing.originalPrice;
    }
  }

  await item.save();
  res.status(StatusCodes.OK).json({ message: "Menu item updated", item });
};

/** PATCH /merchant/menu/:itemId/modifiers — replace add-ons / option groups */
export const updateMyMenuItemModifiers = async (req, res) => {
  const item = await MenuItem.findOne({
    _id: req.params.itemId,
    restaurant: req.restaurantId,
  });
  if (!item) throw new NotFoundError("Menu item not found");

  try {
    item.modifierGroups = normalizeModifierGroups(req.body?.modifierGroups ?? []);
  } catch (err) {
    throw new BadRequestError(err?.message || "Invalid modifier groups");
  }

  await item.save();
  res.status(StatusCodes.OK).json({
    message: "Modifiers updated",
    item: {
      ...enrichMenuItemForDisplay(item.toObject()),
      modifierGroups: formatModifiersForMenuItem(item),
    },
  });
};

/** DELETE /merchant/menu/:itemId — owner removes an item */
export const deleteMyMenuItem = async (req, res) => {
  const item = await MenuItem.findOneAndDelete({
    _id: req.params.itemId,
    restaurant: req.restaurantId,
  });
  if (!item) throw new NotFoundError("Menu item not found");
  res.status(StatusCodes.OK).json({ message: "Menu item removed" });
};
