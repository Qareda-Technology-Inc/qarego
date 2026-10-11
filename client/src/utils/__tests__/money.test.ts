// Same money cases as the server (server/test/money.test.js), read from one shared file,
// so the client copies of the fare / fee / commission rules cannot drift from the server.
import fs from "fs";
import path from "path";
import { calculateFare, calculateFoodDeliveryFee } from "../mapUtils";
import { calculateServiceFee } from "../feeUtils";
import { breakdownFromDispatchMeta } from "../earningsBreakdown";

// mapUtils pulls in the user store (native MMKV); the fare helpers don't use it.
jest.mock("@/store/userStore", () => ({ useUserStore: { getState: () => ({}) } }));

const cases = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../../../server/test/fixtures/money-cases.json"),
    "utf8"
  )
);
const ratesFor = (key: string) => (key === "rates" ? cases.rates : undefined);
const round2 = (n: number) => Math.round(n * 100) / 100;

describe("money rules match the server", () => {
  test("ride fares by vehicle", () => {
    for (const c of cases.fares) {
      const got = calculateFare(c.distanceKm, ratesFor(c.rates)) as Record<string, number>;
      for (const [vehicle, expected] of Object.entries(c.expected)) {
        expect(round2(got[vehicle])).toBe(expected);
      }
    }
  });

  test("food delivery fee", () => {
    for (const c of cases.foodDelivery) {
      expect(round2(calculateFoodDeliveryFee(c.distanceKm, ratesFor(c.rates)))).toBe(c.expected);
    }
  });

  test("food service fee", () => {
    for (const c of cases.serviceFee) {
      expect(calculateServiceFee(c.subtotal, c.rate, c.min, c.max)).toBe(c.expected);
    }
  });

  test("rider earnings breakdown from fare and rate", () => {
    for (const c of cases.earnings) {
      const b = breakdownFromDispatchMeta({ grossFare: c.fare, commissionRate: c.rate });
      if (!c.fare) {
        expect(b).toBeNull();
        continue;
      }
      expect(b?.commissionAmount).toBe(c.expected.commissionAmount);
      expect(b?.netEarning).toBe(c.expected.netEarning);
      expect(b?.commissionPercent).toBe(c.expected.commissionPercent);
    }
  });
});
