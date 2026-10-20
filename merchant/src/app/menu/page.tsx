"use client";

import { useEffect, useMemo, useState } from "react";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/context/AuthContext";
import { getCommerceOrderCopy } from "@/lib/commerceOrderCopy";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import MenuCategoryManager, { type MenuCategory } from "@/components/MenuCategoryManager";
import MenuCategorySelect from "@/components/MenuCategorySelect";
import MenuModifierEditor, {
  modifierSummary,
  type ModifierGroup,
} from "@/components/MenuModifierEditor";
import ImageUploadField from "@/components/ImageUploadField";
import { resolveImageUrl } from "@/lib/resolveImageUrl";
import { UtensilsCrossed, Plus, Edit2, Trash2, Loader2, SlidersHorizontal, ImageOff, X } from "lucide-react";

interface MenuItem {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  menuCategory?: string;
  isAvailable: boolean;
  /** "Sold out today": hidden from customers until this time. */
  soldOutUntil?: string | null;
  imageUrl?: string | null;
  tags?: string[];
  badge?: string | null;
  discountLabel?: string | null;
  discountPercent?: number | null;
  originalPrice?: number | null;
  modifierGroups?: ModifierGroup[];
}

function computeSalePrice(original: number, percent: number) {
  return Math.round(original * (1 - percent / 100) * 100) / 100;
}

function discountBadgeLabel(item: MenuItem) {
  if (item.discountPercent != null && item.discountPercent > 0) {
    return `-${Math.round(item.discountPercent)}%`;
  }
  return item.discountLabel || "Discount";
}

const TAG_OPTIONS = [
  { id: "popular", label: "Popular" },
  { id: "new", label: "New" },
  { id: "spicy", label: "Spicy" },
] as const;

const EMPTY_ITEM = {
  name: "",
  description: "",
  price: "",
  menuCategoryId: "",
  isAvailable: true,
  imageUrl: "",
  tags: [] as string[],
  badge: "" as "" | "discount",
  originalPrice: "",
  discountPercent: "",
};

function isSoldOutToday(item: MenuItem) {
  return !!item.soldOutUntil && new Date(item.soldOutUntil).getTime() > Date.now();
}

type BulkMode = "percent" | "amount" | "set";

