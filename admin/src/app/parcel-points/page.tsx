"use client";

import { useEffect, useMemo, useState } from "react";
import { fetcher } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import StoreLocationPicker, { type StoreLocation } from "@/components/StoreLocationPicker";
import { MapPin, Package, Pencil, Plus, Power, Trash2 } from "lucide-react";

type Kind = "BUS_STATION" | "MALL" | "SHOP" | "OFFICE" | "OTHER";

interface ParcelPoint {
  _id: string;
  name: string;
  kind: Kind;
  address?: string | null;
  latitude: number;
  longitude: number;
  instructions?: string | null;
  phone?: string | null;
  hours?: string | null;
  canPickup: boolean;
  canDrop: boolean;
  isActive: boolean;
}

const KINDS: { key: Kind; label: string }[] = [
  { key: "BUS_STATION", label: "Bus station" },
  { key: "MALL", label: "Mall" },
  { key: "SHOP", label: "Shop" },
  { key: "OFFICE", label: "Office" },
  { key: "OTHER", label: "Other" },
];
const kindLabel = (k: Kind) => KINDS.find((x) => x.key === k)?.label ?? "Other";

const usageText = (p: ParcelPoint) =>
  p.canPickup && p.canDrop ? "Pickup & drop-off" : p.canPickup ? "Pickup only" : "Drop-off only";

const EMPTY_FORM = {
  name: "",
  kind: "BUS_STATION" as Kind,
  address: "",
  location: null as StoreLocation | null,
  instructions: "",
  phone: "",
  hours: "",
  canPickup: true,
  canDrop: true,
  isActive: true,
};

/** Places customers can pick for a parcel pickup or drop-off instead of searching an address. */
export default function ParcelPointsPage() {
  const [points, setPoints] = useState<ParcelPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ParcelPoint | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<Kind | "ALL">("ALL");

  const load = () =>
    fetcher("/admin/parcel-points")
      .then((data) => setPoints(data.points || []))
      .catch((e) => alert(e instanceof Error ? e.message : "Failed to load parcel points"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (p: ParcelPoint) => {
    setEditing(p);
    setForm({
      name: p.name,
      kind: p.kind,
      address: p.address || "",
      location: { lat: p.latitude, lng: p.longitude, address: p.address || undefined },
      instructions: p.instructions || "",
      phone: p.phone || "",
      hours: p.hours || "",
      canPickup: p.canPickup !== false,
      canDrop: p.canDrop !== false,
      isActive: p.isActive !== false,
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return alert("Give the point a name.");
    if (!form.location) return alert("Put the point on the map.");
    if (!form.canPickup && !form.canDrop) return alert("Allow at least pickup or drop-off.");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        kind: form.kind,
        address: form.address.trim() || null,
        latitude: form.location.lat,
        longitude: form.location.lng,
        instructions: form.instructions.trim() || null,
        phone: form.phone.trim() || null,
        hours: form.hours.trim() || null,
        canPickup: form.canPickup,
        canDrop: form.canDrop,
        isActive: form.isActive,
      };
      await fetcher(editing ? `/admin/parcel-points/${editing._id}` : "/admin/parcel-points", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (p: ParcelPoint, isActive: boolean) => {
    try {
      await fetcher(`/admin/parcel-points/${p._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const remove = async (p: ParcelPoint) => {
    if (!confirm(`Delete "${p.name}"? Customers will no longer see it. To hide it for a while, turn it off instead.`)) return;
    try {
      await fetcher(`/admin/parcel-points/${p._id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return points.filter(
      (p) =>
        (kindFilter === "ALL" || p.kind === kindFilter) &&
        (!q || `${p.name} ${p.address ?? ""} ${p.instructions ?? ""}`.toLowerCase().includes(q))
    );
  }, [points, query, kindFilter]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parcel points</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bus stations, malls and shops customers can pick from a list when sending or receiving a
            parcel. Nearest ones are shown first; customers can still search any address.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> New point
        </Button>
      </div>

      {points.length > 0 ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search points"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-2">
            {[{ key: "ALL" as const, label: "All" }, ...KINDS].map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => setKindFilter(k.key)}
                className={`text-sm px-3 py-1.5 rounded-md border ${
                  kindFilter === k.key
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : points.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-700">No parcel points yet</p>
            <p className="text-sm mt-1 mb-4">
              Add places like Circle VIP station or Accra Mall so customers can pick them quickly.
            </p>
            <Button type="button" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> Add the first point
            </Button>
          </CardContent>
        </Card>
      ) : shown.length === 0 ? (
        <p className="text-sm text-gray-500">No points match.</p>
      ) : (
        <div className="grid gap-3">
          {shown.map((p) => (
            <Card key={p._id} className={!p.isActive ? "opacity-60" : undefined}>
              <CardContent className="py-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-100">
                      {kindLabel(p.kind)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                      {usageText(p)}
                    </span>
                    {!p.isActive ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Off</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {p.address || `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}
                    </span>
                  </p>
                  {p.instructions || p.hours || p.phone ? (
                    <p className="text-xs text-gray-500 mt-1">
                      {[p.instructions, p.hours, p.phone].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(p)} title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActive(p, !p.isActive)}
                    title={p.isActive ? "Turn off" : "Turn on"}
                  >
                    <Power className={`w-3.5 h-3.5 ${p.isActive ? "text-amber-600" : "text-green-700"}`} />
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => remove(p)} title="Delete">
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit parcel point" : "New parcel point"}
        size="lg"
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ppName">Name</Label>
              <Input
                id="ppName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Circle VIP Station"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, kind: k.key }))}
                    className={`text-sm px-3 py-1.5 rounded-md border ${
                      form.kind === k.key
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <StoreLocationPicker
            value={form.location}
            address={form.address}
            onLocationChange={(loc) =>
              setForm((f) => ({ ...f, location: loc, address: loc?.address ?? f.address }))
            }
            onAddressChange={(address) => setForm((f) => ({ ...f, address }))}
          />

          <div className="space-y-2">
            <Label htmlFor="ppInstructions">Where to meet (shown to the rider and customer)</Label>
            <Input
              id="ppInstructions"
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              placeholder="e.g. VIP ticket office, gate 2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ppHours">Opening hours (optional)</Label>
              <Input
                id="ppHours"
                value={form.hours}
                onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
                placeholder="e.g. Mon–Sat 6am–9pm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ppPhone">Phone (optional, admin only)</Label>
              <Input
                id="ppPhone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. 030 000 0000"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-5 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.canPickup}
                onChange={(e) => setForm((f) => ({ ...f, canPickup: e.target.checked }))}
                className="rounded border-gray-300"
              />
              Can be a pickup
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.canDrop}
                onChange={(e) => setForm((f) => ({ ...f, canDrop: e.target.checked }))}
                className="rounded border-gray-300"
              />
              Can be a drop-off
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-gray-300"
              />
              On (customers see it)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add point"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
