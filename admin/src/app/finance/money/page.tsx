"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Copy, Loader2, RotateCcw, Search } from "lucide-react";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type MoneyRow = {
  kind: string;
  at: string;
  amount: number;
  status: string;
  reference: string | null;
  who: string;
  detail: string;
  channel?: string | null;
  link: string | null;
};
type MoneyData = {
  totals: { in: number; out: number; refunded: number; refundsOpen: number; problems: number };
  moneyIn: MoneyRow[];
  moneyOut: MoneyRow[];
  refunds: MoneyRow[];
};
type Tab = "in" | "out" | "refunds";

const STATUS_TONE: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  sent: "bg-green-100 text-green-800",
  refunded: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  due: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-700",
  unpaid: "bg-gray-100 text-gray-700",
  wallet: "bg-amber-100 text-amber-800",
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Everything that went through the payment provider, with its reference to look up in the
 * Paystack dashboard: money in (orders, trips, rider top-ups), money out (payouts) and refunds.
 */
export default function MoneyPage() {
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [tab, setTab] = useState<Tab>("in");
  const [data, setData] = useState<MoneyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetcher(`/admin/money?from=${from}&to=${to}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load money movements");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const rows = useMemo(() => {
    const list = tab === "in" ? data?.moneyIn : tab === "out" ? data?.moneyOut : data?.refunds;
    const q = query.trim().toLowerCase();
    return (list ?? []).filter(
      (r) =>
        (!onlyProblems || ["failed", "due"].includes(r.status)) &&
        (!q || [r.reference, r.who, r.detail, r.kind].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [data, tab, query, onlyProblems]);

  const copy = async (ref: string) => {
    try {
      await navigator.clipboard.writeText(ref);
      setCopied(ref);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked: the reference is still visible to copy by hand */
    }
  };

  const t = data?.totals;
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "in", label: "Money in", count: data?.moneyIn.length ?? 0 },
    { key: "out", label: "Money out", count: data?.moneyOut.length ?? 0 },
    { key: "refunds", label: "Refunds", count: data?.refunds.length ?? 0 },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> Finance
        </Link>
        <h1 className="mt-2 text-xl font-bold text-gray-900 sm:text-2xl">Money movements</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every mobile money and card payment, payout and refund. Use the reference to find it in the Paystack
          dashboard.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-gray-600">
          From
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" />
        </label>
        <label className="text-sm text-gray-600">
          To
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" />
        </label>
        {loading ? <Loader2 className="mb-2 h-5 w-5 animate-spin text-blue-600" /> : null}
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total icon={ArrowDownLeft} label="Received" value={t?.in} tone="text-green-700" />
        <Total icon={ArrowUpRight} label="Paid out" value={t?.out} tone="text-blue-700" />
        <Total icon={RotateCcw} label="Refunded" value={t?.refunded} tone="text-gray-800" />
        <Total
          icon={RotateCcw}
          label="Refunds still open"
          value={t?.refundsOpen}
          tone={t?.refundsOpen ? "text-amber-700" : "text-gray-800"}
        />
      </div>
      {t?.problems ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {t.problems} failed payout{t.problems === 1 ? "" : "s"} or refund{t.problems === 1 ? "" : "s"} in this period.
          Turn on &quot;Only problems&quot; to see them.
        </p>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((x) => (
              <button
                key={x.key}
                onClick={() => setTab(x.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  tab === x.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {x.label} <span className="opacity-70">{x.count}</span>
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
              Only problems
            </label>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search reference, name or store"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              {loading ? "Loading…" : "Nothing here for this period."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">What</th>
                    <th className="py-2 pr-3 font-medium">Who</th>
                    <th className="py-2 pr-3 text-right font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r, i) => (
                    <tr key={`${r.reference}-${i}`} className="align-top">
                      <td className="whitespace-nowrap py-2.5 pr-3 text-gray-600">
                        {new Date(r.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-gray-900">{r.kind}</p>
                        <p className="text-xs text-gray-500">
                          {r.link ? (
                            <Link href={r.link} className="hover:underline">
                              {r.detail}
                            </Link>
                          ) : (
                            r.detail
                          )}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700">{r.who}</td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right font-semibold text-gray-900">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            STATUS_TONE[r.status] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {r.status === "wallet" ? "To wallet" : r.status}
                        </span>
                      </td>
                      <td className="py-2.5">
                        {r.reference ? (
                          <button
                            onClick={() => copy(r.reference!)}
                            className="inline-flex items-center gap-1 font-mono text-xs text-gray-600 hover:text-gray-900"
                            title="Copy reference"
                          >
                            {r.reference}
                            <Copy className="h-3 w-3" />
                            {copied === r.reference ? <span className="font-sans text-green-700">Copied</span> : null}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Total({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ArrowDownLeft;
  label: string;
  value?: number;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <Icon className="h-3.5 w-3.5" /> {label}
        </p>
        <p className={`mt-1 text-xl font-bold ${tone}`}>{formatCurrency(value ?? 0)}</p>
      </CardContent>
    </Card>
  );
}
