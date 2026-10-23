// Admin money view: everything that moved through the mobile-money provider (Paystack, or
// Hubtel before it), each with the reference to look up in the provider's dashboard.
import FoodPayment from "../../models/FoodPayment.js";
import FoodOrder from "../../models/FoodOrder.js";
import Ride from "../../models/Ride.js";
import PendingTopUp from "../../models/PendingTopUp.js";
import Transaction from "../../models/Transaction.js";
import { StatusCodes } from "http-status-codes";

const DAY = 86_400_000;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const shortId = (id) => `#${String(id).slice(-6).toUpperCase()}`;

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive). Defaults to the last 30 days. */
function readRange(query) {
  const to = query.to ? new Date(`${query.to}T23:59:59.999`) : new Date();
  const from = query.from ? new Date(`${query.from}T00:00:00`) : new Date(to.getTime() - 29 * DAY);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return readRange({});
  return { from, to };
}

/** GET /admin/money?from&to */
export const getMoneyMovements = async (req, res) => {
  const { from, to } = readRange(req.query);
  const inRange = { $gte: from, $lte: to };

  const [foodPays, ridePays, topUps, payoutTx, settledOrders, refundOrders] = await Promise.all([
    FoodPayment.find({ updatedAt: inRange, status: { $in: ["success", "failed", "pending"] } })
      .populate("customer", "name phone")
      .populate("order", "restaurantName status")
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean(),
    Ride.find({ paymentMethod: "MOBILE_MONEY", paymentReference: { $ne: null }, updatedAt: inRange })
      .select("paymentReference paymentStatus fare serviceType customer updatedAt")
      .populate("customer", "name phone")
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean(),
    PendingTopUp.find({ createdAt: inRange })
      .populate("driver", "name phone")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean(),
    Transaction.find({ type: "PAYOUT", createdAt: inRange })
      .populate("driver", "name phone")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean(),
    FoodOrder.find({ paymentMethod: "MOBILE_MONEY", settlementDetails: { $ne: null }, updatedAt: inRange })
      .select("restaurantName settlementDetails updatedAt")
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean(),
    FoodOrder.find({ refundStatus: { $in: ["DUE", "REFUNDED"] }, updatedAt: inRange })
      .select("restaurantName total paymentReference refundStatus refund refundedAt cancelledAt customer updatedAt")
      .populate("customer", "name phone")
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean(),
  ]);

  // A payout is failed when it was given back (reversal_<ref>).
  const reversed = new Set(
    (
      await Transaction.find({ reference: { $in: payoutTx.map((t) => `reversal_${t.reference}`) } })
        .select("reference")
        .lean()
    ).map((t) => t.reference.replace(/^reversal_/, ""))
  );

  const moneyIn = [
    ...foodPays.map((p) => ({
      kind: "Store order",
      at: p.updatedAt,
      amount: round2(p.amount),
      status: p.status === "success" ? "paid" : p.status,
      reference: p.clientReference,
      who: p.customer?.name || p.customer?.phone || "Customer",
      detail: `${p.order?.restaurantName || "Store"} · order ${shortId(p.order?._id || p.order)}`,
      channel: p.paymentChannel || null,
      link: p.order?._id ? `/food-orders/${p.order._id}` : null,
    })),
    ...ridePays.map((r) => ({
      kind: r.serviceType === "DELIVERY" ? "Parcel" : "Ride",
      at: r.updatedAt,
      amount: round2(r.fare),
      status: r.paymentStatus === "PAID" ? "paid" : String(r.paymentStatus || "").toLowerCase(),
      reference: r.paymentReference,
      who: r.customer?.name || r.customer?.phone || "Customer",
      detail: `Trip ${shortId(r._id)}`,
      channel: null,
      link: null,
    })),
    ...topUps.map((t) => ({
      kind: "Rider top-up",
      at: t.createdAt,
      amount: round2(t.amount),
      status: t.status === "completed" ? "paid" : t.status,
      reference: t.clientReference,
      who: t.driver?.name || t.driver?.phone || "Rider",
      detail: "Commission debt",
      channel: t.provider || "hubtel",
      link: null,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  const legStatus = (s) => (["sent", "failed", "pending", "wallet"].includes(s) ? s : null);
  const moneyOut = [
    ...payoutTx.map((t) => ({
      kind: /weekly|admin/i.test(t.note || "") ? "Admin payout" : "Rider cash-out",
      at: t.createdAt,
      amount: round2(Math.abs(t.amount)),
      status: reversed.has(t.reference) ? "failed" : "sent",
      reference: t.reference,
      who: t.driver?.name || t.driver?.phone || "Rider",
      detail: reversed.has(t.reference) ? "Failed, money returned to the rider's wallet" : t.note || "",
      link: null,
    })),
    ...settledOrders.flatMap((o) =>
      ["restaurant", "rider"]
        .map((leg) => {
          const d = o.settlementDetails?.[leg];
          const status = legStatus(d?.status);
          if (!d || !status || !(Number(d.amount) > 0)) return null;
          return {
            kind: leg === "restaurant" ? "Store payout" : "Rider delivery pay",
            at: o.updatedAt,
            amount: round2(d.amount),
            status,
            reference: d.reference,
            who: leg === "restaurant" ? o.restaurantName || "Store" : "Rider",
            detail:
              status === "wallet"
                ? `Order ${shortId(o._id)} · MoMo transfer failed, added to the rider's wallet${d.error ? ` (${d.error})` : ""}`
                : `Order ${shortId(o._id)}${d.error ? ` · ${d.error}` : ""}`,
            link: `/food-orders/${o._id}`,
          };
        })
        .filter(Boolean)
    ),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  const refunds = refundOrders.map((o) => ({
    kind: "Refund",
    at: o.refundedAt || o.refund?.requestedAt || o.cancelledAt || o.updatedAt,
    amount: round2(o.total),
    status:
      o.refundStatus === "REFUNDED" ? "refunded" : o.refund?.status === "failed" ? "failed" : o.refund ? "processing" : "due",
    reference: o.paymentReference,
    who: o.customer?.name || o.customer?.phone || "Customer",
    detail: `${o.restaurantName || "Store"} · order ${shortId(o._id)}${o.refund?.error ? ` · ${o.refund.error}` : ""}`,
    link: `/food-orders/${o._id}`,
  }));

  const sum = (rows, ok) => round2(rows.filter((r) => ok.includes(r.status)).reduce((s, r) => s + r.amount, 0));
  res.status(StatusCodes.OK).json({
    from,
    to,
    totals: {
      in: sum(moneyIn, ["paid"]),
      out: sum(moneyOut, ["sent", "pending"]),
      refunded: sum(refunds, ["refunded"]),
      refundsOpen: sum(refunds, ["due", "processing", "failed"]),
      problems:
        moneyOut.filter((r) => r.status === "failed").length + refunds.filter((r) => r.status === "failed").length,
    },
    moneyIn,
    moneyOut,
    refunds,
  });
};
