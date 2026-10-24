"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Banknote, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

type DebtRow = {
  _id: string;
  name?: string;
  address?: string;
  owner?: { name?: string; phone?: string } | null;
  vertical?: string;
  isActive?: boolean;
  owed: number;
  /** Over the debt limit: no new orders until the store pays. */
  paused?: boolean;
};

type LedgerEntry = {
  _id: string;
  createdAt: string;
  type: "PICKUP_COMMISSION" | "CASH_PAYMENT" | "CANCELLATION_FEE" | string;
  /** Positive raises what the store owes QareGO; negative (payments) lowers it. */
  amount: number;
  owedAfter: number;
  note?: string | null;
  foodOrder?: string | null;
};

type LedgerResponse = { entries?: LedgerEntry[]; total?: number; pages?: number };

/** Same wording the merchant portal uses, so admin and store read the same history. */
const TYPE_LABELS: Record<string, string> = {
  PICKUP_COMMISSION: "Pickup order commission",
  CASH_PAYMENT: "Cash payment to QareGO",
  MOMO_PAYMENT: "Paid online (MoMo or card)",
  CANCELLATION_FEE: "Courier cancellation fee",
};

const PAGE_SIZE = 10;

function balanceText(owed: number) {
  if (owed > 0.004) return { text: formatCurrency(owed), className: "text-red-700" };
  if (owed < -0.004) return { text: `${formatCurrency(-owed)} credit`, className: "text-emerald-700" };
  return { text: formatCurrency(0), className: "text-gray-500" };
}

