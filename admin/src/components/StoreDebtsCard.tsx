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
  address?: string;
  owner?: { name?: string; phone?: string } | null;
  owed: number;
};

/**
 * Cash pickup orders are paid to the store at the counter, so QareGO's share (commission +
 * service fee) is owed by the store. Record the store's cash payments here.
 */
export function StoreDebtsCard() {
  const [rows, setRows] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetcher("/admin/store-debts");
      setRows(data.stores ?? []);
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
      `Cash received from ${row.name || "store"} (owes ${formatCurrency(row.owed)}):`,
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
      await fetcher(`/admin/stores/${row._id}/commission-payment`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      alert(`Recorded ${formatCurrency(amount)}.`);
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
          Store commission owed
        </CardTitle>
        <CardDescription>
          Pickup orders are paid to the store in cash, so QareGO&apos;s share (commission and
          service fee) is owed by the store. Record the store&apos;s cash payments here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No store owes QareGO right now.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600">
              {rows.length} store{rows.length === 1 ? "" : "s"} · {formatCurrency(total)} owed in total
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-3 font-medium">Store</th>
                    <th className="py-2 pr-3 font-medium">Owes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id} className="border-t">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-900">{r.name || "Store"}</div>
                        <div className="text-xs text-gray-500">
                          {[r.owner?.name, r.owner?.phone].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="py-2 pr-3 font-semibold text-red-700">{formatCurrency(r.owed)}</td>
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
