"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import MenuCategoryField from "@/components/MenuCategoryField";
import { ArrowLeft, Plus, Trash2, Edit2, Loader2, Save } from "lucide-react";

interface Owner {
  _id: string;
  name?: string;
  username?: string;
  phone?: string;
}

interface Restaurant {
  _id: string;
  name: string;
  cuisine: string;
  imageEmoji: string;
  description: string;
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
}

interface MenuItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
}

const EMPTY_ITEM = { name: "", description: "", price: "", category: "Mains", isAvailable: true };

function normalizeCategory(cat?: string) {
  if (!cat || cat === "Main") return "Mains";
  return cat;
}

export default function RestaurantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({ ...EMPTY_ITEM });
  const [savingItem, setSavingItem] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetcher(`/admin/restaurants/${id}`);
      setRestaurant(data.restaurant);
      setMenu(data.menuItems || []);
    } catch (e) {
      console.error("Failed to load restaurant", e);
      alert("Failed to load restaurant");
      router.push("/restaurants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;
    setSavingProfile(true);
    try {
      await fetcher(`/admin/restaurants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: restaurant.name,
          cuisine: restaurant.cuisine,
          imageEmoji: restaurant.imageEmoji,
          description: restaurant.description,
          deliveryFee: Number(restaurant.deliveryFee),
          minOrderAmount: Number(restaurant.minOrderAmount),
          estimatedPrepMinutes: Number(restaurant.estimatedPrepMinutes),
          address: restaurant.address,
          latitude: Number(restaurant.latitude),
          longitude: Number(restaurant.longitude),
          isActive: restaurant.isActive,
          isAcceptingOrders: restaurant.isAcceptingOrders,
        }),
      });
      alert("Saved");
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingProfile(false);
    }
  };

  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({ ...EMPTY_ITEM });
    setItemModalOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description,
      price: String(item.price),
      category: normalizeCategory(item.category),
      isAvailable: item.isAvailable,
    });
    setItemModalOpen(true);
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingItem(true);
    try {
      const payload = {
        name: itemForm.name,
        description: itemForm.description,
        price: Number(itemForm.price),
        category: itemForm.category,
        isAvailable: itemForm.isAvailable,
      };
      if (editingItem) {
        await fetcher(`/admin/restaurants/${id}/menu/${editingItem._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await fetcher(`/admin/restaurants/${id}/menu`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setItemModalOpen(false);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save menu item");
    } finally {
      setSavingItem(false);
    }
  };

  const deleteItem = async (item: MenuItem) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await fetcher(`/admin/restaurants/${id}/menu/${item._id}`, { method: "DELETE" });
      load();
    } catch {
      alert("Failed to delete item");
    }
  };

  const toggleAvailable = async (item: MenuItem) => {
    try {
      await fetcher(`/admin/restaurants/${id}/menu/${item._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      load();
    } catch {
      alert("Failed to update availability");
    }
  };

  if (loading || !restaurant) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const grouped = menu.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = normalizeCategory(item.category);
    (acc[cat] = acc[cat] || []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 min-w-0">
        <Link href="/restaurants" className="shrink-0 text-gray-500 hover:text-gray-700 p-1 -ml-1">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 flex flex-wrap items-center gap-2">
            <span>{restaurant.imageEmoji}</span> {restaurant.name}
          </h2>
          <p className="text-sm text-gray-500">
            {restaurant.owner ? (
              <>Vendor: {restaurant.owner.name || restaurant.owner.username} (@{restaurant.owner.username})</>
            ) : (
              <span className="text-amber-600">No vendor login assigned</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Profile & Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-3">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={restaurant.name} onChange={(e) => setRestaurant({ ...restaurant, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cuisine">Cuisine</Label>
                  <Input id="cuisine" value={restaurant.cuisine} onChange={(e) => setRestaurant({ ...restaurant, cuisine: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="imageEmoji">Emoji</Label>
                  <Input id="imageEmoji" value={restaurant.imageEmoji} onChange={(e) => setRestaurant({ ...restaurant, imageEmoji: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={restaurant.description} onChange={(e) => setRestaurant({ ...restaurant, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="deliveryFee">Delivery Fee</Label>
                  <Input id="deliveryFee" type="number" value={restaurant.deliveryFee} onChange={(e) => setRestaurant({ ...restaurant, deliveryFee: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="minOrderAmount">Min Order</Label>
                  <Input id="minOrderAmount" type="number" value={restaurant.minOrderAmount} onChange={(e) => setRestaurant({ ...restaurant, minOrderAmount: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label htmlFor="prep">Prep Time (min)</Label>
                <Input id="prep" type="number" value={restaurant.estimatedPrepMinutes} onChange={(e) => setRestaurant({ ...restaurant, estimatedPrepMinutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={restaurant.address} onChange={(e) => setRestaurant({ ...restaurant, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="lat">Latitude</Label>
                  <Input id="lat" type="number" value={restaurant.latitude} onChange={(e) => setRestaurant({ ...restaurant, latitude: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="lng">Longitude</Label>
                  <Input id="lng" type="number" value={restaurant.longitude} onChange={(e) => setRestaurant({ ...restaurant, longitude: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={restaurant.isActive} onChange={(e) => setRestaurant({ ...restaurant, isActive: e.target.checked })} className="rounded border-gray-300" />
                  Active (visible to customers)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={restaurant.isAcceptingOrders} onChange={(e) => setRestaurant({ ...restaurant, isAcceptingOrders: e.target.checked })} className="rounded border-gray-300" />
                  Accepting new orders
                </label>
              </div>
              <Button type="submit" disabled={savingProfile} className="w-full">
                {savingProfile ? "Saving..." : (<><Save className="h-4 w-4 mr-2" /> Save Profile</>)}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Menu */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Menu ({menu.length})</CardTitle>
              <Button onClick={openAddItem} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {menu.length === 0 ? (
              <div className="text-center py-10 text-gray-500">No menu items yet.</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(grouped).map(([category, items]) => (
                  <div key={category}>
                    <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">{category}</h4>
                    <div className="divide-y divide-gray-100">
                      {items.map((item) => (
                        <div key={item._id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{item.name}</span>
                              <button
                                type="button"
                                onClick={() => toggleAvailable(item)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  item.isAvailable ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                                }`}
                              >
                                {item.isAvailable ? "Available" : "Hidden"}
                              </button>
                            </div>
                            {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                          </div>
                          <div className="text-sm font-medium text-gray-900 w-20 text-right">GH₵{item.price}</div>
                          <div className="flex items-center gap-2 ml-4">
                            <button onClick={() => openEditItem(item)} className="text-indigo-600 hover:text-indigo-900">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => deleteItem(item)} className="text-red-600 hover:text-red-900">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={itemModalOpen} onClose={() => setItemModalOpen(false)} title={editingItem ? "Edit Menu Item" : "Add Menu Item"}>
        <form onSubmit={saveItem} className="space-y-4">
          <div>
            <Label htmlFor="itemName">Name</Label>
            <Input id="itemName" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required placeholder="Jollof Rice & Chicken" />
          </div>
          <div>
            <Label htmlFor="itemDesc">Description</Label>
            <Input id="itemDesc" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} placeholder="Spicy party jollof" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="itemPrice">Price (GH₵)</Label>
              <Input id="itemPrice" type="number" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} required />
            </div>
            <MenuCategoryField
              id="itemCategory"
              value={itemForm.category}
              onChange={(category) => setItemForm({ ...itemForm, category })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={itemForm.isAvailable} onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })} className="rounded border-gray-300" />
            Available
          </label>
          <div className="flex justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setItemModalOpen(false)} className="mr-2">
              Cancel
            </Button>
            <Button type="submit" disabled={savingItem}>
              {savingItem ? "Saving..." : editingItem ? "Save Changes" : "Add Item"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
