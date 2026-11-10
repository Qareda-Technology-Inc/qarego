// Where a laundry order is, for the short progress bar and the tracking list.
type LaundryOrderLike = {
  status: string;
  gasStage?: "TO_STATION" | "AT_STATION" | null;
  laundry?: { priceStatus?: string; countedAt?: string | null } | null;
};

export const LAUNDRY_STAGES = ["Collecting", "Counting", "Washing", "On the way back", "Delivered"] as const;

export function laundryStage(order: LaundryOrderLike): { index: number; label: string } {
  const at = (index: number, label?: string) => ({ index, label: label ?? LAUNDRY_STAGES[index] });
  if (order.status === "DELIVERED") return at(4);
  if (order.status === "READY_FOR_PICKUP" || order.status === "PICKED_UP") return at(3);
  if (order.laundry?.priceStatus === "declined") return at(3, "Coming back unwashed");
  if (order.gasStage === "AT_STATION") {
    if (order.laundry?.priceStatus === "approved") return at(2);
    return at(1, order.laundry?.priceStatus === "awaiting_customer" ? "Counted" : "Counting at the shop");
  }
  if (order.status === "PLACED") return at(0, "Waiting for the shop");
  return at(0, order.gasStage === "TO_STATION" ? "On the way to the shop" : "Rider collecting");
}
