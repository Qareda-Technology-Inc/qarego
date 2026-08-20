"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import ServiceZoneMapPicker, { type ZoneCenter } from "@/components/ServiceZoneMapPicker";
import { MapPinned, Pencil, Plus, Power, Trash2 } from "lucide-react";

type ServiceType = "RIDE" | "PARCEL" | "FOOD" | "GROCERY" | "PHARMACY";

interface ServiceZone {
  _id: string;
  name: string;
  center: { latitude: number; longitude: number };
  radiusKm: number;
  address?: string | null;
  isActive: boolean;
  serviceTypes: ServiceType[];
  notes?: string | null;
  createdAt?: string;
}

const ALL_SERVICES: { key: ServiceType; label: string }[] = [
  { key: "RIDE", label: "Ride" },
  { key: "PARCEL", label: "Parcel" },
  { key: "FOOD", label: "Food" },
  { key: "GROCERY", label: "Grocery" },
  { key: "PHARMACY", label: "Pharmacy" },
];

const EMPTY_FORM = {
  name: "",
  address: "",
  radiusKm: "10",
  isActive: true,
  serviceTypes: ALL_SERVICES.map((s) => s.key) as ServiceType[],
  notes: "",
  center: null as ZoneCenter | null,
};

export default function ServiceZonesPage() {
  const [zones, setZones] = useState<ServiceZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceZone | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetcher("/admin/service-zones");
      setZones(data.zones || []);
    } catch (e) {
      console.error(e);
      alert("Failed to load service zones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (zone: ServiceZone) => {
    setEditing(zone);
    setForm({
      name: zone.name,
      address: zone.address || "",
      radiusKm: String(zone.radiusKm ?? 10),
      isActive: zone.isActive !== false,
      serviceTypes:
        zone.serviceTypes?.length > 0
          ? ([...zone.serviceTypes] as ServiceType[])
          : ALL_SERVICES.map((s) => s.key),
      notes: zone.notes || "",
      center: {
        lat: zone.center.latitude,
        lng: zone.center.longitude,
        address: zone.address || undefined,
      },
    });
    setModalOpen(true);
  };

  const toggleService = (key: ServiceType) => {
    setForm((prev) => {
      const has = prev.serviceTypes.includes(key);
      const next = has
        ? prev.serviceTypes.filter((s) => s !== key)
        : [...prev.serviceTypes, key];
      return { ...prev, serviceTypes: next };
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("Zone name is required");
      return;
    }
    if (!form.center) {
      alert("Set a center point on the map");
      return;
    }
    if (!form.serviceTypes.length) {
      alert("Select at least one service type");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        radiusKm: parseFloat(form.radiusKm) || 10,
        isActive: form.isActive,
        serviceTypes: form.serviceTypes,
        notes: form.notes.trim() || null,
        center: {
          latitude: form.center.lat,
          longitude: form.center.lng,
        },
      };

      if (editing) {
        await fetcher(`/admin/service-zones/${editing._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await fetcher("/admin/service-zones", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save zone");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (zone: ServiceZone) => {
    if (!confirm(`Deactivate "${zone.name}"? Customers outside other zones will lose access.`)) {
      return;
    }
    try {
      await fetcher(`/admin/service-zones/${zone._id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  const reactivate = async (zone: ServiceZone) => {
    try {
      await fetcher(`/admin/service-zones/${zone._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reactivate");
    }
  };

  const activeCount = zones.filter((z) => z.isActive).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service areas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define hubs with a coverage radius. Customers outside all active zones cannot order.
            {activeCount === 0 ? (
              <span className="block mt-1 text-amber-700">
                No active zones — app is in open mode (available everywhere).
              </span>
            ) : null}
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> New zone
        </Button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : zones.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <MapPinned className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-700">No service zones yet</p>
            <p className="text-sm mt-1 mb-4">
              Create your first hub (e.g. Kenyasi) with a radius so only nearby customers can book.
            </p>
            <Button type="button" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> Create zone
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {zones.map((zone) => (
            <Card key={zone._id} className={!zone.isActive ? "opacity-70" : undefined}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {zone.name}
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          zone.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {zone.isActive ? "Active" : "Inactive"}
                      </span>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {zone.address ||
                        `${zone.center.latitude.toFixed(4)}, ${zone.center.longitude.toFixed(4)}`}
                      {" · "}
                      {zone.radiusKm} km radius
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(zone)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {zone.isActive ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => deactivate(zone)}
                        title="Deactivate"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => reactivate(zone)}
                        title="Reactivate"
                      >
                        <Power className="w-3.5 h-3.5 text-green-700" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {(zone.serviceTypes?.length ? zone.serviceTypes : ALL_SERVICES.map((s) => s.key)).map(
                    (s) => (
                      <span
                        key={s}
                        className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-100"
                      >
                        {s}
                      </span>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit service zone" : "New service zone"}
        size="lg"
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zoneName">Zone name</Label>
              <Input
                id="zoneName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kenyasi Hub"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="radiusKm">Coverage radius (km)</Label>
              <Input
                id="radiusKm"
                type="number"
                step="0.1"
                min="0.1"
                max="500"
                value={form.radiusKm}
                onChange={(e) => setForm((f) => ({ ...f, radiusKm: e.target.value }))}
                required
              />
            </div>
          </div>

          <ServiceZoneMapPicker
            value={form.center}
            address={form.address}
            radiusKm={parseFloat(form.radiusKm) || 10}
            onLocationChange={(loc) =>
              setForm((f) => ({
                ...f,
                center: loc,
                address: loc?.address ?? f.address,
              }))
            }
            onAddressChange={(address) => setForm((f) => ({ ...f, address }))}
          />

          <div className="space-y-2">
            <Label>Services in this zone</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_SERVICES.map((s) => {
                const on = form.serviceTypes.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleService(s.key)}
                    className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                      on
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500">
              Untoggle a service to hide it for customers inside this zone only.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Active (customers can use this zone)
          </label>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Internal note"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create zone"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
