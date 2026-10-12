"use client";

import { useCallback, useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Banknote, Loader2 } from "lucide-react";

type DebtRow = {
  _id: string;
  name?: string;
  phone?: string;
  owed: number;
  status: string;
};

/**
 * Cash trips leave QareGO's share with the rider as debt. Riders pay it back in cash;
 * record that here (lifts a debt suspension once nothing is owed).
 */
export function RiderDebtsCard() {
  const [rows, setRows] = useState<DebtRow[]>([]);
  const [debtLimit, setDebtLimit] = useState(-100);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetcher("/admin/rider-debts");
      setRows(data.riders ?? []);
      setDebtLimit(Number(data.debtLimit ?? -100));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const record = async (row: DebtRow) => {
    const input = window.prompt(
      `Cash received from ${row.name || "rider"} (owes ${formatCurrency(row.owed)}):`,
      row.owed.toFixed(2)
    );
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter an amount greater than 0.");
      return;
    }
    if (amount > row.owed && !window.confirm(`That's more than they owe. Record ${formatCurrency(amount)} anyway?`)) {
      return;
    }
    setBusy(row._id);
    try {
      const data = await fetcher(`/admin/drivers/${row._id}/credit`, {
        method: "POST",
        body: JSON.stringify({ amount, kind: "CASH_REPAYMENT" }),
      });
      alert(
        data.reactivated
          ? `Recorded ${formatCurrency(amount)}. The rider's account is active again.`
          : `Recorded ${formatCurrency(amount)}.`
      );
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setBusy(null);
    }
  };

  const total = rows.reduce((sum, r) => sum + r.owed, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-emerald-600" />
          Rider commission owed
        </CardTitle>
        <CardDescription>
          On cash trips the rider keeps QareGO&apos;s share, so it&apos;s owed back. Riders are
          suspended when they owe more than {formatCurrency(-debtLimit)}. Record cash payments
          here; a suspension lifts once the rider owes nothing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No rider owes commission right now.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600">
              {rows.length} rider{rows.length === 1 ? "" : "s"} · {formatCurrency(total)} owed in total
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-3 font-medium">Rider</th>
                    <th className="py-2 pr-3 font-medium">Owes</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id} className="border-t">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-900">{r.name || "Rider"}</div>
                        <div className="text-xs text-gray-500">{r.phone}</div>
                      </td>
                      <td className="py-2 pr-3 font-semibold text-red-700">{formatCurrency(r.owed)}</td>
                      <td className="py-2 pr-3">
                        {r.status === "suspended_debt" ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                            Suspended (debt)
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            {r.status === "active" ? "Active" : r.status}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <Button variant="outline" disabled={busy === r._id} onClick={() => record(r)}>
                          Record cash payment
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
