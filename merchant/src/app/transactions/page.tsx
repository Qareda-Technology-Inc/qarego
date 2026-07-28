"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import {
  Wallet,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Smartphone,
  Store,
} from "lucide-react";

type PaymentBucket = {
  orderCount: number;
  grossSales: number;
  netEarnings: number;
};

type FinanceSummary = {
  orderCount: number;
  grossSales: number;
  commission: number;
  netEarnings: number;
  settled: number;
  pendingSettlement: number;
  byPaymentMethod: {
    CASH: PaymentBucket;
    MOBILE_MONEY: PaymentBucket;
  };
};

type StoreRow = {
  restaurantId: string;
  name: string;
  imageEmoji?: string;
  orderCount: number;
  grossSales: number;
  commission: number;
  netEarnings: number;
};

type TxRow = {
  _id: string;
  createdAt: string;
  status: string;
  paymentMethod?: "CASH" | "MOBILE_MONEY";
  paymentStatus?: string;
  settlementStatus?: string;
  settledAt?: string;
  subtotal: number;
  restaurantCommission: number;
  restaurantNet: number;
  customer?: { name?: string; phone?: string } | null;
  restaurant?: { _id: string; name: string; imageEmoji?: string } | null;
};

const PAGE_SIZE = 25;

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toDateInput(from), to: toDateInput(to) };
}

