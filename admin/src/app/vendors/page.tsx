"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { Plus, Store, UserCircle, UserPlus, Settings2, MapPin, Pencil, Trash2, KeyRound } from "lucide-react";
import { ConfirmByTypingModal } from "@/components/ConfirmByTypingModal";
import { VendorLoginModal, type VendorLogin } from "@/components/VendorLoginModal";
import { VendorApplications } from "@/components/VendorApplications";
import { formatFreeUntil, isCommissionFree } from "@/lib/freePeriod";
import { useAuth } from "@/context/AuthContext";

interface Vendor {
  _id: string;
  name?: string;
  username?: string;
  phone?: string;
  storeCount?: number;
  /** Still on the temporary password QareGO sent (hasn't signed in and chosen their own). */
  mustChangePassword?: boolean;
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
  vertical?: "FOOD" | "GROCERY" | "PHARMACY" | "GAS" | "LAUNDRY";
  commissionFreeUntil?: string | null;
}

const VERTICAL_BADGE: Record<string, string> = {
  FOOD: "Restaurant",
  GROCERY: "Grocery",
  PHARMACY: "Pharmacy",
  GAS: "Gas station",
  LAUNDRY: "Laundry",
};

const EMPTY_VENDOR = { name: "", phone: "", username: "" };

export default function VendorsPage() {
  return (
    <Suspense fallback={null}>
      <VendorsContent />
    </Suspense>
  );
}

