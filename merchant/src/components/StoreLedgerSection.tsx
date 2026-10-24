"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { useFeatures } from "@/lib/features";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import { Landmark, RefreshCw, ChevronLeft, ChevronRight, CreditCard, AlertTriangle } from "lucide-react";

type Balance = {
  restaurantId: string;
  name: string;
  imageEmoji?: string;
  owed: number;
  /** QareGO's debt limit (0 = none). Over it, the store gets no new orders until it pays. */
  limit?: number;
  paused?: boolean;
};

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
    label: "Cash payment to QareGO",
    hint: "A cash payment you made towards what you owe",
  },
  MOMO_PAYMENT: {
    label: "Paid online",
    hint: "You paid QareGO by mobile money or card",
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
  const { momoEnabled } = useFeatures();
  const [paying, setPaying] = useState<string | null>(null);
  const [payNotice, setPayNotice] = useState<{ tone: "ok" | "wait" | "bad"; text: string } | null>(null);

  // Back from Paystack (?storePayment=<ref>): confirm the payment, then refresh the balance.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("storePayment");
    if (!ref) return;
    url.searchParams.delete("storePayment");
    window.history.replaceState(null, "", url.toString());
    let stopped = false;
    let tries = 0;
    const check = async () => {
      if (stopped) return;
      tries += 1;
      try {
        const data = await fetcher(`/merchant/balance/pay/${encodeURIComponent(ref)}`);
        if (data.status === "completed") {
          setPayNotice({ tone: "ok", text: `Payment received. Thank you! You now owe ${formatCurrency(data.owed)}.` });
          setRefreshNonce((n) => n + 1);
          return;
        }
        if (tries >= 10) {
          setPayNotice({
            tone: "bad",
            text: "We haven't received this payment. If money left your account, it will show here once Paystack confirms it.",
          });
          return;
        }
        setPayNotice({ tone: "wait", text: "Confirming your payment…" });
      } catch {
        if (tries >= 10) return;
      }
      setTimeout(check, 3000);
    };
    const t = setTimeout(check, 0);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, []);

  const pay = async (b: Balance) => {
    const input = window.prompt(
      `Pay QareGO for ${b.name}. You owe ${formatCurrency(b.owed)}. How much do you want to pay now?`,
      b.owed.toFixed(2)
    );
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount < 1) {
      window.alert("Enter an amount of at least GH₵1.");
      return;
    }
    setPaying(b.restaurantId);
    try {
      const data = await fetcher("/merchant/balance/pay", {
        method: "POST",
        body: JSON.stringify({ restaurantId: b.restaurantId, amount }),
      });
      // Paystack's secure page (mobile money or card); it sends you back here when done.
      window.location.assign(data.checkoutUrl);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Couldn't start the payment");
      setPaying(null);
    }
  };

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

      {payNotice ? (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
            payNotice.tone === "ok"
              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
              : payNotice.tone === "wait"
                ? "border-sky-100 bg-sky-50 text-sky-800"
                : "border-amber-100 bg-amber-50 text-amber-800"
          }`}
        >
          {payNotice.text}
        </div>
      ) : null}

      {balances
        .filter((b) => b.paused)
        .map((b) => (
          <div
            key={`paused-${b.restaurantId}`}
            className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              <strong>New orders are paused for {b.name}.</strong> It owes {formatCurrency(b.owed)}, over QareGO&apos;s{" "}
              {formatCurrency(b.limit ?? 0)} limit. Pay to start getting orders again straight away.
            </span>
          </div>
        ))}

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
          {momoEnabled && balances.length === 1 && balances[0].owed > 0 ? (
            <Button
              type="button"
              className="mt-3 w-full"
              disabled={paying === balances[0].restaurantId}
              onClick={() => pay(balances[0])}
            >
              <CreditCard className="mr-1 inline h-4 w-4" />
              {paying === balances[0].restaurantId ? "Opening…" : "Pay QareGO"}
            </Button>
          ) : null}
        </div>
        {showStoreColumn && balances.length > 1
          ? balances.map((b) => (
              <div key={b.restaurantId} className="rounded-2xl border border-border bg-white p-4">
                <p className="text-xs text-muted truncate">
                  {b.imageEmoji ? `${b.imageEmoji} ` : ""}
                  {b.name}
                </p>
                <p className="text-xl font-bold mt-1 text-foreground">{formatCurrency(b.owed)}</p>
                {b.paused ? <p className="text-[11px] font-semibold text-red-700 mt-1">Orders paused</p> : null}
                {momoEnabled && b.owed > 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-2 w-full"
                    disabled={paying === b.restaurantId}
                    onClick={() => pay(b)}
                  >
                    {paying === b.restaurantId ? "Opening…" : "Pay"}
                  </Button>
                ) : null}
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