export default function TransactionsPage() {
  const router = useRouter();
  const { user, isOwner, restaurants } = useAuth();
  const defaults = useMemo(() => defaultRange(), []);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [storeFilter, setStoreFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [byStore, setByStore] = useState<StoreRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && !isOwner) router.replace("/orders");
  }, [user, isOwner, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        from,
        to,
        restaurantId: storeFilter,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      const data = await fetcher(`/merchant/finance?${params}`);
      setSummary(data.summary ?? null);
      setByStore(data.byStore ?? []);
      setTransactions(data.transactions ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load transactions");
    } finally {
      setLoading(false);
    }
  }, [from, to, storeFilter, page]);

  useEffect(() => {
    if (!isOwner) return;
    load();
  }, [isOwner, load]);

  const applyPreset = (days: number | "month") => {
    const end = new Date();
    const start = new Date();
    if (days === "month") {
      start.setDate(1);
    } else {
      start.setDate(start.getDate() - (days - 1));
    }
    setFrom(toDateInput(start));
    setTo(toDateInput(end));
    setPage(1);
  };

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        Redirecting…
      </div>
    );
  }

  const showStoreColumn = storeFilter === "all";

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <Wallet className="h-7 w-7 text-brand" />
        <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
      </div>
      <p className="text-muted mb-6">
        Sales and earnings across your stores. Filter by date and store — totals update for the
        selection.
      </p>

      <div className="bg-white rounded-2xl border border-border p-4 mb-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Today", run: () => applyPreset(1) },
            { label: "7 days", run: () => applyPreset(7) },
            { label: "30 days", run: () => applyPreset(30) },
            { label: "This month", run: () => applyPreset("month") },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={p.run}
              className="px-3 py-1.5 rounded-xl text-sm border border-border bg-white hover:bg-slate-50 text-foreground"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted block mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted block mb-1">Store</label>
            <select
              value={storeFilter}
              onChange={(e) => {
                setPage(1);
                setStoreFilter(e.target.value);
              }}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
            >
              <option value="all">All stores — combined totals</option>
              {restaurants.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.imageEmoji ? `${r.imageEmoji} ` : ""}
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 inline ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <span className="text-sm text-muted ml-auto">
            {total} order{total === 1 ? "" : "s"} in range
          </span>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Gross sales" value={summary ? formatCurrency(summary.grossSales) : "—"} hint="Item subtotals" />
        <SummaryCard label="Platform fee" value={summary ? formatCurrency(summary.commission) : "—"} hint="Commission on sales" />
        <SummaryCard
          label="Net earnings"
          value={summary ? formatCurrency(summary.netEarnings) : "—"}
          hint="What you keep"
          highlight
        />
        <SummaryCard
          label="Orders"
          value={summary ? String(summary.orderCount) : "—"}
          hint={`${summary ? formatCurrency(summary.settled) : "—"} settled`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <PayMethodCard
          icon={Banknote}
          label="Cash orders"
          bucket={summary?.byPaymentMethod.CASH}
        />
        <PayMethodCard
          icon={Smartphone}
          label="Mobile money"
          bucket={summary?.byPaymentMethod.MOBILE_MONEY}
        />
      </div>

      {storeFilter === "all" && byStore.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Store className="h-5 w-5 text-brand" />
            Per store
          </h2>
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Store</th>
                    <th className="px-4 py-3 font-medium text-right">Orders</th>
                    <th className="px-4 py-3 font-medium text-right">Gross</th>
                    <th className="px-4 py-3 font-medium text-right">Fee</th>
                    <th className="px-4 py-3 font-medium text-right">Net</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {byStore.map((s) => (
                    <tr key={s.restaurantId} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {s.imageEmoji ? `${s.imageEmoji} ` : ""}
                        {s.name}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">{s.orderCount}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(s.grossSales)}</td>
                      <td className="px-4 py-3 text-right text-muted">
                        {formatCurrency(s.commission)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-brand">
                        {formatCurrency(s.netEarnings)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-xs font-medium text-brand hover:underline"
                          onClick={() => {
                            setStoreFilter(s.restaurantId);
                            setPage(1);
                          }}
                        >
                          Filter
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <h2 className="text-lg font-semibold text-foreground mb-3">Order transactions</h2>

      {loading && !transactions.length ? (
        <p className="text-muted py-8">Loading transactions…</p>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-muted">
          No orders in this range for the selected store(s).
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  {showStoreColumn ? <th className="px-4 py-3 font-medium">Store</th> : null}
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Pay</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Gross</th>
                  <th className="px-4 py-3 font-medium text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    {showStoreColumn ? (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.restaurant?.imageEmoji ? `${tx.restaurant.imageEmoji} ` : ""}
                        {tx.restaurant?.name || "—"}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {tx.customer?.name || "Customer"}
                      </div>
                      <div className="text-xs text-muted">{tx.customer?.phone || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <PaymentPill method={tx.paymentMethod} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusPill status={tx.status} />
                        <SettlementPill status={tx.settlementStatus} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formatCurrency(tx.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-brand">
                      {formatCurrency(tx.restaurantNet)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted">
            Page {page} of {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight ? "bg-brand/5 border-brand/20" : "bg-white border-border"
      }`}
    >
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? "text-brand" : "text-foreground"}`}>
        {value}
      </p>
      {hint ? <p className="text-[11px] text-muted mt-1">{hint}</p> : null}
    </div>
  );
}

function PayMethodCard({
  icon: Icon,
  label,
  bucket,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  bucket?: PaymentBucket;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 flex items-start gap-3">
      <div className="rounded-xl bg-slate-100 p-2">
        <Icon className="h-5 w-5 text-slate-600" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground mt-0.5">
          {bucket ? formatCurrency(bucket.netEarnings) : "—"}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {bucket
            ? `${bucket.orderCount} order${bucket.orderCount === 1 ? "" : "s"} · gross ${formatCurrency(bucket.grossSales)}`
            : "—"}
        </p>
      </div>
    </div>
  );
}

function PaymentPill({ method }: { method?: string }) {
  if (!method) return <span className="text-xs text-muted">—</span>;
  const cash = method === "CASH";
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
        cash ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"
      }`}
    >
      {cash ? <Banknote className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
      {cash ? "Cash" : "MoMo"}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PLACED: "bg-yellow-100 text-yellow-800",
    PREPARING: "bg-blue-100 text-blue-800",
    READY_FOR_PICKUP: "bg-purple-100 text-purple-800",
    PICKED_UP: "bg-indigo-100 text-indigo-800",
    DELIVERED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full w-fit ${colors[status] || "bg-gray-100"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function SettlementPill({ status }: { status?: string }) {
  if (!status || status === "not_required") return null;
  const map: Record<string, string> = {
    settled: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    processing: "bg-sky-50 text-sky-700",
    failed: "bg-red-50 text-red-700",
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full w-fit ${map[status] || "bg-gray-50 text-gray-600"}`}>
      {status}
    </span>
  );
}
