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
import { FillingStationsEditor, type FillingStation } from "@/components/FillingStationsEditor";

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
  delivery?: { flatFee: number };
  amountRefill?: { enabled: boolean; minAmount: number };
  houseStoreId?: string | null;
  fillingStations?: FillingStation[];
  cylinders: { sizeKg: number; label: string; refillPrice: number; exchangePrice: number; active: boolean }[];
};

type GasStore = { _id: string; name: string; address?: string; vertical?: string; isActive?: boolean };

/** Cooking gas: cylinder sizes and prices, the delivery fee, and QareGO's own gas store. */
export function GasPricesCard() {
  // Hidden while mobile money is paused platform-wide; the saved choice is kept.
  const { momoEnabled: platformMomo } = useFeatures();
  const [rows, setRows] = useState<Cylinder[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [momoEnabled, setMomoEnabled] = useState(false);
  const [commissionPct, setCommissionPct] = useState("5");
  const [flatFee, setFlatFee] = useState("20");
  const [houseStoreId, setHouseStoreId] = useState("");
  const [gasStores, setGasStores] = useState<GasStore[]>([]);
  const [fillingStations, setFillingStations] = useState<FillingStation[]>([]);
  const [amountEnabled, setAmountEnabled] = useState(true);
  const [minAmount, setMinAmount] = useState("20");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetcher("/admin/restaurants")
      .then((data: { restaurants?: GasStore[] }) =>
        setGasStores((data.restaurants || []).filter((r) => r.vertical === "GAS"))
      )
      .catch(console.error);
    fetcher("/admin/settings")
      .then((data) => {
        const gas: GasConfig | undefined = data.gas;
        if (!gas) return;
        setEnabled(gas.enabled !== false);
        setMomoEnabled(gas.momoEnabled === true);
        setCommissionPct(String(Math.round((gas.stationCommissionRate ?? 0.05) * 1000) / 10));
        if (gas.amountRefill) {
          setAmountEnabled(gas.amountRefill.enabled !== false);
          setMinAmount(String(gas.amountRefill.minAmount));
        }
        if (gas.delivery) setFlatFee(String(gas.delivery.flatFee));
        setHouseStoreId(gas.houseStoreId || "");
        setFillingStations(
          (gas.fillingStations || []).map((f) => ({ ...f, address: f.address || "", active: f.active !== false }))
        );
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
      const saved: { gas?: GasConfig } = await fetcher("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          gas: {
            enabled,
            momoEnabled,
            stationCommissionRate: Number(commissionPct) / 100,
            delivery: { flatFee: Number(flatFee) },
            houseStoreId: houseStoreId || null,
            fillingStations,
            amountRefill: { enabled: amountEnabled, minAmount: Number(minAmount) },
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
      // New stations get their ids on the server: keep them so the next save doesn't renumber.
      if (saved?.gas?.fillingStations) {
        setFillingStations(saved.gas.fillingStations.map((f) => ({ ...f, address: f.address || "" })));
      }
      alert("Gas settings saved.");
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
          Refill gas
        </CardTitle>
        <CardDescription>
          Cylinder sizes and prices for every gas order. Refill = the customer&apos;s own cylinder
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
            <div className="max-w-xl space-y-1">
              <Label htmlFor="gas-house-store">QareGO&apos;s gas store</Label>
              <select
                id="gas-house-store"
                value={houseStoreId}
                onChange={(e) => setHouseStoreId(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="">None: send orders to the nearest partner station</option>
                {gasStores.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                    {s.address ? ` · ${s.address}` : ""}
                    {s.isActive === false ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                {houseStoreId ? (
                  <>
                    Every gas order goes to this store and is accepted automatically, wherever the
                    customer is. For a refill the rider collects the empty and the gas money (cash),
                    fills it at the nearest filling place, and brings it back. For an exchange the
                    rider picks up a full cylinder at this store&apos;s address. Its opening hours and
                    pause switch turn gas orders on and off.
                  </>
                ) : (
                  <>
                    Create a gas store for QareGO in Stores (its address is where riders pick up
                    full cylinders for exchanges), then choose it here.
                  </>
                )}
              </p>
            </div>
            {houseStoreId ? (
              <FillingStationsEditor stations={fillingStations} onChange={setFillingStations} />
            ) : null}
            <div className="max-w-xs">
              <Label htmlFor="gas-commission">Partner station commission (%)</Label>
              <Input
                id="gas-commission"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                QareGO&apos;s share of a partner station&apos;s gas price. Not charged on QareGO&apos;s own store.
              </p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={amountEnabled}
                  onChange={(e) => setAmountEnabled(e.target.checked)}
                />
                Let customers buy gas by amount (e.g. {CURRENCY_SYMBOL}50 worth instead of a full refill)
              </label>
              {amountEnabled ? (
                <div className="max-w-xs">
                  <Label htmlFor="gas-min-amount">Smallest amount ({CURRENCY_SYMBOL})</Label>
                  <Input
                    id="gas-min-amount"
                    type="number"
                    min={0}
                    step={1}
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Refills only. The most a customer can buy is that size&apos;s full refill price.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="max-w-xs">
              <Label htmlFor="gas-flat-fee">Gas delivery fee ({CURRENCY_SYMBOL})</Label>
              <Input
                id="gas-flat-fee"
                type="number"
                min={0}
                step={0.5}
                value={flatFee}
                onChange={(e) => setFlatFee(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                One fee per order for the rider&apos;s whole trip, whatever the distance.
              </p>
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
