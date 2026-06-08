"use client";

import { useCallback, useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Loader2, Plus, Trash2, Pencil, Check, X } from "lucide-react";

export type MenuCategory = {
  _id: string;
  name: string;
  sortOrder?: number;
  displayLayout: "row" | "column";
};

export default function MenuCategoryManager({
  onCategoriesChange,
}: {
  onCategoriesChange?: (categories: MenuCategory[]) => void;
}) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetcher("/merchant/menu-categories");
      const list = data.categories ?? [];
      setCategories(list);
      onCategoriesChange?.(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent setState only
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCategory = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await fetcher("/merchant/menu-categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewName("");
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setBusy(false);
    }
  };

  const updateLayout = async (cat: MenuCategory, displayLayout: "row" | "column") => {
    setBusy(true);
    try {
      await fetcher(`/merchant/menu-categories/${cat._id}`, {
        method: "PATCH",
        body: JSON.stringify({ displayLayout }),
      });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const startRename = (cat: MenuCategory) => {
    setEditingId(cat._id);
    setEditName(cat.name);
  };

  const saveRename = async (cat: MenuCategory) => {
    const name = editName.trim();
    if (!name || name === cat.name) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    try {
      await fetcher(`/merchant/menu-categories/${cat._id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setEditingId(null);
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (cat: MenuCategory) => {
    if (!confirm(`Delete category "${cat.name}"? Items move to Other.`)) return;
    setBusy(true);
    try {
      await fetcher(`/merchant/menu-categories/${cat._id}`, { method: "DELETE" });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border p-4 mb-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">1. Categories</h2>
      <p className="text-xs text-gray-500 mb-4">
        Organize your menu into sections — e.g. Main Dishes, Drinks, Sides. Choose row (side scroll)
        or column (grid) for how customers browse items.
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Loading categories…</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {categories.map((cat) => (
            <li
              key={cat._id}
              className="flex flex-wrap items-center gap-2 justify-between border rounded-lg px-3 py-2"
            >
              {editingId === cat._id ? (
                <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => saveRename(cat)}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <span className="font-medium text-gray-900">{cat.name}</span>
              )}
              <div className="flex items-center gap-2">
                {editingId !== cat._id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => startRename(cat)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                ) : null}
                <select
                  value={cat.displayLayout}
                  disabled={busy}
                  onChange={(e) =>
                    updateLayout(cat, e.target.value as "row" | "column")
                  }
                  className="text-sm border rounded-md px-2 py-1"
                >
                  <option value="column">Column grid</option>
                  <option value="row">Row scroll</option>
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-red-600"
                  disabled={busy}
                  onClick={() => remove(cat)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-gray-500">No categories yet — add one below.</p>
          )}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="flex-1 w-full">
          <Label htmlFor="newCat">New category name</Label>
          <Input
            id="newCat"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Main Dishes, Drinks, Sides"
          />
        </div>
        <Button
          type="button"
          disabled={busy || !newName.trim()}
          onClick={addCategory}
          className="bg-orange-500 hover:bg-orange-600 shrink-0"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Add
        </Button>
      </div>
    </div>
  );
}
