"use client";

import { useCallback, useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { useFeatures } from "@/lib/features";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, Wallet } from "lucide-react";

type BalanceRow = {
  _id: string;
  name?: string;
  phone?: string;
  balance: number;
  status: string;
};

/**
 * Money QareGO holds for riders: MoMo trip fares, cancellation pay and credits sit in their
 * wallet until they cash out in the app. Admin can pay one rider out when they ask.
 */
export function RiderBalancesCard() {
  const { momoEnabled } = useFeatures();
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetcher("/admin/rider-balances");
      setRows(data.riders ?? []);
      setTotal(Number(data.total ?? 0));
      setCount(Number(data.riderCount ?? 0));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const payOut = async (row: BalanceRow) => {
    if (
      !window.confirm(
        `Send ${formatCurrency(row.balance)} to ${row.name || "this rider"}'s MoMo (${row.phone})? Their wallet goes to GH₵0.`
      )
    ) {
      return;
    }
    setBusy(row._id);
    try {
      const data = await fetcher(`/admin/drivers/${row._id}/payout`, { method: "POST", body: "{}" });
      alert(data.message || "Sent.");
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Payout failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-blue-600" />
          Rider balances
        </CardTitle>
        <CardDescription>
          Money QareGO is holding for riders: mobile money trip fares, cancellation pay and credits. Riders take it out
          themselves with Cash Out in the app, and it also covers their commission on cash trips. Pay a rider out here
          only when they ask you to.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No rider has money in their wallet right now.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600">
              {formatCurrency(total)} held for {count} rider{count === 1 ? "" : "s"}
              {count > rows.length ? ` · largest ${rows.length} shown` : ""}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-3 font-medium">Rider</th>
                    <th className="py-2 pr-3 font-medium">In wallet</th>
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
                      <td className="py-2 pr-3 font-semibold text-blue-700">{formatCurrency(r.balance)}</td>
                      <td className="py-2 text-right">
                        <Button
                          variant="outline"
                          disabled={!momoEnabled || busy === r._id}
                          onClick={() => payOut(r)}
                          title={momoEnabled ? undefined : "Mobile money is switched off"}
                        >
                          {busy === r._id ? "Sending…" : "Pay out"}
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
