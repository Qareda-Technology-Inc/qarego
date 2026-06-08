"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, ArrowLeft, BarChart3 } from "lucide-react";

type ServiceRow = {
  serviceType: string;
  label: string;
  total?: number;
  completed?: number;
  offersAccepted?: number;
  offersDeclined?: number;
  offersSeen?: number;
  acceptanceRate?: number | null;
  ridersPaused?: number;
};

type Analytics = {
  days: number;
  trips: {
    tripsByService: ServiceRow[];
    tripTotals: { total: number; completed: number; completionRate: number | null };
    daily: { date: string; total: number; completed: number }[];
  };
  reliability: {
    activeRiders: number;
    offerResponseByService: ServiceRow[];
    offerResponseTotals: {
      offersSeen: number;
      acceptanceRate: number | null;
    };
    topRidersByCompletions: {
      riderId: string;
      name: string;
      completed: number;
      acceptanceRate: number | null;
    }[];
    lowAcceptanceRiders: {
      riderId: string;
      name: string;
      offersSeen: number;
      acceptanceRate: number | null;
    }[];
  };
};

const DAY_OPTIONS = [7, 14, 30];

function pct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v}%`;
}

export default function DispatchAnalyticsPage() {
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    setLoading(true);
    fetcher(`/admin/dispatch/analytics?days=${days}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading analytics…
      </div>
    );
  }

  if (!data) {
    return <p className="text-red-600">Failed to load dispatch analytics.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch analytics"
        description={`Trip volume and offer acceptance across services (last ${data.days} days).`}
        actions={
          <Link href="/dispatch">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dispatch overview
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        {DAY_OPTIONS.map((d) => (
          <Button
            key={d}
            type="button"
            variant={days === d ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(d)}
          >
            {d} days
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trips created</CardDescription>
            <CardTitle className="text-3xl">{data.trips.tripTotals.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl">{data.trips.tripTotals.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Platform offer acceptance</CardDescription>
            <CardTitle className="text-3xl">
              {pct(data.reliability.offerResponseTotals.acceptanceRate)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-gray-500">
            {data.reliability.offerResponseTotals.offersSeen} offers responded (lifetime, active riders)
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Trips by service
          </CardTitle>
          <CardDescription>Volume and completion rate in the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Service</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">Completed</th>
                  <th className="py-2">Completion %</th>
                </tr>
              </thead>
              <tbody>
                {data.trips.tripsByService.map((row) => (
                  <tr key={row.serviceType} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium">{row.label}</td>
                    <td className="py-3 pr-4">{row.total}</td>
                    <td className="py-3 pr-4">{row.completed}</td>
                    <td className="py-3">{pct(row.completionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Offer acceptance by service</CardTitle>
          <CardDescription>
            Accepted vs missed offers (lifetime counters on {data.reliability.activeRiders} active riders)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Service</th>
                  <th className="py-2 pr-4">Accepted</th>
                  <th className="py-2 pr-4">Missed</th>
                  <th className="py-2 pr-4">Rate</th>
                  <th className="py-2">Paused riders</th>
                </tr>
              </thead>
              <tbody>
                {data.reliability.offerResponseByService.map((row) => (
                  <tr key={row.serviceType} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium">{row.label}</td>
                    <td className="py-3 pr-4">{row.offersAccepted}</td>
                    <td className="py-3 pr-4">{row.offersDeclined}</td>
                    <td className="py-3 pr-4">{pct(row.acceptanceRate)}</td>
                    <td className="py-3">{row.ridersPaused ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top riders (completions)</CardTitle>
            <CardDescription>Lifetime completed trips per active rider</CardDescription>
          </CardHeader>
          <CardContent>
            {data.reliability.topRidersByCompletions.length === 0 ? (
              <p className="text-sm text-gray-500">No data yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.reliability.topRidersByCompletions.map((r, i) => (
                  <li key={r.riderId} className="flex justify-between border-b border-gray-100 py-2">
                    <span>
                      {i + 1}.{" "}
                      <Link href={`/drivers/${r.riderId}/edit`} className="text-blue-600 hover:underline">
                        {r.name}
                      </Link>
                    </span>
                    <span className="text-gray-600">
                      {r.completed} trips · {pct(r.acceptanceRate)} accept
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low acceptance (needs review)</CardTitle>
            <CardDescription>Riders with ≥5 offers seen and &lt;50% acceptance</CardDescription>
          </CardHeader>
          <CardContent>
            {data.reliability.lowAcceptanceRiders.length === 0 ? (
              <p className="text-sm text-gray-500">No riders flagged.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.reliability.lowAcceptanceRiders.map((r) => (
                  <li key={r.riderId} className="flex justify-between border-b border-gray-100 py-2">
                    <Link href={`/drivers/${r.riderId}/edit`} className="text-blue-600 hover:underline">
                      {r.name}
                    </Link>
                    <span className="text-amber-700 font-medium">{pct(r.acceptanceRate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 sticky top-0 bg-white">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2">Completed</th>
                </tr>
              </thead>
              <tbody>
                {data.trips.daily.map((row) => (
                  <tr key={row.date} className="border-b border-gray-100">
                    <td className="py-2 pr-4">{row.date}</td>
                    <td className="py-2 pr-4">{row.total}</td>
                    <td className="py-2">{row.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
