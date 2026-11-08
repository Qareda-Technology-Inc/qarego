"use client";

import { useState } from "react";
import StoreLocationPicker, { type StoreLocation } from "@/components/StoreLocationPicker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";

export type FillingStation = {
  id?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  active: boolean;
};

type Draft = { index: number | null; name: string; address: string; location: StoreLocation | null };

const EMPTY: Draft = { index: null, name: "", address: "", location: null };

/**
 * LPG filling stations QareGO knows. Not partners: riders on a QareGO refill are sent to the
 * nearest one and can switch to another nearby. Saved with the rest of the gas settings.
 */
export function FillingStationsEditor({
  stations,
  onChange,
}: {
  stations: FillingStation[];
  onChange: (next: FillingStation[]) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");

  const commit = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return alert("Give the station a name.");
    if (!draft.location) return alert("Put the station on the map.");
    const row: FillingStation = {
      id: draft.index != null ? stations[draft.index].id : undefined,
      name,
      address: draft.address.trim(),
      latitude: draft.location.lat,
      longitude: draft.location.lng,
      active: draft.index != null ? stations[draft.index].active : true,
    };
    onChange(draft.index != null ? stations.map((s, i) => (i === draft.index ? row : s)) : [...stations, row]);
    setDraft(null);
  };

  const q = query.trim().toLowerCase();
  const shown = stations
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !q || `${s.name} ${s.address}`.toLowerCase().includes(q));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-900">LPG filling stations</p>
        <p className="text-xs text-gray-500">
          Where riders fill QareGO refills. The rider is sent to the station nearest the customer
          and can switch to another nearby. Only add stations that sell LPG. Save gas settings
          after changing the list.
        </p>
      </div>

      {stations.length > 5 ? (
        <Input placeholder="Search stations" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
      ) : null}

      {stations.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-gray-500">
          No stations yet. Until you add some, riders choose a filling place themselves.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {shown.map(({ s, i }) => (
            <li key={s.id || `new-${i}`} className="flex items-center gap-3 p-3 text-sm">
              <MapPin className={`h-4 w-4 shrink-0 ${s.active ? "text-orange-600" : "text-gray-300"}`} />
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${s.active ? "text-gray-900" : "text-gray-400"}`}>{s.name}</p>
                {s.address ? <p className="truncate text-xs text-gray-500">{s.address}</p> : null}
              </div>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={s.active}
                  onChange={(e) => onChange(stations.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)))}
                />
                In use
              </label>
              <Button
                type="button"
                variant="outline"
                aria-label={`Edit ${s.name}`}
                onClick={() =>
                  setDraft({ index: i, name: s.name, address: s.address, location: { lat: s.latitude, lng: s.longitude } })
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-label={`Remove ${s.name}`}
                onClick={() => confirm(`Remove ${s.name}?`) && onChange(stations.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <div className="space-y-3 rounded-md border bg-gray-50 p-3">
          <div className="max-w-sm">
            <Label htmlFor="fs-name">Station name</Label>
            <Input
              id="fs-name"
              value={draft.name}
              placeholder="e.g. Goil LPG, Madina"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <StoreLocationPicker
            value={draft.location}
            address={draft.address}
            onLocationChange={(loc) => setDraft((d) => (d ? { ...d, location: loc } : d))}
            onAddressChange={(address) => setDraft((d) => (d ? { ...d, address } : d))}
            mapHeight={220}
          />
          <div className="flex gap-2">
            <Button type="button" onClick={commit}>
              {draft.index != null ? "Update station" : "Add to list"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => setDraft(EMPTY)}>
          <Plus className="mr-1 h-4 w-4" /> Add filling station
        </Button>
      )}
    </div>
  );
}
