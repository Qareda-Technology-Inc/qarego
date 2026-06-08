"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";

type ServiceRel = {
  serviceType: string;
  label: string;
  strikes: number;
  isPaused: boolean;
  pausedReason?: string | null;
  offersDeclined: number;
  completed: number;
};

export function DriverReliabilityEditor({ driverId }: { driverId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<ServiceRel[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetcher(`/admin/dispatch/drivers/${driverId}`);
      setServices(data.reliability?.services || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [driverId]);

  const patch = async (body: Record<string, string>) => {
    setSaving(true);
    try {
      await fetcher(`/admin/dispatch/drivers/${driverId}/reliability`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await load();
      alert("Reliability updated.");
    } catch (e) {
      alert("Failed to update reliability");
    } finally {
      setSaving(false);
    }
  };

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
        <CardTitle>Reliability & safety</CardTitle>
        <CardDescription>
          Per-service strikes from missed offers. Auto-pause uses platform policy in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={() => patch({ action: "reset_all" })}
        >
          Reset all services
        </Button>
        {services.map((svc) => (
          <div
            key={svc.serviceType}
            className={`rounded-lg border p-3 ${svc.isPaused ? "border-amber-300 bg-amber-50" : "border-gray-200"}`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{svc.label}</span>
              <span className="text-sm text-gray-500">{svc.strikes} strikes</span>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Missed {svc.offersDeclined} · Completed {svc.completed}
              {svc.isPaused && svc.pausedReason ? ` · ${svc.pausedReason}` : ""}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => patch({ action: "reset", serviceType: svc.serviceType })}
              >
                Reset
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => patch({ action: "pause", serviceType: svc.serviceType })}
              >
                Pause service
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
