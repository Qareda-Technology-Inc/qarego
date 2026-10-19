import { ChefHat, Flame, Pill, ShoppingBasket, type LucideProps } from "lucide-react";
import { normalizeVertical } from "@/lib/commerceOrderCopy";

/** The store type's own icon: a chef's hat only for restaurants. */
export function VerticalIcon({ vertical, ...props }: { vertical?: string | null } & LucideProps) {
  switch (normalizeVertical(vertical)) {
    case "GROCERY":
      return <ShoppingBasket {...props} />;
    case "PHARMACY":
      return <Pill {...props} />;
    case "GAS":
      return <Flame {...props} />;
    default:
      return <ChefHat {...props} />;
  }
}
