import type { MenuItem, MenuModifierGroup } from "@/service/foodService";
import { getMenuItemPricing } from "@/utils/menuItemPricing";

export type CartModifier = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
};

/** groupId → selected optionIds */
export type ModifierSelection = Record<string, string[]>;

export function itemHasModifiers(item: MenuItem): boolean {
  return (item.modifierGroups?.length ?? 0) > 0;
}

export function initModifierSelection(item: MenuItem): ModifierSelection {
  const selection: ModifierSelection = {};
  for (const group of item.modifierGroups || []) {
    if (group.kind === "choose_one") {
      const def = group.options.find((o) => o.isDefault && o.isAvailable !== false);
      selection[group._id] = def ? [def._id] : [];
    } else {
      selection[group._id] = [];
    }
  }
  return selection;
}

function groupRules(group: MenuModifierGroup) {
  if (group.kind === "add_ons") {
    const max = group.options.filter((o) => o.isAvailable !== false).length;
    return { minSelect: 0, maxSelect: max };
  }
  return {
    minSelect: group.required ? 1 : 0,
    maxSelect: 1,
  };
}

export function resolveModifierSelections(
  item: MenuItem,
  selection: ModifierSelection
): { modifiers: CartModifier[]; unitPrice: number; error?: string } {
  const basePrice = getMenuItemPricing(item).salePrice;
  const groups = item.modifierGroups || [];

  if (!groups.length) {
    return { modifiers: [], unitPrice: basePrice };
  }

  const resolved: CartModifier[] = [];
  let extra = 0;

  for (const group of [...groups].sort((a, b) => (a.required === b.required ? 0 : a.required ? -1 : 1))) {
    let picked = [...(selection[group._id] || [])];

    if (!picked.length && group.kind === "choose_one") {
      const def = group.options.find((o) => o.isDefault && o.isAvailable !== false);
      if (def) picked = [def._id];
    }

    const rules = groupRules(group);
    if (picked.length < rules.minSelect) {
      return {
        modifiers: [],
        unitPrice: basePrice,
        error: `Please choose an option for "${group.name}"`,
      };
    }
    if (picked.length > rules.maxSelect) {
      return {
        modifiers: [],
        unitPrice: basePrice,
        error: `Too many selections for "${group.name}"`,
      };
    }

    const optById = new Map(group.options.map((o) => [o._id, o]));
    for (const optId of picked) {
      const opt = optById.get(optId);
      if (!opt || opt.isAvailable === false) {
        return {
          modifiers: [],
          unitPrice: basePrice,
          error: `Invalid option for "${group.name}"`,
        };
      }
      const priceDelta = Number(opt.priceDelta) || 0;
      extra += priceDelta;
      resolved.push({
        groupId: group._id,
        groupName: group.name,
        optionId: opt._id,
        optionName: opt.name,
        priceDelta,
      });
    }
  }

  const unitPrice = Math.round((basePrice + extra) * 100) / 100;
  return { modifiers: resolved, unitPrice };
}

export function buildModifierKey(modifiers: CartModifier[]): string {
  if (!modifiers.length) return "";
  return modifiers
    .map((m) => m.optionId)
    .sort()
    .join(",");
}

export function buildCartLineId(menuItemId: string, modifierKey: string): string {
  return modifierKey ? `${menuItemId}:${modifierKey}` : menuItemId;
}

export function formatCartModifierSummary(modifiers: CartModifier[]): string {
  if (!modifiers.length) return "";
  return modifiers.map((m) => m.optionName).join(" · ");
}

export function toOrderModifierPayload(modifiers: CartModifier[]) {
  const map = new Map<string, string[]>();
  for (const m of modifiers) {
    const prev = map.get(m.groupId) || [];
    prev.push(m.optionId);
    map.set(m.groupId, prev);
  }
  return [...map.entries()].map(([groupId, optionIds]) => ({
    groupId,
    optionIds: [...new Set(optionIds)],
  }));
}

export function isModifierSelectionReady(item: MenuItem, selection: ModifierSelection): boolean {
  return !resolveModifierSelections(item, selection).error;
}
