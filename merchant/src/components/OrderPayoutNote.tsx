import { Banknote, Smartphone, Store } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import type { FoodOrderRow } from "@/lib/orderTypes";

/**
 * What the store actually receives for an order, so it matches what the courier hands over.
 * `restaurantNet` is the food subtotal minus platform commission, frozen at checkout and used
 * by settlement (server/utils/foodOrderSettlement.js).
 */
export function OrderPayoutNote({ order }: { order: FoodOrderRow }) {
  const net = order.restaurantNet;
  if (net == null || !(net >= 0)) return null;
  // Nothing is paid out for a cancelled order.
  if (order.status === "CANCELLED") return null;
  const delivered = order.status === "DELIVERED";

  const commission = Math.max(0, Math.round((order.subtotal - net) * 100) / 100);
  const pickup = order.fulfillmentType === "PICKUP";

  let Icon = Banknote;
  let text: string;
  if (order.paymentMethod === "MOBILE_MONEY") {
    Icon = Smartphone;
    text = delivered
      ? `MoMo payout to you: ${formatCurrency(net)}`
      : `You receive ${formatCurrency(net)} by MoMo payout after delivery`;
  } else if (pickup) {
    Icon = Store;
    const owed = Math.max(0, Math.round((order.total - net) * 100) / 100);
    text = delivered
      ? `Customer paid you ${formatCurrency(order.total)} · ${formatCurrency(owed)} is owed to QareGO`
      : `Collect ${formatCurrency(order.total)} from the customer · ${formatCurrency(owed)} is QareGO's share`;
  } else {
    text = delivered
      ? `Courier paid you ${formatCurrency(net)} cash at pickup`
      : `Courier pays you ${formatCurrency(net)} cash at pickup`;
  }

  return (
    <div className="mt-2 inline-flex flex-col gap-0.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      <span className="flex items-center gap-1.5 font-medium">
        <Icon className="h-4 w-4" />
        {text}
      </span>
      {commission > 0 ? (
        <span className="text-xs text-emerald-800/80">
          {order.gasMode ? "Gas" : "Food"} {formatCurrency(order.subtotal)} − {formatCurrency(commission)} QareGO commission
        </span>
      ) : null}
    </div>
  );
}
