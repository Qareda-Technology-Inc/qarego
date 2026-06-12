"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/context/AuthContext";
import { getCommerceOrderCopy } from "@/lib/commerceOrderCopy";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import ImageUploadField from "@/components/ImageUploadField";
import StoreLocationPicker, { type StoreLocation } from "@/components/StoreLocationPicker";
import PageLoader from "@/components/ui/PageLoader";
import { notify } from "@/lib/notify";
import { Settings, Loader2, Save, Power, MapPin, Clock } from "lucide-react";

type DayHours = { closed: boolean; open: string; close: string };

interface Restaurant {
  _id: string;
  name: string;
  description?: string;
  cuisine?: string;
  vertical?: string;
  imageEmoji?: string;
  imageUrl?: string | null;
  rating?: number;
  deliveryFee: number;
  minOrderAmount?: number;
  estimatedPrepMinutes?: number;
  isActive: boolean;
  isAcceptingOrders: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
  openingHours?: DayHours[];
}

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_HOURS: DayHours[] = Array.from({ length: 7 }, () => ({
  closed: false,
  open: "08:00",
  close: "22:00",
}));

export default function SettingsPage() {
  const { isOwner, activeRestaurant } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const copy = getCommerceOrderCopy(restaurant?.vertical || activeRestaurant?.vertical);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [form, setForm] = useState({
    description: "",
    imageEmoji: "",
    imageUrl: "",
    cuisine: "",
    minOrderAmount: "",
    estimatedPrepMinutes: "",
  });
  const [storeAddress, setStoreAddress] = useState("");
  const [storeLocation, setStoreLocation] = useState<StoreLocation | null>(null);
  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (!isOwner) router.replace("/");
  }, [isOwner, router]);

  const load = async () => {
    try {
      const data = await fetcher("/merchant/restaurant");
      const r: Restaurant = data.restaurant;
      setRestaurant(r);
      setForm({
        description: r.description || "",
        imageEmoji: r.imageEmoji || "",
        imageUrl: r.imageUrl || "",
        cuisine: r.cuisine || "",
        minOrderAmount: String(r.minOrderAmount ?? 0),
        estimatedPrepMinutes: String(r.estimatedPrepMinutes ?? 25),
      });
      setStoreAddress(r.address || "");
      setStoreLocation(
        r.latitude != null && r.longitude != null
          ? { lat: r.latitude, lng: r.longitude, address: r.address }
          : null
      );
      setHours(
        Array.isArray(r.openingHours) && r.openingHours.length === 7
          ? r.openingHours.map((d) => ({
              closed: !!d.closed,
              open: d.open || "08:00",
              close: d.close || "22:00",
            }))
          : DEFAULT_HOURS
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetcher("/merchant/restaurant", {
        method: "PATCH",
        body: JSON.stringify({
          description: form.description,
          imageEmoji: form.imageEmoji,
          imageUrl: form.imageUrl || null,
          cuisine: form.cuisine,
          minOrderAmount: Number(form.minOrderAmount),
          estimatedPrepMinutes: Number(form.estimatedPrepMinutes),
        }),
      });
      await load();
      notify.success("Profile saved");
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveLocation = async () => {
    if (!storeAddress.trim()) {
      notify.warning("Address required", "Enter or select a store address.");
      return;
    }
    if (!storeLocation) {
      notify.warning("Location required", "Search for an address or tap the map to set the pin.");
      return;
    }
    setSavingLocation(true);
    try {
      await fetcher("/merchant/restaurant", {
        method: "PATCH",
        body: JSON.stringify({
          address: storeAddress.trim(),
          latitude: storeLocation.lat,
          longitude: storeLocation.lng,
        }),
      });
      await load();
      notify.success("Location saved");
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Could not save location");
    } finally {
      setSavingLocation(false);
    }
  };

  const updateDay = (index: number, patch: Partial<DayHours>) => {
    setHours((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const applyToAll = (index: number) => {
    const src = hours[index];
    setHours((prev) => prev.map((d) => ({ ...d, open: src.open, close: src.close, closed: src.closed })));
  };

  const saveHours = async () => {
    setSavingHours(true);
    try {
      await fetcher("/merchant/restaurant", {
        method: "PATCH",
        body: JSON.stringify({ openingHours: hours }),
      });
      await load();
      notify.success("Opening hours saved");
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Could not save hours");
    } finally {
      setSavingHours(false);
    }
  };

  const toggleAccepting = async () => {
    if (!restaurant) return;
    setToggling(true);
    try {
      await fetcher("/merchant/restaurant", {
        method: "PATCH",
        body: JSON.stringify({ isAcceptingOrders: !restaurant.isAcceptingOrders }),
      });
      await load();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <PageLoader label="Loading store settings…" />;
  if (!restaurant) return <p className="text-gray-500">{copy.settingsNotFound}</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <Settings className="h-7 w-7 text-orange-500" />
        <h1 className="text-2xl font-bold text-gray-900">Store settings</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {restaurant.name} — pickup location, hours, and how customers see your store.
      </p>

      <div className="bg-white rounded-xl border p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">
            {restaurant.isAcceptingOrders ? "Accepting orders" : "Paused"}
          </p>
          <p className="text-sm text-gray-500">
            {restaurant.isActive
              ? "Toggle to temporarily stop receiving new orders."
              : copy.settingsOffline}
          </p>
        </div>
        <Button
          onClick={toggleAccepting}
          disabled={toggling || !restaurant.isActive}
          className={restaurant.isAcceptingOrders ? "bg-red-500 hover:bg-red-600" : "bg-green-600 hover:bg-green-700"}
        >
          {toggling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Power className="h-4 w-4 mr-1 inline" />
              {restaurant.isAcceptingOrders ? "Pause orders" : "Resume orders"}
            </>
          )}
        </Button>
      </div>

      <div id="store-location" className="bg-white rounded-xl border p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-orange-500" />
          <p className="font-medium text-gray-900">Pickup location</p>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Riders use this pin for pickup. Search for your address or tap the map to move the pin.
        </p>
        <StoreLocationPicker
          value={storeLocation}
          address={storeAddress}
          onLocationChange={(loc) => {
            if (!loc) return;
            setStoreLocation(loc);
            if (loc.address) setStoreAddress(loc.address);
          }}
          onAddressChange={setStoreAddress}
          mapHeight={280}
        />
        <div className="flex justify-end mt-4">
          <Button
            type="button"
            onClick={saveLocation}
            disabled={savingLocation}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {savingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-1 inline" />
                Save location
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-4 w-4 text-orange-500" />
          <p className="font-medium text-gray-900">Opening hours</p>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Customers can browse your menu anytime, but can only order while you&apos;re open.
        </p>

        <div className="space-y-2">
          {hours.map((d, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-2 border-b last:border-b-0"
            >
              <span className="w-24 text-sm font-medium text-gray-700">{DAY_LABELS[i]}</span>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={!d.closed}
                  onChange={(e) => updateDay(i, { closed: !e.target.checked })}
                  className="rounded border-gray-300"
                />
                {d.closed ? "Closed" : "Open"}
              </label>

              {!d.closed && (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={d.open}
                    onChange={(e) => updateDay(i, { open: e.target.value })}
                    className="w-32"
                  />
                  <span className="text-gray-400">–</span>
                  <Input
                    type="time"
                    value={d.close}
                    onChange={(e) => updateDay(i, { close: e.target.value })}
                    className="w-32"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => applyToAll(i)}
                className="text-xs text-orange-600 hover:underline sm:ml-auto"
              >
                Apply to all days
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          For overnight service set a close time earlier than the open time (e.g. 18:00 – 02:00).
        </p>

        <div className="flex justify-end mt-4">
          <Button onClick={saveHours} disabled={savingHours} className="bg-orange-500 hover:bg-orange-600">
            {savingHours ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-1 inline" />
                Save hours
              </>
            )}
          </Button>
        </div>
      </div>

      <form onSubmit={save} className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Store profile</h2>
        <p className="text-sm text-gray-500 -mt-2">Photo, description, and prep time shown to customers.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="emoji">Emoji</Label>
            <Input
              id="emoji"
              value={form.imageEmoji}
              onChange={(e) => setForm({ ...form, imageEmoji: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="cuisine">Cuisine</Label>
            <Input id="cuisine" value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} />
          </div>
        </div>

        <div>
          <Label htmlFor="desc">Description</Label>
          <Input id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        <ImageUploadField
          label="Store cover photo"
          hint="Customers see this on the store page. JPG or PNG, max 500 KB."
          folder="stores"
          value={form.imageUrl}
          onChange={(imageUrl) => setForm((f) => ({ ...f, imageUrl }))}
          aspect="wide"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="minorder">Min order ({formatCurrency(Number(form.minOrderAmount) || 0)})</Label>
            <Input
              id="minorder"
              type="number"
              min="0"
              step="0.01"
              value={form.minOrderAmount}
              onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="prep">Prep time (mins)</Label>
            <Input
              id="prep"
              type="number"
              min="5"
              value={form.estimatedPrepMinutes}
              onChange={(e) => setForm({ ...form, estimatedPrepMinutes: e.target.value })}
            />
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Delivery fee ({formatCurrency(restaurant.deliveryFee)}) is set by the platform admin.
        </p>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-1 inline" />
                Save profile
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