function VendorsContent() {
  const { user } = useAuth();
  const isStaff = user?.adminRole === "staff";
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get("tab") === "applications" ? "applications" : "vendors";
  const [newApplications, setNewApplications] = useState(0);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  const [vendorModal, setVendorModal] = useState(false);
  const [vendorForm, setVendorForm] = useState({ ...EMPTY_VENDOR });
  const [editVendorModal, setEditVendorModal] = useState(false);
  const [editVendorId, setEditVendorId] = useState("");
  const [editVendorForm, setEditVendorForm] = useState({ username: "", name: "", phone: "" });
  const [vendorLogin, setVendorLogin] = useState<VendorLogin | null>(null);
  const [resetting, setResetting] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
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

  /** `quiet` refreshes without the full-page loader (keeps open dialogs, e.g. a new login, on screen). */
  const load = async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const [vendorData, restaurantData, applicationData] = await Promise.all([
        fetcher("/admin/vendors"),
        fetcher("/admin/restaurants"),
        fetcher("/admin/vendor-applications?status=new").catch(() => null),
      ]);
      setVendors(vendorData.vendors || []);
      setRestaurants(restaurantData.restaurants || []);
      setNewApplications(applicationData?.counts?.new ?? 0);
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

  // Search vendors by name, username or phone, or by any of their stores' names or addresses.
  const vq = vendorSearch.trim().toLowerCase();
  const vqDigits = vq.replace(/\D/g, "").replace(/^(233|0)/, "");
  const visibleVendors = vq
    ? vendors.filter(
        (v) =>
          v.name?.toLowerCase().includes(vq) ||
          v.username?.toLowerCase().includes(vq) ||
          (vqDigits.length >= 3 && v.phone?.replace(/\D/g, "").includes(vqDigits)) ||
          storesFor(v._id).some(
            (r) => r.name?.toLowerCase().includes(vq) || r.address?.toLowerCase().includes(vq)
          )
      )
    : vendors;

  const createVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await fetcher("/admin/vendors", {
        method: "POST",
        body: JSON.stringify({
          name: vendorForm.name,
          phone: vendorForm.phone,
          username: vendorForm.username.trim() || undefined,
        }),
      });
      setVendorModal(false);
      setVendorForm({ ...EMPTY_VENDOR });
      setVendorLogin({ ...data.login, name: data.vendor?.name, phone: data.vendor?.phone, reason: "invite" });
      load(true);
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

  const resetVendorPassword = async () => {
    if (!editVendorId) return;
    const target = vendors.find((v) => v._id === editVendorId);
    if (!confirm(`Send ${target?.name || "this vendor"} a new temporary password? Their current password stops working.`)) {
      return;
    }
    setResetting(true);
    try {
      const data = await fetcher(`/admin/vendors/${editVendorId}/reset-password`, { method: "POST", body: "{}" });
      setEditVendorModal(false);
      setVendorLogin({ ...data.login, name: target?.name, reason: "reset" });
      load(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Couldn't reset the password");
    } finally {
      setResetting(false);
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
          Invite vendor
        </Button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            ["vendors", "Vendors"],
            ["applications", "Applications"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => router.replace(key === "vendors" ? pathname : `${pathname}?tab=${key}`, { scroll: false })}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${
              tab === key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {label}
            {key === "applications" && newApplications ? (
              <span className="rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">{newApplications}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "applications" ? (
        <VendorApplications onChanged={() => load(true)} />
      ) : (
      <>
      {vendors.length > 0 ? (
        <input
          type="search"
          value={vendorSearch}
          onChange={(e) => setVendorSearch(e.target.value)}
          placeholder="Search vendor, phone, store or address"
          aria-label="Search vendors and stores"
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm sm:w-96"
        />
      ) : null}

      {vendors.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-gray-500">
            <Store className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            No vendors yet. Create your first vendor to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleVendors.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No vendors or stores match &quot;{vendorSearch.trim()}&quot;.</p>
          ) : null}
          {visibleVendors.map((v) => {
            const stores = storesFor(v._id);
            return (
              <Card key={v._id}>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
                      <UserCircle className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div>
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        {v.name || v.username}
                        {v.mustChangePassword ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Hasn&apos;t signed in yet
                          </span>
                        ) : null}
                      </CardTitle>
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
                    {!isStaff ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeleteVendorTarget(v);
                          setDeleteVendorModal(true);
                        }}
                        className="w-full sm:w-auto text-gray-500 border-gray-200 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    ) : null}
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
                              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium">
                                {VERTICAL_BADGE[r.vertical ?? "FOOD"]}
                              </span>
                              {r.category && r.category !== VERTICAL_BADGE[r.vertical ?? "FOOD"] ? (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-medium">
                                  {r.category}
                                </span>
                              ) : null}
                              {isCommissionFree(r.commissionFreeUntil) ? (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium"
                                  title="No commission on this store's orders until then"
                                >
                                  Free until {formatFreeUntil(r.commissionFreeUntil as string)}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-gray-400 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {r.address} ·{" "}
                              {r.vertical === "GAS"
                                ? "cylinder prices are set in Settings › Cooking gas"
                                : `${r.menuItemCount ?? 0} items`}
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
                            href={`/restaurants/${r._id}#store-location`}
                            className="inline-flex items-center text-indigo-600 hover:text-indigo-900 text-sm"
                          >
                            <MapPin className="h-4 w-4 mr-1" /> Edit location
                          </Link>
                          <Link
                            href={`/restaurants/${r._id}`}
                            className="inline-flex items-center text-indigo-600 hover:text-indigo-900 text-sm"
                          >
                            <Settings2 className="h-4 w-4 mr-1" />{" "}
                            {r.vertical === "GAS" ? "Store details" : "Manage menu"}
                          </Link>
                          {!isStaff ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteStoreTarget(r);
                                setDeleteStoreModal(true);
                              }}
                              className="inline-flex items-center text-gray-400 hover:text-red-600 text-sm"
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> Delete store
                            </button>
                          ) : null}
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
                  {!isStaff ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteStoreTarget(r);
                        setDeleteStoreModal(true);
                      }}
                      className="inline-flex items-center text-gray-400 hover:text-red-600 text-sm shrink-0"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete store
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      </>
      )}

      {/* Invite vendor */}
      <Modal isOpen={vendorModal} onClose={() => setVendorModal(false)} title="Invite a vendor">
        <form onSubmit={createVendor} className="space-y-4">
          <p className="text-sm text-gray-600">
            We&apos;ll text them a link and a temporary password. They choose their own password the first time they sign
            in, then set up their stores.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="vName">Business or contact name</Label>
              <Input id="vName" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} placeholder="Auntie Esi's Chop Bar" required />
            </div>
            <div>
              <Label htmlFor="vPhone">Phone (for the text message)</Label>
              <Input id="vPhone" type="tel" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} placeholder="024 123 4567" required />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="vUsername">Username (optional)</Label>
              <Input id="vUsername" value={vendorForm.username} onChange={(e) => setVendorForm({ ...vendorForm, username: e.target.value })} placeholder="Leave blank to make one from the name" autoComplete="off" />
              <p className="mt-1 text-xs text-gray-500">They can also sign in with their phone number.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setVendorModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Sending..." : "Send invite"}</Button>
          </div>
        </form>
      </Modal>

      <VendorLoginModal login={vendorLogin} onClose={() => setVendorLogin(null)} />

      <ConfirmByTypingModal
        open={deleteVendorModal}
        title="Delete vendor"
        name={deleteVendorTarget?.username || deleteVendorTarget?.name || ""}
        consequences={[
          "Their login stops working straight away.",
          "Their stores stay, but become unassigned until you give them to another vendor.",
          "This can't be undone.",
        ]}
        actionLabel="Delete vendor"
        onCancel={() => {
          setDeleteVendorModal(false);
          setDeleteVendorTarget(null);
        }}
        onConfirm={deleteVendor}
      />

      <ConfirmByTypingModal
        open={deleteStoreModal}
        title="Delete store"
        name={deleteStoreTarget?.name || ""}
        consequences={[
          "The store and its whole menu are removed.",
          "Only stores that never had an order can be deleted. For any other store, switch it to Inactive.",
          "This can't be undone.",
        ]}
        actionLabel="Delete store"
        onCancel={() => {
          setDeleteStoreModal(false);
          setDeleteStoreTarget(null);
        }}
        onConfirm={deleteStore}
      />

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
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium text-gray-900">Password</p>
              <p className="text-gray-500">Forgotten or never received? Send them a new temporary one.</p>
            </div>
            <Button type="button" variant="outline" onClick={resetVendorPassword} disabled={resetting} className="shrink-0">
              <KeyRound className="mr-1 h-4 w-4" /> {resetting ? "Sending..." : "Reset password"}
            </Button>
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
