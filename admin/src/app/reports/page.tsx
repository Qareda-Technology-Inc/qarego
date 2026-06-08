"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Loader2, BarChart3, Users } from "lucide-react";

interface DayReport {
  _id: string;
  count: number;
  completed: number;
  totalFare: number;
}

interface DriverSummary {
  total: number;
  active: number;
  pending: number;
  suspended: number;
}

export default function ReportsPage() {
  const [report, setReport] = useState<DayReport[]>([]);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [driverSummary, setDriverSummary] = useState<DriverSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetcher(`/admin/reports/rides-by-day?days=${days}`);
        setReport(data.report || []);
      } catch (e) {
        console.error("Failed to load report", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days]);

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const data = await fetcher("/drivers");
        const drivers = data.drivers || [];
        const active = drivers.filter((d: any) => (d.driverDetails?.status || "") === "active").length;
        const pending = drivers.filter((d: any) => (d.driverDetails?.status || "") === "pending").length;
        const suspended = drivers.filter(
          (d: any) =>
            (d.driverDetails?.status || "").startsWith("suspended")
        ).length;
        setDriverSummary({
          total: drivers.length,
          active,
          pending,
          suspended,
        });
      } catch (e) {
        console.error("Failed to load driver summary", e);
      }
    };
    loadDrivers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Basic Reporting</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-sm text-gray-500">Last</span>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      {driverSummary !== null && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-medium text-gray-900">Active drivers</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-2xl font-bold text-gray-900">{driverSummary.active}</p>
                <p className="text-sm text-gray-500">Active</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{driverSummary.pending}</p>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{driverSummary.suspended}</p>
                <p className="text-sm text-gray-500">Suspended</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{driverSummary.total}</p>
                <p className="text-sm text-gray-500">Total drivers</p>
              </div>
              <Link
                href="/drivers"
                className="self-center text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                View all drivers →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-medium text-gray-900">Rides per day</h3>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : report.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No data for this period.</p>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Rides</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Completed</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.map((row) => (
                    <tr key={row._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row._id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{row.completed}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(row.totalFare)}</td>
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
