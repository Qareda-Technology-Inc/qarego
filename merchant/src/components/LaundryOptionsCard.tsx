"use client";

import { useState } from "react";
import { Loader2, Save, Timer } from "lucide-react";
import { fetcher } from "@/lib/api";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { DEFAULT_LAUNDRY_OPTIONS, type LaundryOptions } from "@/lib/laundryOptions";

const toDays = (hours: number) => (hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? "" : "s"}` : `${hours} hours`);

/** Laundry turnaround and the optional Express service (faster, for a fee the shop keeps). */
export function LaundryOptionsCard({ initial, onSaved }: { initial?: Partial<LaundryOptions> | null; onSaved: () => void }) {
  const start = { ...DEFAULT_LAUNDRY_OPTIONS, ...(initial ?? {}) };
  const [standardHours, setStandardHours] = useState(String(start.standardHours));
  const [expressEnabled, setExpressEnabled] = useState(start.expressEnabled);
  const [expressFee, setExpressFee] = useState(String(start.expressFee || ""));
  const [expressHours, setExpressHours] = useState(String(start.expressHours));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetcher("/merchant/restaurant", {
        method: "PATCH",
        body: JSON.stringify({
          laundryOptions: {
            standardHours: Number(standardHours),
            expressEnabled,
            expressFee: Number(expressFee) || 0,
            expressHours: Number(expressHours),
          },
        }),
      });
      notify.success("Turnaround saved");
      onSaved();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="laundry-options" className="bg-white rounded-2xl border border-border p-5 mb-6 scroll-mt-4 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Timer className="h-4 w-4 text-brand" />
          <p className="font-medium text-foreground">Turnaround and Express</p>
        </div>
        <p className="text-sm text-muted">
          Customers see when their laundry will be back. Express is optional: a faster turnaround for an extra fee,
          which you keep (commission applies like the rest of the order).
        </p>
      </div>
      <div className="max-w-xs">
        <Label htmlFor="stdHours">Normal turnaround (hours)</Label>
        <Input id="stdHours" type="number" min="1" value={standardHours} onChange={(e) => setStandardHours(e.target.value)} />
        <p className="mt-1 text-xs text-muted">{Number(standardHours) > 0 ? `Back in ${toDays(Number(standardHours))}` : ""}</p>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={expressEnabled} onChange={(e) => setExpressEnabled(e.target.checked)} />
        Offer Express
      </label>
      {expressEnabled ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          <div>
            <Label htmlFor="exFee">Express fee per order (GH₵)</Label>
            <Input id="exFee" type="number" min="0" step="0.5" value={expressFee} onChange={(e) => setExpressFee(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="exHours">Express turnaround (hours)</Label>
            <Input id="exHours" type="number" min="1" value={expressHours} onChange={(e) => setExpressHours(e.target.value)} />
          </div>
        </div>
      ) : null}
      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <>
            <Save className="h-4 w-4 mr-1 inline" /> Save
          </>
        )}
      </Button>
    </div>
  );
}
