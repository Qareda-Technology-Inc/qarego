
"use client";

import { useState, useEffect } from 'react';
import { fetcher } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader2, DollarSign, Wallet, CreditCard, Send } from 'lucide-react';
import Link from "next/link";
import { RiderDebtsCard } from "@/components/RiderDebtsCard";
import { StoreDebtsCard } from "@/components/StoreDebtsCard";
import { useFeatures } from "@/lib/features";

type MonthRow = { month: string; trips: number; orders: number; gross: number };
type FinanceStats = {
  totalRevenue: number;
  platformIncome: number;
  driverEarnings: number;
  trips: { count: number; gross: number; platform: number };
  storeOrders: {
    count: number;
    gross: number;
    platform: number;
    byVertical: { vertical: string; count: number; gross: number; platform: number }[];
  };
  totalCommissionOwed: number;
  totalDriverBalance: number;
  monthlyRevenue: MonthRow[];
};
type ServiceRow = { label: string; count: number; gross: number; platform: number };

const VERTICAL_LABELS: Record<string, string> = {
  FOOD: "Food",
  GROCERY: "Groceries",
  PHARMACY: "Pharmacy",
  GAS: "Cooking gas",
};

/** "2026-10" → "October 2026" */
function formatMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
}

export default function FinancePage() {
  const { momoEnabled } = useFeatures();
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutResult, setPayoutResult] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      const data = await fetcher('/admin/finance');
      setStats(data);
    } catch (error) {
      console.error("Failed to load finance stats", error);
    } finally {
      setLoading(false);
    };
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleRunPayouts = async () => {
    if (!confirm('Execute weekly payouts? Drivers with positive balance will receive money via Mobile Money.')) return;
    setPayoutResult(null);
    setPayoutLoading(true);
    try {
      const data = await fetcher('/admin/payouts/run', { method: 'POST', body: '{}' });
      setPayoutResult(`Processed: ${data.processed}, Failed: ${data.failed}`);
      loadStats();
    } catch (e: unknown) {
      setPayoutResult(e instanceof Error ? e.message : 'Failed to run payouts');
    } finally {
      setPayoutLoading(false);
    }
  };

  const serviceRows: ServiceRow[] = [
    {
      label: "Rides & parcels",
      count: stats?.trips?.count ?? 0,
      gross: stats?.trips?.gross ?? 0,
      platform: stats?.trips?.platform ?? 0,
    },
    ...(stats?.storeOrders?.byVertical ?? []).map(
      (v) => ({
        label: VERTICAL_LABELS[v.vertical] ?? v.vertical,
        count: v.count,
        gross: v.gross,
        platform: v.platform,
      })
    ),
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Finance Overview</h1>

      <RiderDebtsCard />

      <StoreDebtsCard />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-green-100 text-sm font-medium">Total bookings</p>
                <h3 className="text-3xl font-bold mt-2">{formatCurrency(stats?.totalRevenue)}</h3>
                <p className="text-green-100 text-xs mt-1">What customers paid for completed trips and orders</p>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-100 text-sm font-medium">QareGO income</p>
                <h3 className="text-3xl font-bold mt-2">{formatCurrency(stats?.platformIncome)}</h3>
                <p className="text-blue-100 text-xs mt-1">Commissions and service fees</p>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                <Wallet className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-purple-100 text-sm font-medium">Rider earnings</p>
                <h3 className="text-3xl font-bold mt-2">{formatCurrency(stats?.driverEarnings)}</h3>
                <p className="text-purple-100 text-xs mt-1">After commission</p>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By service</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Completed trips and delivered orders since launch.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase font-medium">
                <tr>
                  <th className="px-6 py-3">Service</th>
                  <th className="px-6 py-3">Completed</th>
                  <th className="px-6 py-3">Bookings</th>
                  <th className="px-6 py-3">QareGO income</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {serviceRows.map((row) => (
                  <tr key={row.label} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.label}</td>
                    <td className="px-6 py-4 text-gray-600">{row.count}</td>
                    <td className="px-6 py-4 text-gray-900">{formatCurrency(row.gross)}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(row.platform)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <p className="text-amber-800 text-sm font-medium">Commission owed by riders</p>
            <h3 className="text-2xl font-bold mt-2 text-amber-900">{formatCurrency(stats?.totalCommissionOwed)}</h3>
            <p className="text-amber-700 text-xs mt-1">Collected in cash; record payments above</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-6">
            <p className="text-gray-700 text-sm font-medium">Net rider balance</p>
            <h3 className="text-2xl font-bold mt-2 text-gray-900">{formatCurrency(stats?.totalDriverBalance)}</h3>
            <p className="text-gray-600 text-xs mt-1">Sum of all rider balances (positive = QareGO owes them)</p>
          </CardContent>
        </Card>
      </div>

      {momoEnabled ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Weekly Payouts</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Send balance to riders by mobile money</p>
            </CardHeader>
            <CardContent>
              <Button onClick={handleRunPayouts} disabled={payoutLoading}>
                {payoutLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running...</> : <><Send className="w-4 h-4 mr-2" /> Execute Weekly Payouts</>}
              </Button>
              {payoutResult && <p className="mt-3 text-sm text-gray-600">{payoutResult}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mobile money checkouts</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Monitor checkout status and retry failed instant merchant payouts.
              </p>
            </CardHeader>
            <CardContent>
              <Link href="/finance/food-payments">
                <Button variant="outline">Open payments monitor</Button>
              </Link>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Monthly breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase font-medium">
                <tr>
                  <th className="px-6 py-3">Month</th>
                  <th className="px-6 py-3">Trips</th>
                  <th className="px-6 py-3">Orders</th>
                  <th className="px-6 py-3">Bookings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {!stats?.monthlyRevenue?.length ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No data available</td>
                  </tr>
                ) : (
                  stats.monthlyRevenue.map((item) => (
                    <tr key={item.month} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{formatMonth(item.month)}</td>
                      <td className="px-6 py-4 text-gray-600">{item.trips}</td>
                      <td className="px-6 py-4 text-gray-600">{item.orders}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(item.gross)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
