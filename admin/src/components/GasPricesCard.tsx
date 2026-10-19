"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { CURRENCY_SYMBOL } from "@/lib/currency";
import { Flame, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useFeatures } from "@/lib/features";

type Cylinder = {
  sizeKg: string;
  label: string;
  refillPrice: string;
  exchangePrice: string;
  active: boolean;
};

type GasConfig = {
  enabled: boolean;
  momoEnabled: boolean;
  stationCommissionRate: number;
  delivery?: { baseFare: number; perKmRate: number; minimumFare: number };
  cylinders: { sizeKg: number; label: string; refillPrice: number; exchangePrice: number; active: boolean }[];
};

/** Cooking gas: cylinder sizes and prices are set here for every station. */
export function GasPricesCard() {
  // Hidden while mobile money is paused platform-wide; the saved choice is kept.
  const { momoEnabled: platformMomo } = useFeatures();
  const [rows, setRows] = useState<Cylinder[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [momoEnabled, setMomoEnabled] = useState(false);
  const [commissionPct, setCommissionPct] = useState("5");
  const [delivery, setDelivery] = useState({ baseFare: "10", perKmRate: "3", minimumFare: "15" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetcher("/admin/settings")
      .then((data) => {
        const gas: GasConfig | undefined = data.gas;
        if (!gas) return;
        setEnabled(gas.enabled !== false);
        setMomoEnabled(gas.momoEnabled === true);
        setCommissionPct(String(Math.round((gas.stationCommissionRate ?? 0.05) * 1000) / 10));
        if (gas.delivery) {
          setDelivery({
            baseFare: String(gas.delivery.baseFare),
            perKmRate: String(gas.delivery.perKmRate),
            minimumFare: String(gas.delivery.minimumFare),
          });
        }
        setRows(
          gas.cylinders.map((c) => ({
            sizeKg: String(c.sizeKg),
            label: c.label,
            refillPrice: String(c.refillPrice),
            exchangePrice: String(c.exchangePrice),
            active: c.active !== false,
          }))
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const update = (i: number, patch: Partial<Cylinder>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    try {
      await fetcher("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          gas: {
            enabled,
            momoEnabled,
            stationCommissionRate: Number(commissionPct) / 100,
            delivery: {
              baseFare: Number(delivery.baseFare),
              perKmRate: Number(delivery.perKmRate),
              minimumFare: Number(delivery.minimumFare),
            },
            cylinders: rows.map((r) => ({
              sizeKg: Number(r.sizeKg),
              label: r.label.trim() || `${r.sizeKg} kg`,
              refillPrice: Number(r.refillPrice),
              exchangePrice: Number(r.exchangePrice),
              active: r.active,
            })),
          },
        }),
      });
      alert("Gas prices saved.");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save gas prices.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          Cooking gas
        </CardTitle>
        <CardDescription>
          Cylinder sizes and prices for every gas station. Refill = the customer&apos;s own cylinder
          is filled; exchange = they get a full cylinder for their empty one. The gas delivery fee
          below is added on top.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : (
          <>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Gas delivery on
              </label>
              {platformMomo ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={momoEnabled}
                    onChange={(e) => setMomoEnabled(e.target.checked)}
                  />
                  Allow MoMo payment (cash is always allowed)
                </label>
              ) : null}
            </div>
            <div className="max-w-xs">
              <Label htmlFor="gas-commission">Station commission (%)</Label>
              <Input
                id="gas-commission"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">QareGO&apos;s share of the gas price.</p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900">Gas delivery fee</p>
              <p className="mb-2 text-xs text-gray-500">
                Charged once per order for the courier&apos;s round trip: base + (km there and back × rate),
                never below the minimum.
              </p>
              <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                {(
                  [
                    ["baseFare", "Base fare"],
                    ["perKmRate", "Per km"],
                    ["minimumFare", "Minimum"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <Label htmlFor={`gas-del-${key}`}>
                      {label} ({CURRENCY_SYMBOL})
                    </Label>
                    <Input
                      id={`gas-del-${key}`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={delivery[key]}
                      onChange={(e) => setDelivery((d) => ({ ...d, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-3 font-medium">Size (kg)</th>
                    <th className="py-2 pr-3 font-medium">Label</th>
                    <th className="py-2 pr-3 font-medium">Refill ({CURRENCY_SYMBOL})</th>
                    <th className="py-2 pr-3 font-medium">Exchange ({CURRENCY_SYMBOL})</th>
                    <th className="py-2 pr-3 font-medium">On sale</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={r.sizeKg}
                          onChange={(e) => update(i, { sizeKg: e.target.value })}
                          aria-label="Size in kg"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input value={r.label} onChange={(e) => update(i, { label: e.target.value })} aria-label="Label" />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={r.refillPrice}
                          onChange={(e) => update(i, { refillPrice: e.target.value })}
                          aria-label="Refill price"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={r.exchangePrice}
                          onChange={(e) => update(i, { exchangePrice: e.target.value })}
                          aria-label="Exchange price"
                        />
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <input
                          type="checkbox"
                          checked={r.active}
                          onChange={(e) => update(i, { active: e.target.checked })}
                          aria-label="On sale"
                        />
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                          aria-label="Remove size"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setRows((prev) => [
                    ...prev,
                    { sizeKg: "", label: "", refillPrice: "", exchangePrice: "", active: true },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add size
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? "Saving…" : <><Save className="mr-2 h-4 w-4" /> Save gas prices</>}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
