/**
 * Dry-run / apply credits for MoMo trips settled with the pre–Task-3 bug:
 * wallet was credited fare−commission AFTER also debiting commission
 * → undercredit of one commission amount per trip.
 *
 * Detection: ride has COMMISSION_DEBIT (−c) + DIGITAL_EARNING (~fare−c)
 * while fare is F → undercredit = c.
 *
 * Usage (from server/):
 *   node scripts/fixMomoWalletUndercredits.js           # dry-run
 *   node scripts/fixMomoWalletUndercredits.js --apply   # write MANUAL_CREDIT
 *
 * Requires Mongo connected via server .env (MONGODB_URI / MONGO_URI).
 */
import "dotenv/config";
import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";

const APPLY = process.argv.includes("--apply");

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Set MONGODB_URI or MONGO_URI");
    process.exit(1);
  }
  await mongoose.connect(uri);

  const earnings = await Transaction.find({ type: "DIGITAL_EARNING" })
    .populate("ride", "fare paymentMethod serviceType")
    .lean();

  const alreadyFixed = new Set(
    (
      await Transaction.find({
        type: "MANUAL_CREDIT",
        note: /MoMo wallet undercredit fix/i,
      })
        .select("ride")
        .lean()
    )
      .map((t) => String(t.ride || ""))
      .filter(Boolean)
  );

  const report = [];
  let totalCredit = 0;

  for (const earn of earnings) {
    const ride = earn.ride;
    if (!ride?._id || ride.paymentMethod !== "MOBILE_MONEY") continue;
    if (ride.serviceType === "FOOD") continue; // food MoMo doesn't use this ledger path

    const rideId = String(ride._id);
    if (alreadyFixed.has(rideId)) continue;

    const debit = await Transaction.findOne({
      ride: ride._id,
      type: "COMMISSION_DEBIT",
    }).lean();
    if (!debit) continue;

    const fare = roundMoney(ride.fare);
    const commission = roundMoney(Math.abs(debit.amount));
    const credit = roundMoney(earn.amount);
    const expectedOldCredit = roundMoney(fare - commission);
    const expectedNewCredit = fare;

    // Old bug pattern: DIGITAL_EARNING ≈ fare − commission (not full fare)
    if (Math.abs(credit - expectedOldCredit) > 0.05) continue;
    if (Math.abs(credit - expectedNewCredit) <= 0.05) continue; // already correct shape

    const undercredit = commission;
    if (undercredit <= 0) continue;

    report.push({
      rideId,
      driverId: String(earn.driver),
      fare,
      commission,
      recordedEarning: credit,
      undercredit,
    });
    totalCredit = roundMoney(totalCredit + undercredit);

    if (APPLY) {
      const driver = await User.findById(earn.driver).select("balance");
      if (!driver) continue;
      const newBalance = roundMoney(Number(driver.balance ?? 0) + undercredit);
      await User.findByIdAndUpdate(earn.driver, { balance: newBalance });
      await Transaction.create({
        ride: ride._id,
        driver: earn.driver,
        amount: undercredit,
        type: "MANUAL_CREDIT",
        note: `MoMo wallet undercredit fix (pre-Task-3 settlement)`,
        reference: `fix_momo_${rideId.slice(-10)}`,
        balanceAfter: newBalance,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "APPLY" : "DRY_RUN",
        trips: report.length,
        totalCredit,
        sample: report.slice(0, 20),
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
