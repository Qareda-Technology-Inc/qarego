"use client";

import { useEffect, useMemo, useState } from "react";
import { fetcher } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Vertical = "FOOD" | "GROCERY" | "PHARMACY";

interface StoreType {
  _id: string;
  name: string;
  vertical: Vertical;
  emoji: string;
  sortOrder: number;
  isActive: boolean;
}

const VERTICALS: { key: Vertical; label: string; hint: string }[] = [
  { key: "FOOD", label: "Food & Restaurants", hint: "Cuisines & food tags — Ghanaian, Pizza, Shawarma, etc." },
  { key: "GROCERY", label: "Groceries & Supermarket", hint: "Store departments — Produce, Butchery, Pantry, etc." },
  { key: "PHARMACY", label: "Pharmacy", hint: "Medical categories — OTC, POM, Vitamins, First Aid, etc." },
];

const EMPTY = { name: "", vertical: "FOOD" as Vertical, emoji: "🍽️", sortOrder: "0" };

export default function StoreTypesPage() {
  const [storeTypes, setStoreTypes] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StoreType | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetcher("/admin/store-types");
      setStoreTypes(data.storeTypes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<Vertical, StoreType[]> = { FOOD: [], GROCERY: [], PHARMACY: [] };
    storeTypes.forEach((t) => map[t.vertical]?.push(t));
    return map;
  }, [storeTypes]);

  const openCreate = (vertical: Vertical) => {
    setEditing(null);
    setForm({
      ...EMPTY,
      vertical,
      emoji: vertical === "GROCERY" ? "🛒" : vertical === "PHARMACY" ? "💊" : "🍽️",
    });
    setModalOpen(true);
  };

  const openEdit = (t: StoreType) => {
    setEditing(t);
    setForm({
      name: t.name,
      vertical: t.vertical,
      emoji: t.emoji,
      sortOrder: String(t.sortOrder ?? 0),
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        vertical: form.vertical,
        emoji: form.emoji.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) {
        await fetcher(`/admin/store-types/${editing._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await fetcher("/admin/store-types", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not save store type");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: StoreType) => {
    try {
      await fetcher(`/admin/store-types/${t._id}`, { method: "DELETE" });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not remove store type");
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Loading store types…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Store types</h2>
        <p className="text-sm text-gray-500 mt-1">
          Define which module each store belongs to. Vendors pick a type when creating a store.
          Drinks and Bar are under <strong>Food</strong>.
        </p>
      </div>

      {VERTICALS.map(({ key, label, hint }) => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{label}</CardTitle>
              <p className="text-xs text-gray-500 mt-1">{hint}</p>
            </div>
            <Button size="sm" onClick={() => openCreate(key)}>
              <Plus className="h-4 w-4 mr-1" /> Add type
            </Button>
          </CardHeader>
          <CardContent>
            {grouped[key].length === 0 ? (
              <p className="text-sm text-gray-400">No types yet.</p>
            ) : (
              <div className="divide-y">
                {grouped[key].map((t) => (
                  <div key={t._id} className="flex items-center gap-3 py-3">
                    <span className="text-2xl">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        Order {t.sortOrder}
                        {!t.isActive ? " · Inactive" : ""}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200"
                      onClick={() => remove(t)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit store type" : "Add store type"}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>Module</Label>
            <select
              value={form.vertical}
              onChange={(e) => setForm({ ...form, vertical: e.target.value as Vertical })}
              className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
            >
              <option value="FOOD">Food (includes Drinks, Bar)</option>
              <option value="GROCERY">Grocery</option>
              <option value="PHARMACY">Pharmacy</option>
            </select>
          </div>
          <div>
            <Label htmlFor="stName">Type name</Label>
            <Input
              id="stName"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Drinks, Bar, Supermarket"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="stEmoji">Emoji</Label>
              <Input id="stEmoji" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="stOrder">Sort order</Label>
              <Input
                id="stOrder"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