function StoreLedgerRows({ storeId, version }: { storeId: string; version: number }) {
  const [page, setPage] = useState(1);
  const requestKey = `${storeId}|${page}|${version}`;
  // State is only set when a response lands, so loading is derived from which request it was for.
  const [result, setResult] = useState<{ key: string; data?: LedgerResponse; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetcher(`/admin/stores/${storeId}/ledger?page=${page}&limit=${PAGE_SIZE}`)
      .then((d: LedgerResponse) => !cancelled && setResult({ key: requestKey, data: d }))
      .catch(
        (e: unknown) =>
          !cancelled &&
          setResult({ key: requestKey, error: e instanceof Error ? e.message : "Couldn't load history" })
      );
    return () => {
      cancelled = true;
    };
  }, [storeId, page, requestKey]);

  const current = result?.key === requestKey ? result : null;
  if (current?.error) return <p className="text-sm text-red-600">{current.error}</p>;
  const data = current?.data;
  if (!data) return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
  const entries = data.entries ?? [];
  if (entries.length === 0) return <p className="text-sm text-gray-500">No changes recorded yet.</p>;

  return (
    <div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1 pr-3 font-medium">Date</th>
            <th className="py-1 pr-3 font-medium">Reason</th>
            <th className="py-1 pr-3 text-right font-medium">Change</th>
            <th className="py-1 text-right font-medium">Balance after</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e._id} className="border-t border-gray-100">
              <td className="py-1.5 pr-3 whitespace-nowrap text-gray-600">
                {new Date(e.createdAt).toLocaleString()}
              </td>
              <td className="py-1.5 pr-3">
                <div className="text-gray-900">{TYPE_LABELS[e.type] ?? e.type}</div>
                {(e.note || e.foodOrder) && (
                  <div className="text-gray-500">
                    {[e.note, e.foodOrder ? `Order …${e.foodOrder.slice(-6)}` : null].filter(Boolean).join(" · ")}
                  </div>
                )}
              </td>
              <td className={`py-1.5 pr-3 text-right font-medium ${e.amount < 0 ? "text-emerald-700" : "text-red-700"}`}>
                {e.amount < 0 ? "−" : "+"}
                {formatCurrency(Math.abs(e.amount))}
              </td>
              <td className="py-1.5 text-right text-gray-700">{balanceText(e.owedAfter).text}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(data.pages ?? 1) > 1 && (
        <div className="mt-2 flex items-center justify-end gap-2 text-xs text-gray-600">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Newer
          </Button>
          <span>
            Page {page} of {data.pages}
          </span>
          <Button size="sm" variant="ghost" disabled={page >= (data.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>
            Older
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Cash pickup orders are paid to the store at the counter, so QareGO's share (commission +
 * service fee) is owed by the store. Record the store's cash payments here.
 */
export function StoreDebtsCard() {
  const [rows, setRows] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [debtLimit, setDebtLimit] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await fetcher(`/admin/store-debts${showAll ? "?all=1" : ""}`);
      setRows(data.stores ?? []);
      setDebtLimit(Number(data.debtLimit ?? 0));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    load();
  }, [load]);

  const record = async (row: DebtRow) => {
    const owes = row.owed > 0 ? row.owed : 0;
    const input = window.prompt(
      `Cash received from ${row.name || "store"} (owes ${formatCurrency(owes)}):`,
      owes > 0 ? owes.toFixed(2) : ""
    );
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter an amount greater than 0.");
      return;
    }
    if (amount > owes && !window.confirm(`That's more than they owe. Record ${formatCurrency(amount)} anyway?`)) {
      return;
    }
    const note = window.prompt("Reference or note (optional), e.g. receipt number:", "");
    if (note === null) return;
    setBusy(row._id);
    try {
      await fetcher(`/admin/stores/${row._id}/commission-payment`, {
        method: "POST",
        body: JSON.stringify({ amount, note: note.trim() || undefined }),
      });
      alert(`Recorded ${formatCurrency(amount)}.`);
      setVersion((v) => v + 1);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setBusy(null);
    }
  };

  const owing = rows.filter((r) => r.owed > 0.004);
  const total = owing.reduce((sum, r) => sum + r.owed, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-emerald-600" />
          Store balances
        </CardTitle>
        <CardDescription>
          Pickup orders are paid to the store in cash, so QareGO&apos;s share (commission and
          service fee) is owed by the store, along with any courier cancellation fees. Stores can pay
          it online from the merchant portal (Pay QareGO); record cash payments here. Stores see the
          same history in the merchant portal.{" "}
          {debtLimit > 0
            ? `A store owing more than ${formatCurrency(debtLimit)} gets no new orders until it pays.`
            : "There is no debt limit (set one in Settings → Commission)."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => {
              setLoading(true);
              setShowAll(e.target.checked);
            }}
          />
          Show all stores, including ones that owe nothing
        </label>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No store owes QareGO right now.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600">
              {owing.length} store{owing.length === 1 ? "" : "s"} owe{owing.length === 1 ? "s" : ""} ·{" "}
              {formatCurrency(total)} in total
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-3 font-medium">Store</th>
                    <th className="py-2 pr-3 font-medium">Balance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const bal = balanceText(r.owed);
                    const isOpen = open === r._id;
                    return (
                      <Fragment key={r._id}>
                        <tr className="border-t">
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              className="flex items-start gap-1 text-left"
                              onClick={() => setOpen(isOpen ? null : r._id)}
                              aria-expanded={isOpen}
                            >
                              {isOpen ? (
                                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                              ) : (
                                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                              )}
                              <span>
                                <span className="block font-medium text-gray-900">
                                  {r.name || "Store"}
                                  {r.isActive === false && (
                                    <span className="ml-2 text-xs font-normal text-gray-400">inactive</span>
                                  )}
                                  {r.paused ? (
                                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                                      Orders paused
                                    </span>
                                  ) : null}
                                </span>
                                <span className="block text-xs text-gray-500">
                                  {[r.vertical, r.owner?.name, r.owner?.phone].filter(Boolean).join(" · ")}
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className={`py-2 pr-3 font-semibold ${bal.className}`}>{bal.text}</td>
                          <td className="py-2 text-right">
                            <Button variant="outline" disabled={busy === r._id} onClick={() => record(r)}>
                              Record cash payment
                            </Button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={3} className="bg-gray-50 px-3 py-3">
                              <StoreLedgerRows storeId={r._id} version={version} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
