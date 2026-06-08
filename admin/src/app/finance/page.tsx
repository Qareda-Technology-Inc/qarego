
"use client";

import { useState, useEffect } from 'react';
import { fetcher } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader2, DollarSign, Wallet, CreditCard, Send } from 'lucide-react';

export default function FinancePage() {
  const [stats, setStats] = useState<any>(null);
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
    } catch (e: any) {
      setPayoutResult(e?.message || 'Failed to run payouts');
    } finally {
      setPayoutLoading(false);
    }
  };

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-green-100 text-sm font-medium">Total Revenue</p>
                <h3 className="text-3xl font-bold mt-2">{formatCurrency(stats?.totalRevenue)}</h3>
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
                <p className="text-blue-100 text-sm font-medium">Platform Income ({(stats?.commissionRate ?? 0.15) * 100}%)</p>
                <h3 className="text-3xl font-bold mt-2">{formatCurrency(stats?.platformIncome)}</h3>
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
                <p className="text-purple-100 text-sm font-medium">Driver Earnings</p>
                <h3 className="text-3xl font-bold mt-2">{formatCurrency(stats?.driverEarnings)}</h3>
              </div>
              <div className="p-2 bg-white/20 rounded-lg">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-amber-800 text-sm font-medium">Commission Owed by Drivers</p>
                <h3 className="text-2xl font-bold mt-2 text-amber-900">{formatCurrency(stats?.totalCommissionOwed)}</h3>
                <p className="text-amber-700 text-xs mt-1">Total negative driver balances (to collect via top-up)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-700 text-sm font-medium">Net Driver Balance</p>
                <h3 className="text-2xl font-bold mt-2 text-gray-900">{formatCurrency(stats?.totalDriverBalance)}</h3>
                <p className="text-gray-600 text-xs mt-1">Sum of all driver balances (positive = we owe them)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Payouts</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Send balance to drivers via Hubtel Mobile Money</p>
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
          <CardTitle>Monthly Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase font-medium">
                <tr>
                  <th className="px-6 py-3">Month</th>
                  <th className="px-6 py-3">Rides Count</th>
                  <th className="px-6 py-3">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {stats?.monthlyRevenue?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-gray-500">No data available</td>
                  </tr>
                ) : (
                  stats?.monthlyRevenue?.map((item: any) => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {new Date(0, item._id - 1).toLocaleString('default', { month: 'long' })}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {item.count}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {formatCurrency(item.total)}
                      </td>
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
