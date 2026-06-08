"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import StoreCreateForm from "@/components/StoreCreateForm";
import { type StoreLocation } from "@/components/StoreLocationPicker";
import type { StoreFormValues, StoreTypeOption } from "@/lib/storeForm";
import {
  EMPTY_STORE_FORM,
  buildStoreCreatePayload,
  resolveFormVertical,
} from "@/lib/storeForm";
import { Plus, Store, UserCircle, UserPlus, Settings2, MapPin, Pencil, Trash2 } from "lucide-react";

interface Vendor {
  _id: string;
  name?: string;
  username?: string;
  phone?: string;
  storeCount?: number;
}

interface OwnerRef {
  _id: string;
  name?: string;
  username?: string;
}

interface Restaurant {
  _id: string;
  name: string;
  category?: string;
  cuisine: string;
  imageEmoji: string;
  deliveryFee: number;
  minOrderAmount: number;
  isActive: boolean;
  isAcceptingOrders: boolean;
  address: string;
  owner?: OwnerRef | null;
  menuItemCount?: number;
}

const EMPTY_VENDOR = { username: "", password: "", name: "", phone: "" };

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  const [vendorModal, setVendorModal] = useState(false);
  const [vendorForm, setVendorForm] = useState({ ...EMPTY_VENDOR });
  const [editVendorModal, setEditVendorModal] = useState(false);
  const [editVendorId, setEditVendorId] = useState("");
  const [editVendorForm, setEditVendorForm] = useState({ username: "", password: "", name: "", phone: "" });
  const [deleteVendorModal, setDeleteVendorModal] = useState(false);
  const [deleteVendorTarget, setDeleteVendorTarget] = useState<Vendor | null>(null);
  const [deleteStoreModal, setDeleteStoreModal] = useState(false);
  const [deleteStoreTarget, setDeleteStoreTarget] = useState<Restaurant | null>(null);

  const [storeModal, setStoreModal] = useState(false);
  const [storeForm, setStoreForm] = useState<StoreFormValues>({ ...EMPTY_STORE_FORM });
  const [storeVendorId, setStoreVendorId] = useState<string>("");
  const [location, setLocation] = useState<StoreLocation | null>(null);
  const [storeTypes, setStoreTypes] = useState<StoreTypeOption[]>([]);

  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [vendorData, restaurantData] = await Promise.all([
        fetcher("/admin/vendors"),
        fetcher("/admin/restaurants"),
      ]);
      setVendors(vendorData.vendors || []);
      setRestaurants(restaurantData.restaurants || []);
    } catch (e) {
      console.error("Failed to load vendors", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetcher("/admin/store-types")
      .then((data) => setStoreTypes(data.storeTypes || []))
      .catch(() => setStoreTypes([]));
  }, []);

  const storesFor = (vendorId: string) =>
    restaurants.filter((r) => r.owner?._id === vendorId);
  const unassigned = restaurants.filter((r) => !r.owner);

  const createVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetcher("/admin/vendors", {
        method: "POST",
        body: JSON.stringify(vendorForm),
      });
      setVendorModal(false);
      setVendorForm({ ...EMPTY_VENDOR });
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create vendor");
    } finally {
      setSaving(false);
    }
  };

  const openEditVendor = (vendor: Vendor) => {
    setEditVendorId(vendor._id);
    setEditVendorForm({
      username: vendor.username || "",
      password: "",
      name: vendor.name || "",
      phone: vendor.phone || "",
    });
    setEditVendorModal(true);
  };

  const updateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVendorId) return;
    setSaving(true);
    try {
      await fetcher(`/admin/vendors/${editVendorId}`, {
        method: "PATCH",
        body: JSON.stringify({
          username: editVendorForm.username,
          password: editVendorForm.password || undefined,
          name: editVendorForm.name,
          phone: editVendorForm.phone,
        }),
      });
      setEditVendorModal(false);
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update vendor");
    } finally {
      setSaving(false);
    }
  };

  const deleteVendor = async () => {
    if (!deleteVendorTarget) return;
    try {
      await fetcher(`/admin/vendors/${deleteVendorTarget._id}`, { method: "DELETE" });
      setDeleteVendorModal(false);
      setDeleteVendorTarget(null);
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete vendor");
    }
  };

  const deleteStore = async () => {
    if (!deleteStoreTarget) return;
    try {
      await fetcher(`/admin/restaurants/${deleteStoreTarget._id}`, { method: "DELETE" });
      setDeleteStoreModal(false);
      setDeleteStoreTarget(null);
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete store");
    }
  };

  const openAddStore = (vendorId: string) => {
    setStoreVendorId(vendorId);
    setStoreForm({ ...EMPTY_STORE_FORM });
    setLocation(null);
    setStoreModal(true);
  };

  const createStore = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedVertical = resolveFormVertical(storeForm, storeTypes);
    if (!storeForm.storeTypeIds.length) {
      alert("Select at least one category tag for this store");
      return;
    }
    if (!location) {
      alert("Search for an address or tap the map to set the store location");
      return;
    }
    if (!storeForm.address.trim()) {
      alert("Enter or select a store address");
      return;
    }
    setSaving(true);
    try {
      await fetcher("/admin/restaurants", {
        method: "POST",
        body: JSON.stringify({
          ...buildStoreCreatePayload(storeForm, location, selectedVertical),
          ownerId: storeVendorId,
        }),
      });
      setStoreModal(false);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create store");
    } finally {
      setSaving(false);
    }
  };

  const assignStore = async (restaurantId: string, vendorId: string) => {
    if (!vendorId) return;
    try {
      await fetcher(`/admin/restaurants/${restaurantId}`, {
        method: "PATCH",
        body: JSON.stringify({ ownerId: vendorId }),
      });
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to assign store");
    }
  };

  const toggleActive = async (r: Restaurant) => {
    try {
      await fetcher(`/admin/restaurants/${r._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !r.isActive }),
      });
      load();
    } catch {
      alert("Failed to update status");
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Loading vendors...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Vendors</h2>
          <p className="text-sm text-gray-500">
            Create vendors, give them stores, and manage each store&apos;s menu items.
          </p>
        </div>
        <Button onClick={() => setVendorModal(true)} className="w-full sm:w-auto shrink-0">
          <UserPlus className="mr-2 h-4 w-4" />
          Create Vendor
        </Button>
      </div>

      {vendors.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-gray-500">
            <Store className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            No vendors yet. Create your first vendor to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {vendors.map((v) => {
            const stores = storesFor(v._id);
            return (
              <Card key={v._id}>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
                      <UserCircle className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{v.name || v.username}</CardTitle>
                      <p className="text-xs text-gray-400">
                        @{v.username}
                        {v.phone ? ` · ${v.phone}` : ""} · {stores.length} store
                        {stores.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full sm:w-auto gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditVendor(v)}
                      className="w-full sm:w-auto text-gray-800 border-gray-300 hover:bg-gray-100"
                    >
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDeleteVendorTarget(v);
                        setDeleteVendorModal(true);
                      }}
                      className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openAddStore(v._id)}
                      className="w-full sm:w-auto bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add store
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {stores.length === 0 ? (
                    <p className="text-sm text-gray-400">No stores yet for this vendor.</p>
                  ) : (
                    <div className="divide-y">
                      {stores.map((r) => (
                        <div key={r._id} className="flex flex-col gap-3 sm:flex-row sm:items-center py-3">
                          <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center text-lg">
                            {r.imageEmoji || "🍽️"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                              {r.name}
                              {r.category ? (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-medium">
                                  {r.category}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-gray-400 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {r.address} · {r.menuItemCount ?? 0} items
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                          <button
                            type="button"
                            onClick={() => toggleActive(r)}
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              r.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {r.isActive ? "Active" : "Inactive"}
                          </button>
                          <Link
                            href={`/restaurants/${r._id}`}
                            className="inline-flex items-center text-indigo-600 hover:text-indigo-900 text-sm"
                          >
                            <Settings2 className="h-4 w-4 mr-1" /> Manage menu
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteStoreTarget(r);
                              setDeleteStoreModal(true);
                            }}
                            className="inline-flex items-center text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete store
                          </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {unassigned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-amber-700">
              Unassigned stores ({unassigned.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {unassigned.map((r) => (
                <div key={r._id} className="flex flex-col gap-3 sm:flex-row sm:items-center py-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-orange-50 flex items-center justify-center text-lg">
                    {r.imageEmoji || "🍽️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{r.name}</div>
                    <div className="text-xs text-gray-400 truncate">{r.address}</div>
                  </div>
                  </div>
                  <select
                    defaultValue=""
                    onChange={(e) => assignStore(r._id, e.target.value)}
                    className="h-9 w-full sm:w-auto rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900"
                  >
                    <option value="">Assign to vendor…</option>
                    {vendors.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.name || v.username}
                      </option>
                    ))}
                  </select>
                  <Link
                    href={`/restaurants/${r._id}`}
                    className="inline-flex items-center text-indigo-600 hover:text-indigo-900 text-sm shrink-0"
                  >
                    <Settings2 className="h-4 w-4 mr-1" /> Manage
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteStoreTarget(r);
                      setDeleteStoreModal(true);
                    }}
                    className="inline-flex items-center text-red-600 hover:text-red-700 text-sm font-medium shrink-0"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete store
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Vendor */}
      <Modal isOpen={vendorModal} onClose={() => setVendorModal(false)} title="Create Vendor">
        <form onSubmit={createVendor} className="space-y-4">
          <p className="text-xs text-gray-500">
            A vendor is a merchant login that can own one or more stores and manage their cooks.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="vUsername">Username</Label>
              <Input id="vUsername" value={vendorForm.username} onChange={(e) => setVendorForm({ ...vendorForm, username: e.target.value })} placeholder="mamas_kitchen" autoComplete="off" required />
            </div>
            <div>
              <Label htmlFor="vPassword">Password</Label>
              <Input id="vPassword" type="password" value={vendorForm.password} onChange={(e) => setVendorForm({ ...vendorForm, password: e.target.value })} autoComplete="new-password" required />
            </div>
            <div>
              <Label htmlFor="vName">Contact Name</Label>
              <Input id="vName" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="vPhone">Phone</Label>
              <Input id="vPhone" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} placeholder="+233..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setVendorModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Vendor"}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Vendor Confirmation */}
      <Modal isOpen={deleteVendorModal} onClose={() => setDeleteVendorModal(false)} title="Delete Vendor">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Delete vendor <span className="font-semibold">{deleteVendorTarget?.name || deleteVendorTarget?.username}</span>?
          </p>
          <p className="text-xs text-gray-500">
            Their stores will become unassigned and can be reassigned later.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteVendorModal(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={deleteVendor} className="bg-red-600 hover:bg-red-700">
              Delete Vendor
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Store Confirmation */}
      <Modal isOpen={deleteStoreModal} onClose={() => setDeleteStoreModal(false)} title="Delete Store">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Delete store <span className="font-semibold">{deleteStoreTarget?.name}</span>?
          </p>
          <p className="text-xs text-gray-500">
            This will permanently remove the store and its menu items.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteStoreModal(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={deleteStore} className="bg-red-600 hover:bg-red-700">
              Delete Store
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Vendor */}
      <Modal isOpen={editVendorModal} onClose={() => setEditVendorModal(false)} title="Edit Vendor">
        <form onSubmit={updateVendor} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="evUsername">Username</Label>
              <Input
                id="evUsername"
                value={editVendorForm.username}
                onChange={(e) => setEditVendorForm({ ...editVendorForm, username: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="evPassword">New Password (optional)</Label>
              <Input
                id="evPassword"
                type="password"
                value={editVendorForm.password}
                onChange={(e) => setEditVendorForm({ ...editVendorForm, password: e.target.value })}
                placeholder="Leave blank to keep current password"
              />
            </div>
            <div>
              <Label htmlFor="evName">Contact Name</Label>
              <Input
                id="evName"
                value={editVendorForm.name}
                onChange={(e) => setEditVendorForm({ ...editVendorForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="evPhone">Phone</Label>
              <Input
                id="evPhone"
                value={editVendorForm.phone}
                onChange={(e) => setEditVendorForm({ ...editVendorForm, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditVendorModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Store to vendor */}
      <Modal isOpen={storeModal} onClose={() => setStoreModal(false)} title="Add store" size="lg">
        <StoreCreateForm
          storeTypes={storeTypes}
          form={storeForm}
          setForm={setStoreForm}
          location={location}
          onLocationChange={setLocation}
          onSubmit={createStore}
          onCancel={() => setStoreModal(false)}
          saving={saving}
          submitLabel="Create store"
          showAdminStoreTypesLink
        />
      </Modal>
    </div>
  );
}
