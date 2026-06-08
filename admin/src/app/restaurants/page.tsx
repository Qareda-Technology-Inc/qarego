"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { PageHeader } from "@/components/ui/PageHeader";
import { Plus, Store, Star, MapPin, Settings2, UserCircle } from "lucide-react";

interface Owner {
  _id: string;
  name?: string;
  username?: string;
  phone?: string;
}

interface Vendor {
  _id: string;
  name?: string;
  username?: string;
  phone?: string;
  storeCount?: number;
}

interface Restaurant {
  _id: string;
  name: string;
  cuisine: string;
  imageEmoji: string;
  rating: number;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedPrepMinutes: number;
  isActive: boolean;
  isAcceptingOrders: boolean;
  address: string;
  latitude: number;
  longitude: number;
  owner?: Owner | null;
  menuItemCount?: number;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "",
  cuisine: "Local",
  imageEmoji: "🍽️",
  description: "",
  // Food delivery price is distance-based at checkout (so keep this at 0).
  deliveryFee: "0",
  minOrderAmount: "0",
  estimatedPrepMinutes: "25",
  address: "",
  latitude: "",
  longitude: "",
  ownerUsername: "",
  ownerPassword: "",
  ownerName: "",
  ownerPhone: "",
};

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [ownerMode, setOwnerMode] = useState<"existing" | "new">("new");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const [restaurantData, vendorData] = await Promise.all([
        fetcher("/admin/restaurants"),
        fetcher("/admin/vendors").catch(() => ({ vendors: [] })),
      ]);
      setRestaurants(restaurantData.restaurants || []);
      setVendors(vendorData.vendors || []);
    } catch (e) {
      console.error("Failed to load restaurants", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setOwnerMode(vendors.length > 0 ? "existing" : "new");
    setSelectedOwnerId(vendors[0]?._id || "");
    setIsModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Owner is required — either assign an existing vendor or create a new login
    if (ownerMode === "existing" && !selectedOwnerId) {
      alert("Select a vendor to own this restaurant");
      return;
    }
    if (ownerMode === "new" && (!form.ownerUsername || !form.ownerPassword)) {
      alert("Enter a username and password for the new vendor login");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        cuisine: form.cuisine,
        imageEmoji: form.imageEmoji,
        description: form.description,
        deliveryFee: Number(form.deliveryFee),
        minOrderAmount: Number(form.minOrderAmount),
        estimatedPrepMinutes: Number(form.estimatedPrepMinutes),
        address: form.address,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      };
      if (ownerMode === "existing") {
        payload.ownerId = selectedOwnerId;
      } else {
        payload.owner = {
          username: form.ownerUsername,
          password: form.ownerPassword,
          name: form.ownerName,
          phone: form.ownerPhone,
        };
      }
      await fetcher("/admin/restaurants", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setIsModalOpen(false);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create restaurant");
    } finally {
      setSaving(false);
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
    return <div className="p-6 text-gray-500">Loading restaurants...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurants"
        description="Multivendor directory — onboard vendors, manage menus and availability"
        actions={
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Restaurant
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Vendor Directory ({restaurants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="md:hidden space-y-3">
            {restaurants.map((r) => (
              <div key={r._id} className="rounded-lg border border-gray-200 p-4 bg-white">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-orange-50 flex items-center justify-center text-xl">
                    {r.imageEmoji || "🍽️"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{r.name}</p>
                    <p className="text-xs text-gray-500">{r.cuisine} · {r.menuItemCount ?? 0} items</p>
                    <p className="text-xs text-gray-400 flex items-center mt-1 truncate">
                      <MapPin className="h-3 w-3 mr-0.5 shrink-0" />
                      {r.address}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(r)}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      r.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {r.isActive ? "Active" : "Inactive"}
                  </button>
                  <span className="text-xs text-gray-500">GH₵{r.deliveryFee} delivery</span>
                  <Link
                    href={`/restaurants/${r._id}`}
                    className="ml-auto inline-flex items-center text-indigo-600 text-sm font-medium"
                  >
                    <Settings2 className="h-4 w-4 mr-1" />
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restaurant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Menu</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fees</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Manage</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {restaurants.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-orange-50 flex items-center justify-center text-xl">
                          {r.imageEmoji || "🍽️"}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{r.name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{r.cuisine}</span>
                            <span className="flex items-center">
                              <Star className="h-3 w-3 text-yellow-400 fill-current mr-0.5" />
                              {r.rating?.toFixed(1)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 flex items-center mt-0.5">
                            <MapPin className="h-3 w-3 mr-0.5" />
                            {r.address}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {r.owner ? (
                        <div className="text-sm text-gray-700 flex items-center">
                          <UserCircle className="h-4 w-4 mr-1.5 text-gray-400" />
                          <div>
                            <div>{r.owner.name || r.owner.username}</div>
                            <div className="text-xs text-gray-400">@{r.owner.username}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          No vendor login
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{r.menuItemCount ?? 0} items</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div>Delivery: GH₵{r.deliveryFee}</div>
                      <div className="text-xs text-gray-400">Min: GH₵{r.minOrderAmount}</div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => toggleActive(r)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          r.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {r.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/restaurants/${r._id}`}
                        className="inline-flex items-center text-indigo-600 hover:text-indigo-900 text-sm"
                      >
                        <Settings2 className="h-4 w-4 mr-1" />
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {restaurants.length === 0 && (
              <div className="text-center py-10 text-gray-500">
                <Store className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                No restaurants yet. Add your first vendor.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Restaurant">
        <form onSubmit={handleCreate} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Restaurant Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Mama's Kitchen" />
            </div>
            <div>
              <Label htmlFor="cuisine">Cuisine</Label>
              <Input id="cuisine" value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} placeholder="Ghanaian" />
            </div>
            <div>
              <Label htmlFor="imageEmoji">Emoji</Label>
              <Input id="imageEmoji" value={form.imageEmoji} onChange={(e) => setForm({ ...form, imageEmoji: e.target.value })} placeholder="🍲" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Local Ghanaian dishes" />
            </div>
            <div>
              <Label htmlFor="deliveryFee">Delivery Fee (GH₵)</Label>
              <Input
                id="deliveryFee"
                type="number"
                value={form.deliveryFee}
                disabled
                required={false}
                onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Food delivery cost is calculated automatically on the customer cart by distance.
              </p>
            </div>
            <div>
              <Label htmlFor="minOrderAmount">Min Order (GH₵)</Label>
              <Input id="minOrderAmount" type="number" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="estimatedPrepMinutes">Prep Time (min)</Label>
              <Input id="estimatedPrepMinutes" type="number" value={form.estimatedPrepMinutes} onChange={(e) => setForm({ ...form, estimatedPrepMinutes: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required placeholder="Osu, Oxford Street, Accra" />
            </div>
            <div>
              <Label htmlFor="latitude">Latitude</Label>
              <Input id="latitude" type="number" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required placeholder="5.5573" />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input id="longitude" type="number" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required placeholder="-0.1816" />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-900 mb-1">Vendor Owner (required)</p>
            <p className="text-xs text-gray-500 mb-3">
              Every restaurant must belong to a vendor. Assign an existing vendor or create a new login.
            </p>

            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setOwnerMode("existing")}
                disabled={vendors.length === 0}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border ${
                  ownerMode === "existing"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                Existing vendor
              </button>
              <button
                type="button"
                onClick={() => setOwnerMode("new")}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border ${
                  ownerMode === "new"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                New vendor
              </button>
            </div>

            {ownerMode === "existing" ? (
              <div>
                <Label htmlFor="selectedOwnerId">Vendor</Label>
                <select
                  id="selectedOwnerId"
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <option value="">Select a vendor…</option>
                  {vendors.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.name || v.username} (@{v.username}) · {v.storeCount ?? 0} store
                      {(v.storeCount ?? 0) === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
                {vendors.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No vendors yet — create a new one.</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ownerUsername">Username</Label>
                  <Input id="ownerUsername" value={form.ownerUsername} onChange={(e) => setForm({ ...form, ownerUsername: e.target.value })} placeholder="mamas_kitchen" autoComplete="off" />
                </div>
                <div>
                  <Label htmlFor="ownerPassword">Password</Label>
                  <Input id="ownerPassword" type="password" value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} autoComplete="new-password" />
                </div>
                <div>
                  <Label htmlFor="ownerName">Contact Name</Label>
                  <Input id="ownerName" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="ownerPhone">Phone</Label>
                  <Input id="ownerPhone" value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} placeholder="+233..." />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? "Creating..." : "Create Restaurant"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
