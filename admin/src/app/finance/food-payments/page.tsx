"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetcher } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/currency";
import { AlertCircle, CheckCircle2, Loader2, RotateCw } from "lucide-react";

type FoodPaymentRow = {
  _id: string;
  clientReference: string;
  status: string;
  payoutStatus: string;
  payoutAmount?: number;
  payoutError?: string | null;
  createdAt?: string;
  restaurant?: { _id: string; name?: string };
  customer?: { _id: string; name?: string; phone?: string };
  order?: { _id: string; status?: string; total?: number; paymentStatus?: string };
};

export default function FoodPaymentsPage() {
  const [rows, setRows] = useState<FoodPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [payoutStatus, setPayoutStatus] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setNotice(null);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("status", status);
      if (payoutStatus) params.set("payoutStatus", payoutStatus);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const data = await fetcher(`/admin/food-payments${suffix}`);
      setRows(data?.payments || []);
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Failed to load food payments");
    } finally {
      setLoading(false);
    }
  }, [query, status, payoutStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const retryCount = useMemo(
    () => rows.filter((r) => r.payoutStatus === "failed").length,
    [rows]
  );

  const handleRetry = async (row: FoodPaymentRow) => {
    if (!confirm(`Retry payout for ${row.clientReference}?`)) return;
    setRetryingId(row._id);
    setNotice(null);
    try {
      const data = await fetcher(`/admin/food-payments/${row._id}/retry-payout`, {
        method: "POST",
        body: "{}",
      });
      setNotice(data?.message || "Payout retry complete");
      await load();
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Payout retry failed");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Food Payments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor checkout success and merchant instant payouts.
          </p>
        </div>
        <Link href="/finance">
          <Button variant="outline">Back to Finance</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              placeholder="Search client reference…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm"
            >
              <option value="">All payment statuses</option>
              <option value="initiated">initiated</option>
              <option value="pending">pending</option>
              <option value="success">success</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
            </select>
            <select
              value={payoutStatus}
              onChange={(e) => setPayoutStatus(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm"
            >
              <option value="">All payout statuses</option>
              <option value="pending">pending</option>
              <option value="sent">sent</option>
              <option value="failed">failed</option>
              <option value="not_applicable">not_applicable</option>
            </select>
            <Button onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Refresh
            </Button>
          </div>
          {notice ? (
            <p className="text-sm mt-3 text-gray-700">{notice}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Failed payouts: {retryCount}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading payments…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-gray-500">No payments found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Reference</th>
                    <th className="px-4 py-3 text-left">Restaurant</th>
                    <th className="px-4 py-3 text-left">Order Total</th>
                    <th className="px-4 py-3 text-left">Payment</th>
                    <th className="px-4 py-3 text-left">Payout</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {rows.map((row) => {
                    const retryable = row.status === "success" && row.payoutStatus === "failed";
                    return (
                      <tr key={row._id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{row.clientReference}</div>
                          <div className="text-xs text-gray-500">
                            {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {row.restaurant?.name || "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {formatCurrency(Number(row.order?.total || 0))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                            {row.status === "success" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            ) : null}
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-800">{row.payoutStatus}</div>
                          {row.payoutAmount ? (
                            <div className="text-xs text-gray-500">
                              {formatCurrency(row.payoutAmount)}
                            </div>
                          ) : null}
                          {row.payoutError ? (
                            <div className="text-xs text-red-600 max-w-xs truncate">
                              {row.payoutError}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!retryable || retryingId === row._id}
                            onClick={() => handleRetry(row)}
                          >
                            {retryingId === row._id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                Retrying…
                              </>
                            ) : (
                              <>
                                <RotateCw className="h-4 w-4 mr-1" />
                                Retry payout
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
