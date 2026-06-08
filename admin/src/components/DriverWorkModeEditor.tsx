"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Loader2, Save } from "lucide-react";

const PRESETS = [
  { id: "all", label: "All services" },
  { id: "ride_only", label: "Rides only" },
  { id: "delivery_only", label: "Delivery mode" },
  { id: "parcel_only", label: "Parcels only" },
  { id: "food_only", label: "Food only" },
];

type ServiceKey = "RIDE" | "DELIVERY" | "FOOD";

export function DriverWorkModeEditor({ driverId }: { driverId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState("all");
  const [supported, setSupported] = useState<ServiceKey[]>([]);
  const [effective, setEffective] = useState<Record<string, boolean>>({});
  const [prefs, setPrefs] = useState<Record<string, { enabled?: boolean }>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetcher(`/admin/dispatch/drivers/${driverId}`);
      setPreset(data.servicePreset || "all");
      setSupported(data.vehicleSupportedServices || []);
      setEffective(data.effectivePreferences || {});
      setPrefs(data.servicePreferences || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [driverId]);

  const save = async () => {
    setSaving(true);
    try {
      await fetcher(`/admin/dispatch/drivers/${driverId}/service-preferences`, {
        method: "PATCH",
        body: JSON.stringify({
          preset: preset === "custom" ? undefined : preset,
          servicePreferences: prefs,
        }),
      });
      await load();
      alert("Work mode saved.");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (id: string) => {
    setPreset(id);
    const map: Record<string, Record<string, boolean>> = {
      all: { RIDE: true, DELIVERY: true, FOOD: true },
      ride_only: { RIDE: true, DELIVERY: false, FOOD: false },
      delivery_only: { RIDE: false, DELIVERY: true, FOOD: true },
      parcel_only: { RIDE: false, DELIVERY: true, FOOD: false },
      food_only: { RIDE: false, DELIVERY: false, FOOD: true },
    };
    const m = map[id];
    if (!m) return;
    setPrefs({
      RIDE: { enabled: m.RIDE },
      DELIVERY: { enabled: m.DELIVERY },
      FOOD: { enabled: m.FOOD },
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading work mode…
        </CardContent>
      </Card>
    );
  }

  const rows: { key: ServiceKey; label: string }[] = [
    { key: "RIDE", label: "Rides" },
    { key: "DELIVERY", label: "Parcels" },
    { key: "FOOD", label: "Food & Restaurants" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Work mode (dispatch)</CardTitle>
        <CardDescription>
          Controls which offers this rider receives. Vehicle platform limits still apply.
          Active now:{" "}
          {rows
            .filter((r) => effective[r.key])
            .map((r) => r.label)
            .join(", ") || "None"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                preset === p.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="space-y-2 border rounded-lg p-3">
          {rows.map((row) => {
            const allowed = supported.includes(row.key);
            const enabled = prefs[row.key]?.enabled !== false;
            return (
              <label
                key={row.key}
                className={`flex items-center justify-between gap-2 ${!allowed ? "opacity-50" : ""}`}
              >
                <span className="text-sm">
                  {row.label}
                  {!allowed && (
                    <span className="text-xs text-amber-700 ml-1">(not allowed for vehicle)</span>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={enabled && allowed}
                  disabled={!allowed}
                  onChange={(e) => {
                    setPreset("custom");
                    setPrefs((p) => ({
                      ...p,
                      [row.key]: { ...p[row.key], enabled: e.target.checked },
                    }));
                  }}
                />
              </label>
            );
          })}
        </div>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? (
            "Saving…"
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" /> Save work mode
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
