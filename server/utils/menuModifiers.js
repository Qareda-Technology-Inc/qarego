const GROUP_KINDS = ["choose_one", "add_ons"];

function cleanName(value, field) {
  const name = String(value ?? "").trim();
  if (!name) throw new Error(`${field} name is required`);
  if (name.length > 80) throw new Error(`${field} name is too long`);
  return name;
}

function cleanPriceDelta(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Normalize modifier groups from merchant payload.
 * @returns {Array} groups ready to save on MenuItem
 */
export function normalizeModifierGroups(rawGroups) {
  if (!Array.isArray(rawGroups)) {
    throw new Error("modifierGroups must be an array");
  }

  return rawGroups.map((group, groupIndex) => {
    const kind = GROUP_KINDS.includes(group?.kind) ? group.kind : "choose_one";
    const name = cleanName(group?.name, "Modifier group");
    const required = kind === "choose_one" ? !!group?.required : false;
    const sortOrder = Number.isFinite(Number(group?.sortOrder))
      ? Number(group.sortOrder)
      : groupIndex;

    const rawOptions = Array.isArray(group?.options) ? group.options : [];
    if (!rawOptions.length) {
      throw new Error(`"${name}" needs at least one option`);
    }

    const options = rawOptions.map((opt, optIndex) => ({
      ...(opt?._id ? { _id: opt._id } : {}),
      name: cleanName(opt?.name, "Option"),
      priceDelta: cleanPriceDelta(opt?.priceDelta),
      isDefault: !!opt?.isDefault,
      isAvailable: opt?.isAvailable !== false,
      sortOrder: Number.isFinite(Number(opt?.sortOrder)) ? Number(opt.sortOrder) : optIndex,
    }));

    const names = new Set();
    for (const opt of options) {
      const key = opt.name.toLowerCase();
      if (names.has(key)) throw new Error(`Duplicate option "${opt.name}" in "${name}"`);
      names.add(key);
    }

    if (kind === "choose_one") {
      const defaults = options.filter((o) => o.isDefault);
      if (defaults.length > 1) {
        throw new Error(`"${name}" can only have one default option`);
      }
    } else {
      options.forEach((o) => {
        o.isDefault = false;
      });
    }

    return {
      ...(group?._id ? { _id: group._id } : {}),
      name,
      kind,
      required,
      sortOrder,
      options,
    };
  });
}

function groupRules(group) {
  if (group.kind === "add_ons") {
    return { minSelect: 0, maxSelect: group.options.filter((o) => o.isAvailable !== false).length };
  }
  return {
    minSelect: group.required ? 1 : 0,
    maxSelect: 1,
  };
}

/**
 * Validate customer selections against a menu item's modifier groups.
 * @param {object} menuItem - MenuItem doc with modifierGroups
 * @param {Array<{ groupId: string, optionIds: string[] }>} selections
 * @returns {{ modifiers: Array, unitPrice: number }}
 */
export function resolveMenuItemModifiers(menuItem, selections = []) {
  const groups = menuItem.modifierGroups || [];
  const basePrice = Number(menuItem.price) || 0;

  if (!groups.length) {
    if (selections?.length) {
      throw new Error(`"${menuItem.name}" does not support customizations`);
    }
    return { modifiers: [], unitPrice: basePrice };
  }

  const selectionMap = new Map();
  for (const row of selections || []) {
    if (!row?.groupId) continue;
    const gid = String(row.groupId);
    const ids = Array.isArray(row.optionIds)
      ? row.optionIds.map(String).filter(Boolean)
      : row.optionId
      ? [String(row.optionId)]
      : [];
    if (!ids.length) continue;
    const prev = selectionMap.get(gid) || [];
    selectionMap.set(gid, [...new Set([...prev, ...ids])]);
  }

  const resolved = [];
  let extra = 0;

  for (const group of groups.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
    const groupId = String(group._id);
    let pickedIds = selectionMap.get(groupId) || [];

    if (!pickedIds.length && group.kind === "choose_one") {
      const defaultOpt = (group.options || []).find((o) => o.isDefault && o.isAvailable !== false);
      if (defaultOpt) pickedIds = [String(defaultOpt._id)];
    }

    const rules = groupRules(group);
    if (pickedIds.length < rules.minSelect) {
      throw new Error(`Please choose an option for "${group.name}"`);
    }
    if (pickedIds.length > rules.maxSelect) {
      throw new Error(`Too many selections for "${group.name}"`);
    }

    const optById = new Map((group.options || []).map((o) => [String(o._id), o]));
    for (const optId of pickedIds) {
      const opt = optById.get(String(optId));
      if (!opt || opt.isAvailable === false) {
        throw new Error(`Invalid option for "${group.name}"`);
      }
      const priceDelta = cleanPriceDelta(opt.priceDelta);
      extra += priceDelta;
      resolved.push({
        groupId,
        groupName: group.name,
        optionId: String(opt._id),
        optionName: opt.name,
        priceDelta,
      });
    }

    selectionMap.delete(groupId);
  }

  if (selectionMap.size > 0) {
    throw new Error("Invalid modifier selection");
  }

  const unitPrice = Math.round((basePrice + extra) * 100) / 100;
  return { modifiers: resolved, unitPrice };
}

export function formatModifiersForMenuItem(item) {
  const groups = (item.modifierGroups || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((group) => ({
      _id: group._id,
      name: group.name,
      kind: group.kind || "choose_one",
      required: !!group.required,
      sortOrder: group.sortOrder ?? 0,
      options: (group.options || [])
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((opt) => ({
          _id: opt._id,
          name: opt.name,
          priceDelta: opt.priceDelta ?? 0,
          isDefault: !!opt.isDefault,
          isAvailable: opt.isAvailable !== false,
        })),
    }));
  return groups;
}
