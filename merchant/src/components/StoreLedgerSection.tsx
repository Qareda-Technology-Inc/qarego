"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import { Landmark, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

type Balance = { restaurantId: string; name: string; imageEmoji?: string; owed: number };

type Entry = {
  _id: string;
  createdAt: string;
  type: "PICKUP_COMMISSION" | "CASH_PAYMENT" | "CANCELLATION_FEE" | string;
  /** Positive raises what the store owes QareGO; negative (payments) lowers it. */
  amount: number;
  owedAfter: number;
  note?: string | null;
  foodOrder?: string | null;
  restaurant?: { _id: string; name: string; imageEmoji?: string } | null;
};

const TYPE_LABELS: Record<string, { label: string; hint: string }> = {
  PICKUP_COMMISSION: {
    label: "Pickup order commission",
    hint: "QareGO's share of an order the customer collected and paid at the store",
  },
  CASH_PAYMENT: {
    label: "Payment to QareGO",
    hint: "A payment you made towards what you owe",
  },
  CANCELLATION_FEE: {
    label: "Courier cancellation fee",
    hint: "The courier was paid for a trip your store cancelled after they started",
  },
};

const PAGE_SIZE = 20;

/**
 * What each store owes QareGO and every change to it. Follows the page's store filter.
 */
type LedgerResponse = {
  balances?: Balance[];
  totalOwed?: number;
  entries?: Entry[];
  total?: number;
  pages?: number;
};

/**
 * What each store owes QareGO and every change to it. Follows the page's store filter;
 * the parent remounts it (key) when the filter changes, which resets paging.
 */
export function StoreLedgerSection({ storeFilter }: { storeFilter: string }) {
  const [page, setPage] = useState(1);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestKey = `${storeFilter}|${page}|${refreshNonce}`;
  // State is only set when a response lands, so loading is derived from which request it was for.
  const [result, setResult] = useState<{ key: string; data?: LedgerResponse; error?: string } | null>(
    null
  );
  const [lastData, setLastData] = useState<LedgerResponse>({});

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      restaurantId: storeFilter,
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    fetcher(`/merchant/ledger?${params}`)
      .then((data) => {
        if (cancelled) return;
        setResult({ key: requestKey, data: data as LedgerResponse });
        setLastData(data as LedgerResponse);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          error: e instanceof Error ? e.message : "Could not load your balance",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, storeFilter, page]);

  const loading = result?.key !== requestKey;
  const error = result?.key === requestKey ? result.error ?? "" : "";
  const balances = lastData.balances ?? [];
  const totalOwed = lastData.totalOwed ?? 0;
  const entries = lastData.entries ?? [];
  const total = lastData.total ?? 0;
  const pages = lastData.pages ?? 1;
  const load = () => setRefreshNonce((n) => n + 1);

  const showStoreColumn = storeFilter === "all";

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Landmark className="h-5 w-5 text-brand" />
        <h2 className="text-lg font-semibold text-foreground">Balance with QareGO</h2>
        <Button
          type="button"
          variant="secondary"
          className="ml-auto"
          onClick={() => load()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 inline ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <p className="text-sm text-muted mb-4">
        What your store{balances.length === 1 ? "" : "s"} currently owe{balances.length === 1 ? "s" : ""}{" "}
        QareGO, and every change to it.
      </p>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div
          className={`rounded-2xl border p-4 ${
            totalOwed > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-border"
          }`}
        >
          <p className="text-xs text-muted">{showStoreColumn ? "Total owed" : "Owed"}</p>
          <p className={`text-xl font-bold mt-1 ${totalOwed > 0 ? "text-amber-700" : "text-foreground"}`}>
            {loading && !balances.length ? "—" : formatCurrency(totalOwed)}
          </p>
          <p className="text-[11px] text-muted mt-1">
            {totalOwed > 0 ? "Payable to QareGO" : "Nothing owed"}
          </p>
        </div>
        {showStoreColumn && balances.length > 1
          ? balances.map((b) => (
              <div key={b.restaurantId} className="rounded-2xl border border-border bg-white p-4">
                <p className="text-xs text-muted truncate">
                  {b.imageEmoji ? `${b.imageEmoji} ` : ""}
                  {b.name}
                </p>
                <p className="text-xl font-bold mt-1 text-foreground">{formatCurrency(b.owed)}</p>
              </div>
            ))
          : null}
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading && !entries.length ? (
          <p className="text-muted px-4 py-8">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-muted px-4 py-8 text-center">No changes to your balance yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  {showStoreColumn ? <th className="px-4 py-3 font-medium">Store</th> : null}
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium text-right">Change</th>
                  <th className="px-4 py-3 font-medium text-right">Owed after</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e) => {
                  const meta = TYPE_LABELS[e.type] ?? { label: e.type, hint: "" };
                  const lowers = e.amount < 0;
                  return (
                    <tr key={e._id} className="hover:bg-slate-50/80 align-top">
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      {showStoreColumn ? (
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">
                          {e.restaurant?.imageEmoji ? `${e.restaurant.imageEmoji} ` : ""}
                          {e.restaurant?.name ?? "—"}
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{meta.label}</p>
                        <p className="text-xs text-muted">{e.note || meta.hint}</p>
                      </td>
                      <td className="px-4 py-3 text-muted font-mono text-xs">
                        {e.foodOrder ? `#${e.foodOrder.slice(-8).toUpperCase()}` : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                          lowers ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {lowers ? "−" : "+"}
                        {formatCurrency(Math.abs(e.amount))}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground whitespace-nowrap">
                        {formatCurrency(e.owedAfter)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
            <span className="text-muted">
              {total} change{total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-muted">
                {page} / {pages}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={page >= pages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
