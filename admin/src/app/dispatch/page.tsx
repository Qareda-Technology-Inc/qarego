"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, Settings, Car, AlertTriangle } from "lucide-react";

type Overview = {
  riders: { total: number; active: number; onlineOnDuty: number; withServicePause?: number };
  pausedServices: string[];
  vehicleCapabilityMatrix: { vehicle: string; supportedServices: string[] }[];
  vehicleCapabilityPolicy: { pragyaFoodEnabled?: boolean; comfortFoodEnabled?: boolean };
  commissionByService: Record<string, number> | null;
  commissionRate: number;
};

const SERVICE_LABEL: Record<string, string> = {
  RIDE: "Rides",
  DELIVERY: "Parcels",
  FOOD: "Food",
};

export default function DispatchPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    fetcher("/admin/dispatch/overview")
      .then(setOverview)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading dispatch…
      </div>
    );
  }

  if (!overview) {
    return <p className="text-red-600">Failed to load dispatch overview.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rider dispatch"
        description="Platform rules for matching riders to rides, parcels, and food. Configure commissions and maintenance in Settings."
        actions={
          <div className="flex gap-2">
            <Link href="/dispatch/analytics">
              <Button variant="default">Analytics</Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Platform settings
              </Button>
            </Link>
          </div>
        }
      />

      {overview.pausedServices.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Service maintenance active</p>
            <p className="text-sm mt-1">
              Paused: {overview.pausedServices.map((s) => SERVICE_LABEL[s] || s).join(", ")}
            </p>
            <Link href="/settings" className="text-sm underline mt-2 inline-block">
              Change in Settings →
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Online & on duty</CardDescription>
            <CardTitle className="text-3xl">{overview.riders.onlineOnDuty}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active riders</CardDescription>
            <CardTitle className="text-3xl">{overview.riders.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total riders</CardDescription>
            <CardTitle className="text-3xl">{overview.riders.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={overview.riders.withServicePause ? "border-amber-200" : undefined}>
          <CardHeader className="pb-2">
            <CardDescription>Reliability pause</CardDescription>
            <CardTitle className="text-3xl">{overview.riders.withServicePause ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-gray-500">Riders with at least one service paused</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehicle → services matrix</CardTitle>
          <CardDescription>
            Base capabilities. Pragya/Comfort food requires policy toggles in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Vehicle</th>
                  <th className="py-2">Can receive</th>
                </tr>
              </thead>
              <tbody>
                {overview.vehicleCapabilityMatrix.map((row) => (
                  <tr key={row.vehicle} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium capitalize">{row.vehicle}</td>
                    <td className="py-3">
                      {row.supportedServices.map((s) => SERVICE_LABEL[s] || s).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Pragya food: {overview.vehicleCapabilityPolicy.pragyaFoodEnabled ? "enabled" : "off"}
            {" · "}
            Comfort food: {overview.vehicleCapabilityPolicy.comfortFoodEnabled ? "enabled" : "off"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commission by service</CardTitle>
          <CardDescription>Rider net pay uses these rates on completed trips.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {(["RIDE", "DELIVERY", "FOOD"] as const).map((key) => {
              const rate =
                overview.commissionByService?.[key] ?? overview.commissionRate ?? 0.15;
              return (
                <div key={key} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-500">{SERVICE_LABEL[key]}</p>
                  <p className="text-xl font-semibold">{(rate * 100).toFixed(0)}%</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Link href="/drivers">
        <Button>
          <Car className="w-4 h-4 mr-2" />
          Manage drivers & work modes
        </Button>
      </Link>
    </div>
  );
}
