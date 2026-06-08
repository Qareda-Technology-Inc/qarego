"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import StoreCreateForm from "@/components/StoreCreateForm";
import { type StoreLocation } from "@/components/StoreLocationPicker";
import type { StoreFormValues, StoreTypeOption } from "@/lib/storeForm";
import {
  EMPTY_STORE_FORM,
  buildStoreCreatePayload,
  resolveFormVertical,
} from "@/lib/storeForm";
import { Store, Plus, CheckCircle2 } from "lucide-react";
import { getCommerceOrderCopy } from "@/lib/commerceOrderCopy";

interface StoreRow {
  _id: string;
  name: string;
  imageEmoji?: string;
  category?: string;
  cuisine?: string;
  address?: string;
  deliveryFee: number;
  isActive: boolean;
  isAcceptingOrders: boolean;
  menuItemCount?: number;
  vertical?: string;
}

export default function StoresPage() {
  const { isOwner, activeRestaurantId, setActiveRestaurant, refreshRestaurants } = useAuth();
  const router = useRouter();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<StoreFormValues>({ ...EMPTY_STORE_FORM });
  const [location, setLocation] = useState<StoreLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [storeTypes, setStoreTypes] = useState<StoreTypeOption[]>([]);

  useEffect(() => {
    if (!isOwner) router.replace("/");
  }, [isOwner, router]);

  const load = async () => {
    try {
      const data = await fetcher("/merchant/restaurants");
      setStores(data.restaurants ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadStoreTypes = async () => {
    try {
      const data = await fetcher("/merchant/store-types");
      setStoreTypes(data.storeTypes ?? []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    loadStoreTypes();
  }, []);

  const openAdd = () => {
    setForm({ ...EMPTY_STORE_FORM });
    setLocation(null);
    setModalOpen(true);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedVertical = resolveFormVertical(form, storeTypes);
    if (!form.storeTypeIds.length) {
      alert("Select at least one category tag for this store");
      return;
    }
    if (!location) {
      alert("Search for an address or tap the map to set the store location");
      return;
    }
    if (!form.address.trim()) {
      alert("Enter or select a store address");
      return;
    }
    setSaving(true);
    try {
      await fetcher("/merchant/restaurants", {
        method: "POST",
        body: JSON.stringify(buildStoreCreatePayload(form, location, selectedVertical)),
      });
      setModalOpen(false);
      await Promise.all([load(), refreshRestaurants()]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not create store");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div className="flex items-center gap-3">
          <Store className="h-7 w-7 text-orange-500 shrink-0" />
          <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
        </div>
        <Button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1 inline" /> Add store
        </Button>
      </div>
      <p className="text-gray-600 mb-6">
        Add a store, choose its module (Food & Restaurants, Groceries & Supermarket, or Pharmacy), then manage menu and orders.
      </p>

      {loading ? (
        <p className="text-gray-500">Loading stores…</p>
      ) : stores.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
          You have no stores yet. Add your first one to start taking orders.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stores.map((s) => {
            const isActive = s._id === activeRestaurantId;
            return (
              <div
                key={s._id}
                className={`bg-white rounded-xl border p-5 ${isActive ? "ring-2 ring-orange-400" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-gray-900 truncate">
                      {s.imageEmoji} {s.name}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{s.address}</p>
                  </div>
                  {isActive && (
                    <span className="text-xs font-medium text-orange-600 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="h-4 w-4" /> Active
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-3 text-xs">
                  {s.category ? (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {s.category}
                    </span>
                  ) : null}
                  <span className={`px-2 py-0.5 rounded-full ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {s.isActive ? "Online" : "Offline"}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full ${s.isAcceptingOrders ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {s.isAcceptingOrders ? "Accepting orders" : "Paused"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {s.menuItemCount ?? 0} {getCommerceOrderCopy(s.vertical).productCountLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {formatCurrency(s.deliveryFee)} delivery
                  </span>
                </div>

                <div className="mt-4">
                  {isActive ? (
                    <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
                      {getCommerceOrderCopy(s.vertical).openOrders}
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-orange-500 hover:bg-orange-600"
                      onClick={() => setActiveRestaurant(s._id, "/")}
                    >
                      Manage this store
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add a store" size="lg">
        <StoreCreateForm
          storeTypes={storeTypes}
          form={form}
          setForm={setForm}
          location={location}
          onLocationChange={setLocation}
          onSubmit={create}
          onCancel={() => setModalOpen(false)}
          saving={saving}
          theme="merchant"
        />
      </Modal>
    </div>
  );
}
