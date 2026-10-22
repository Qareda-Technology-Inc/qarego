"use client";

import { useState } from "react";
import { BadgePercent, Loader2 } from "lucide-react";
import { fetcher } from "@/lib/api";
import { freeDaysLeft, formatFreeUntil, isCommissionFree } from "@/lib/freePeriod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const DAY_MS = 86_400_000;
const QUICK_DAYS = [30, 60, 90];

/**
 * Admin control for a store's commission-free period: give or extend it, pick an end date, or
 * end it now. Orders placed while it runs carry no store commission.
 */
export default function CommissionFreeCard({
  restaurantId,
  until,
  onSaved,
}: {
  restaurantId: string;
  until?: string | null;
  onSaved: (until: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState("");
  // Fixed when the card opens, so rendering stays pure.
  const [openedAt] = useState(() => Date.now());
  const active = isCommissionFree(until, openedAt);
  const daysLeft = freeDaysLeft(until, openedAt);

  const save = async (next: Date | null, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const data = await fetcher(`/admin/restaurants/${restaurantId}`, {
        method: "PATCH",
        body: JSON.stringify({ commissionFreeUntil: next ? next.toISOString() : null }),
      });
      onSaved(data.restaurant?.commissionFreeUntil ?? null);
      setDate("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't save the free period");
    } finally {
      setBusy(false);
    }
  };

  // Adding days extends a running period, or starts a new one from today.
  const addDays = (days: number) => {
    const from = active ? new Date(until as string).getTime() : new Date().getTime();
    save(new Date(from + days * DAY_MS));
  };

  const setEndDate = () => {
    if (!date) return;
    // End of the chosen day, local time.
    const end = new Date(`${date}T23:59:59`);
    if (end.getTime() <= new Date().getTime()) {
      alert("Pick a date after today");
      return;
    }
    save(end);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgePercent className="h-5 w-5 text-emerald-600" /> Commission-free period
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {active ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            No commission on this store&apos;s orders until <strong>{formatFreeUntil(until as string)}</strong> (
            {daysLeft} day{daysLeft === 1 ? "" : "s"} left). After that, the normal commission applies automatically.
          </p>
        ) : (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
            The normal commission applies to this store&apos;s orders.
            {until ? ` Its free period ended ${formatFreeUntil(until)}.` : ""}
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-800">{active ? "Extend it" : "Give a free period"}</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_DAYS.map((d) => (
              <Button key={d} type="button" variant="outline" size="sm" disabled={busy} onClick={() => addDays(d)}>
                +{d} days
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-gray-600">
            Or free until
            <Input
              type="date"
              value={date}
              min={new Date(openedAt + DAY_MS).toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-44"
            />
          </label>
          <Button type="button" size="sm" disabled={busy || !date} onClick={setEndDate}>
            Set date
          </Button>
        </div>

        {active ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              save(null, "End the free period now? Orders from now on will pay the normal commission.")
            }
            className="text-red-700"
          >
            End free period now
          </Button>
        ) : null}
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : null}

        <p className="text-xs text-gray-500">
          Only orders placed during the period are free. Orders already placed keep the commission they were placed with.
        </p>
      </CardContent>
    </Card>
  );
}
