"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { Label } from "@/components/ui/Label";
import type { MenuCategory } from "./MenuCategoryManager";

const selectClassName =
  "flex h-11 w-full rounded-xl border border-border bg-white px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand";

type Props = {
  id: string;
  value: string;
  onChange: (menuCategoryId: string, categoryName: string) => void;
  categories?: MenuCategory[];
};

export default function MenuCategorySelect({ id, value, onChange, categories: external }: Props) {
  const [categories, setCategories] = useState<MenuCategory[]>(external ?? []);

  useEffect(() => {
    if (external) {
      setCategories(external);
      return;
    }
    fetcher("/merchant/menu-categories")
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => {});
  }, [external]);

  return (
    <div>
      <Label htmlFor={id}>Category</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const cat = categories.find((c) => c._id === e.target.value);
          onChange(e.target.value, cat?.name || "Mains");
        }}
        className={selectClassName}
        required
      >
        <option value="" disabled>
          Select category
        </option>
        {categories.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name}
          </option>
        ))}
      </select>
      {categories.length === 0 && (
        <p className="text-xs text-amber-700 mt-1">Create a category above before adding items.</p>
      )}
    </div>
  );
}
