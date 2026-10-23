// Pay a rider's wallet money out to their MoMo: the rider's own Cash Out, or an admin paying one
// rider out on request. The amount comes off the wallet first (so it can't be paid twice); if the
// transfer can't be sent it goes straight back. A later failure arrives on the payout webhook
// (applyPayoutOutcome), which also gives it back.
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { makeShortHubtelRef } from "./hubtelService.js";
import { sendMomoPayout } from "./momoPayout.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {{ riderId, amount, refPrefix: "co" | "po", note: string, reason: string, callbackUrl?: string }} p
 * @returns {Promise<{ ok: boolean, amount: number, balance: number, reference?: string, error?: string }>}
 */
export async function payOutRiderBalance({ riderId, amount, refPrefix, note, reason, callbackUrl }) {
  amount = round2(amount);
  const rider = await User.findById(riderId).select("name phone role");
  if (!rider || rider.role !== "rider") return { ok: false, amount, balance: 0, error: "Rider not found" };
  if (!rider.phone) return { ok: false, amount, balance: 0, error: "No phone number on the rider's account" };

  const taken = await User.findOneAndUpdate(
    { _id: riderId, role: "rider", balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  ).select("balance");
  if (!taken) return { ok: false, amount, balance: 0, error: "Not enough in the wallet" };
  const balanceAfter = round2(taken.balance);

  const reference = makeShortHubtelRef(refPrefix, riderId);
  await Transaction.create({ driver: riderId, amount: -amount, type: "PAYOUT", note, reference, balanceAfter });

  const result = await sendMomoPayout({ name: rider.name || "Rider", phone: rider.phone, amount, reference, reason, callbackUrl });
  if (result.success) return { ok: true, amount, balance: balanceAfter, reference };

  // Couldn't send: give it back ($inc, so a trip settling at the same moment isn't overwritten).
  const back = await User.findByIdAndUpdate(riderId, { $inc: { balance: amount } }, { new: true }).select("balance");
  const restored = round2(back?.balance);
  await Transaction.create({
    driver: riderId,
    amount,
    type: "MANUAL_CREDIT",
    note: `Payout failed — balance restored (${result.error})`,
    reference: `reversal_${reference}`,
    balanceAfter: restored,
  });
  return { ok: false, amount, balance: restored, reference, error: result.error || "Payout failed" };
}
