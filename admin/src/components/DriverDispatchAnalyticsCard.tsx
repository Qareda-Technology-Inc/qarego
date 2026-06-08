"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Loader2 } from "lucide-react";

type ServiceRow = {
  serviceType: string;
  label: string;
  acceptanceRate: number | null;
  offersAccepted: number;
  offersDeclined: number;
  completed: number;
};

export function DriverDispatchAnalyticsCard({ driverId }: { driverId: string }) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [totals, setTotals] = useState<{
    acceptanceRate: number | null;
    offersSeen: number;
    completed: number;
  } | null>(null);

  useEffect(() => {
    fetcher(`/admin/dispatch/drivers/${driverId}`)
      .then((data) => {
        setServices(data.analytics?.services || []);
        setTotals(data.analytics?.totals || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [driverId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispatch performance</CardTitle>
        <CardDescription>
          Lifetime offer acceptance and completions (from reliability counters).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-4">
          Overall acceptance:{" "}
          <span className="font-semibold">
            {totals?.acceptanceRate != null ? `${totals.acceptanceRate}%` : "—"}
          </span>
          {totals?.offersSeen ? ` · ${totals.offersSeen} offers` : ""}
          {totals?.completed != null ? ` · ${totals.completed} completed` : ""}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {services.map((s) => (
            <div key={s.serviceType} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{s.label}</p>
              <p className="text-gray-500 mt-1">
                {s.acceptanceRate != null ? `${s.acceptanceRate}% accept` : "No offers yet"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {s.completed} completed · {s.offersDeclined} missed
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