export default function MenuPage() {
  const { isOwner, activeRestaurant } = useAuth();
  const copy = getCommerceOrderCopy(activeRestaurant?.vertical);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_ITEM });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<BulkMode>("percent");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const discountPreview = useMemo(() => {
    if (form.badge !== "discount") return null;
    const original = Number(form.originalPrice);
    const percent = Number(form.discountPercent);
    if (!Number.isFinite(original) || original <= 0) return null;
    if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) return null;
    return computeSalePrice(original, percent);
  }, [form.badge, form.originalPrice, form.discountPercent]);

  const load = async () => {
    try {
      const data = await fetcher("/merchant/menu");
      setItems(data.menuItems ?? []);
      if (data.categories?.length) setCategories(data.categories);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, []);

  const openAdd = () => {
    if (categories.length === 0) {
      alert("Create at least one menu category first.");
      return;
    }
    setEditing(null);
    setForm({
      ...EMPTY_ITEM,
      menuCategoryId: categories[0]._id,
    });
    setModalOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description || "",
      menuCategoryId: item.menuCategory || categories.find((c) => c.name === item.category)?._id || "",
      isAvailable: item.isAvailable,
      imageUrl: item.imageUrl || "",
      tags: item.tags || [],
      badge: item.badge === "discount" ? "discount" : "",
      price: item.badge === "discount" ? "" : String(item.price),
      originalPrice:
        item.badge === "discount" ? String(item.originalPrice ?? item.price) : "",
      discountPercent:
        item.discountPercent != null ? String(item.discountPercent) : "",
    });
    setModalOpen(true);
  };

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing && !form.imageUrl) {
      alert(`Add a photo of this ${copy.itemSingular} so customers can see what they're ordering.`);
      return;
    }
    if (!form.menuCategoryId) {
      alert("Select a category");
      return;
    }
    if (form.badge === "discount") {
      const original = Number(form.originalPrice);
      const percent = Number(form.discountPercent);
      if (!Number.isFinite(original) || original <= 0) {
        alert("Enter the original price before discount");
        return;
      }
      if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
        alert("Enter a discount between 1 and 99%");
        return;
      }
    } else if (!form.price || Number(form.price) < 0) {
      alert("Enter a valid price");
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({
        name: form.name,
        description: form.description,
        menuCategoryId: form.menuCategoryId,
        isAvailable: form.isAvailable,
        imageUrl: form.imageUrl || null,
        tags: form.tags,
        ...(form.badge === "discount"
          ? {
              badge: "discount",
              originalPrice: Number(form.originalPrice),
              discountPercent: Number(form.discountPercent),
            }
          : {
              badge: null,
              price: Number(form.price),
            }),
      });
      if (editing) {
        await fetcher(`/merchant/menu/${editing._id}`, { method: "PATCH", body });
      } else {
        await fetcher("/merchant/menu", { method: "POST", body });
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /** Sold out for today (back on its own tomorrow), back in stock, or switched off for good. */
  const setAvailability = async (item: MenuItem, change: "soldOutToday" | "available" | "off") => {
    setBusy(item._id);
    try {
      await fetcher(`/merchant/menu/${item._id}`, {
        method: "PATCH",
        body: JSON.stringify(
          change === "soldOutToday"
            ? { soldOutToday: true }
            : change === "available"
              ? { isAvailable: true, soldOutToday: false }
              : { isAvailable: false }
        ),
      });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (item: MenuItem) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    setBusy(item._id);
    try {
      await fetcher(`/merchant/menu/${item._id}`, { method: "DELETE" });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  const toggleSelected = (ids: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const applyBulkPrice = async () => {
    const value = Number(bulkValue);
    if (!bulkValue.trim() || !Number.isFinite(value)) {
      alert("Enter a number");
      return;
    }
    const what =
      bulkMode === "percent"
        ? `${value >= 0 ? "raise" : "lower"} prices by ${Math.abs(value)}%`
        : bulkMode === "amount"
          ? `${value >= 0 ? "add" : "take off"} ${formatCurrency(Math.abs(value))}`
          : `set the price to ${formatCurrency(value)}`;
    if (!confirm(`${what[0].toUpperCase()}${what.slice(1)} for ${selected.size} item${selected.size === 1 ? "" : "s"}?`)) return;
    setBulkBusy(true);
    try {
      const res = await fetcher("/merchant/menu/bulk-price", {
        method: "POST",
        body: JSON.stringify({ itemIds: [...selected], mode: bulkMode, value }),
      });
      setSelected(new Set());
      setBulkValue("");
      await load();
      alert(`Updated ${res.updated} price${res.updated === 1 ? "" : "s"}.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Couldn't update prices");
    } finally {
      setBulkBusy(false);
    }
  };

  const noPhotoCount = items.filter((i) => !i.imageUrl).length;

  const grouped = useMemo(() => {
    const acc: Record<string, MenuItem[]> = {};
    const order: string[] = [];
    for (const c of categories) {
      order.push(c.name);
      acc[c.name] = [];
    }
    for (const item of items) {
      const cat = item.category || "Other";
      if (!acc[cat]) {
        acc[cat] = [];
        if (!order.includes(cat)) order.push(cat);
      }
      acc[cat].push(item);
    }
    return { acc, order };
  }, [items, categories]);

  return (
    // Leave room at the bottom for the bulk price bar while items are selected.
    <div className={`max-w-4xl ${selected.size > 0 ? "pb-24" : ""}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="h-7 w-7 text-brand" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{copy.menuNav}</h1>
            <p className="text-sm text-muted mt-0.5">{copy.menuSubtitle}</p>
          </div>
        </div>
        {isOwner && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1 inline" /> {copy.menuAddLabel}
          </Button>
        )}
      </div>

      {isOwner && <MenuCategoryManager onCategoriesChange={setCategories} />}

      {isOwner && categories.length > 0 ? (
        <h2 className="text-sm font-semibold text-foreground mb-3">2. {copy.itemsHeading}</h2>
      ) : null}

      {!isOwner && (
        <p className="text-sm text-muted mb-4">
          As a {copy.staffRole} you can mark items sold out or back in stock. Ask the owner to change prices.
        </p>
      )}

      {isOwner && noPhotoCount > 0 ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ImageOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {noPhotoCount} {noPhotoCount === 1 ? copy.itemSingular : copy.itemsHeading.toLowerCase()} {noPhotoCount === 1 ? "has" : "have"} no photo.
            Items with a photo sell better, and every new {copy.itemSingular} needs one.
          </span>
        </div>
      ) : null}

      {loading ? (
        <p className="text-gray-500">Loading menu…</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-gray-500">
          {categories.length === 0
            ? `Create a category first, then add ${copy.itemsHeading.toLowerCase()}.`
            : `No ${copy.itemsHeading.toLowerCase()} yet. Add your first ${copy.itemSingular}.`}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border p-4 space-y-6">
          {grouped.order.map((category) => {
            const catItems = grouped.acc[category] || [];
            if (!catItems.length) return null;
            return (
            <div key={category}>
              <div className="mb-2 flex items-center gap-2">
                {isOwner ? (
                  <input
                    type="checkbox"
                    aria-label={`Select all in ${category}`}
                    checked={catItems.every((i) => selected.has(i._id))}
                    onChange={(e) => toggleSelected(catItems.map((i) => i._id), e.target.checked)}
                  />
                ) : null}
                <h3 className="text-xs font-semibold uppercase text-gray-500">{category}</h3>
              </div>
              <div className="divide-y border rounded-lg">
                {catItems.map((item) => (
                  <div
                    key={item._id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 ${
                      selected.has(item._id) ? "bg-brand/5" : "bg-white"
                    }`}
                  >
                    {isOwner ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.name}`}
                        checked={selected.has(item._id)}
                        onChange={(e) => toggleSelected([item._id], e.target.checked)}
                        className="shrink-0"
                      />
                    ) : null}
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImageUrl(item.imageUrl)}
                        alt=""
                        className="w-16 h-16 rounded-lg object-cover shrink-0 border"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => (isOwner ? openEdit(item) : undefined)}
                        className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-amber-300 text-[10px] font-medium text-amber-700"
                        title={isOwner ? "Add a photo" : "No photo"}
                      >
                        <ImageOff className="h-4 w-4" />
                        {isOwner ? "Add photo" : "No photo"}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{item.name}</span>
                        {!item.isAvailable ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Turned off
                          </span>
                        ) : isSoldOutToday(item) ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Sold out today
                          </span>
                        ) : null}
                        {item.badge === "discount" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                            {discountBadgeLabel(item)}
                          </span>
                        )}
                        {(item.tags || []).map((t) => (
                          <span
                            key={t}
                            className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand capitalize"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      {item.description ? (
                        <p className="text-sm text-muted mt-0.5">{item.description}</p>
                      ) : null}
                      {modifierSummary(item.modifierGroups || []) ? (
                        <p className="text-xs text-indigo-700 mt-1">
                          Options: {modifierSummary(item.modifierGroups)}
                        </p>
                      ) : null}
                      <div className="mt-1">
                        <p className="text-sm font-semibold text-gray-800">
                          {formatCurrency(item.price)}
                        </p>
                        {item.originalPrice != null && item.originalPrice > item.price ? (
                          <p className="text-sm text-gray-400 line-through">
                            {formatCurrency(item.originalPrice)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {busy === item._id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : !item.isAvailable || isSoldOutToday(item) ? (
                        <Button variant="outline" size="sm" onClick={() => setAvailability(item, "available")}>
                          {item.isAvailable ? "Back in stock" : "Turn on"}
                        </Button>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setAvailability(item, "soldOutToday")}>
                            Sold out today
                          </Button>
                          <button
                            type="button"
                            onClick={() => setAvailability(item, "off")}
                            className="text-xs text-gray-500 hover:text-red-600 hover:underline"
                            title="Hide until you turn it back on"
                          >
                            Turn off
                          </button>
                        </>
                      )}
                      {isOwner && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setModifierItem(item)}
                          >
                            <SlidersHorizontal className="h-4 w-4 mr-1" />
                            Options
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600"
                            disabled={busy === item._id}
                            onClick={() => remove(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {isOwner && selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-[min(720px,calc(100%-2rem))] flex-wrap items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-xl">
          <span className="text-sm font-semibold text-foreground">{selected.size} selected</span>
          <select
            value={bulkMode}
            onChange={(e) => setBulkMode(e.target.value as BulkMode)}
            className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
            aria-label="How to change the price"
          >
            <option value="percent">Change by %</option>
            <option value="amount">Change by GH₵</option>
            <option value="set">Set price to</option>
          </select>
          <Input
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder={bulkMode === "percent" ? "e.g. 10 or -5" : bulkMode === "amount" ? "e.g. 2 or -1" : "e.g. 25"}
            inputMode="decimal"
            className="h-9 w-32"
            aria-label="Amount"
          />
          <Button size="sm" disabled={bulkBusy} onClick={applyBulkPrice}>
            {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        </div>
      ) : null}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${copy.itemSingular}` : copy.menuAddLabel}
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <ImageUploadField
            label="Photo"
            hint={editing ? "JPG or PNG, max 500 KB." : "Required. A clear photo of this exact item. JPG or PNG, max 500 KB."}
            folder="menu"
            value={form.imageUrl}
            onChange={(imageUrl) => setForm({ ...form, imageUrl })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {form.badge !== "discount" ? (
              <div>
                <Label htmlFor="price">Price (GH₵)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="originalPrice">Original price (GH₵)</Label>
                  <Input
                    id="originalPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.originalPrice}
                    onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="discountPercent">Discount (%)</Label>
                  <Input
                    id="discountPercent"
                    type="number"
                    min="1"
                    max="99"
                    step="1"
                    placeholder="30"
                    value={form.discountPercent}
                    onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                    required
                  />
                </div>
              </>
            )}
            <MenuCategorySelect
              id="cat"
              value={form.menuCategoryId}
              categories={categories}
              onChange={(menuCategoryId) => setForm({ ...form, menuCategoryId })}
            />
          </div>
          {form.badge === "discount" && discountPreview != null && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              Sale price: <strong>{formatCurrency(discountPreview)}</strong>
              {form.discountPercent ? (
                <span className="text-green-800/80"> (−{form.discountPercent}%)</span>
              ) : null}
            </p>
          )}

          <div>
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-3 mt-1">
              {TAG_OPTIONS.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.tags.includes(t.id)}
                    onChange={() => toggleTag(t.id)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.badge === "discount"}
              onChange={(e) => {
                const on = e.target.checked;
                setForm((f) => ({
                  ...f,
                  badge: on ? "discount" : "",
                  originalPrice: on && f.price ? f.price : f.originalPrice,
                  price: on ? "" : f.originalPrice || f.price,
                  discountPercent: on ? f.discountPercent : "",
                }));
              }}
            />
            Show discount tag
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isAvailable}
              onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
            />
            Available for ordering
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <MenuModifierEditor
        item={modifierItem}
        open={!!modifierItem}
        onClose={() => setModifierItem(null)}
        onSaved={load}
      />
    </div>
  );
}
