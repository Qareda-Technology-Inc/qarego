import { formatCurrency } from "@/lib/currency";

export type OrderModifierLine = {
  groupName?: string;
  optionName: string;
  priceDelta?: number;
};

export function formatOrderModifierLine(mod: OrderModifierLine): string {
  const name = mod.groupName ? `${mod.groupName}: ${mod.optionName}` : mod.optionName;
  if (mod.priceDelta && mod.priceDelta > 0) {
    return `${name} (+${formatCurrency(mod.priceDelta)})`;
  }
  return name;
}
