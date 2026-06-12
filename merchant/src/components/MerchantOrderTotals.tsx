import { formatCurrency } from "@/lib/currency";

type Props = {
  subtotal: number;
  serviceFee?: number;
  deliveryFee?: number;
  total: number;
  fulfillmentType?: "DELIVERY" | "PICKUP" | "SCHEDULED";
  compact?: boolean;
};

/**
 * Merchant-facing order amounts.
 * Store revenue is the food subtotal — service fee and delivery are paid by the customer to the platform/courier.
 */
export default function MerchantOrderTotals({
  subtotal,
  serviceFee = 0,
  deliveryFee = 0,
  total,
  fulfillmentType = "DELIVERY",
  compact = false,
}: Props) {
  const isPickup = fulfillmentType === "PICKUP";
  const platformFee = Number(serviceFee) || 0;
  const delivery = isPickup ? 0 : Number(deliveryFee) || 0;
  const customerTotal = Number(total) || subtotal + platformFee + delivery;

  if (compact) {
    return (
      <div className="text-right">
        <p className="font-semibold text-lg text-gray-900">{formatCurrency(subtotal)}</p>
        <p className="text-xs text-gray-500">Food total</p>
        {customerTotal > subtotal ? (
          <p className="text-xs text-gray-400 mt-0.5">
            Customer pays {formatCurrency(customerTotal)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-1.5 text-sm">
      <div className="flex justify-between gap-3">
        <span className="font-medium text-gray-900">Food total (your order)</span>
        <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
      </div>
      {platformFee > 0 ? (
        <div className="flex justify-between gap-3 text-gray-500">
          <span>Platform service fee</span>
          <span>{formatCurrency(platformFee)}</span>
        </div>
      ) : null}
      {!isPickup && delivery > 0 ? (
        <div className="flex justify-between gap-3 text-gray-500">
          <span>Delivery fee</span>
          <span>{formatCurrency(delivery)}</span>
        </div>
      ) : null}
      <div className="flex justify-between gap-3 border-t border-gray-200 pt-1.5 text-gray-600">
        <span>Customer pays</span>
        <span className="font-medium">{formatCurrency(customerTotal)}</span>
      </div>
      <p className="text-xs text-gray-400 pt-0.5">
        You receive the food total. Service and delivery fees are collected from the customer separately.
      </p>
    </div>
  );
}
