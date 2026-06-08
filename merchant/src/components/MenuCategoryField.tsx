"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/Label";

export const MENU_ITEM_CATEGORIES = [
  "Mains",
  "Starters",
  "Sides",
  "Soups",
  "Grills",
  "Rice dishes",
  "Drinks",
  "Desserts",
  "Combos",
  "Breakfast",
  "Snacks",
  "Other",
];

const selectClassName =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500";

interface MenuCategoryFieldProps {
  id: string;
  label?: string;
  value: string;
  onChange: (category: string) => void;
  accent?: "orange" | "indigo";
}

export default function MenuCategoryField({
  id,
  label = "Category",
  value,
  onChange,
  accent = "orange",
}: MenuCategoryFieldProps) {
  const options = useMemo(() => {
    const set = new Set(MENU_ITEM_CATEGORIES);
    const trimmed = value?.trim();
    if (trimmed && !set.has(trimmed)) set.add(trimmed);
    return Array.from(set);
  }, [value]);

  const ring = accent === "indigo" ? "focus:ring-indigo-500" : "focus:ring-orange-500";

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value || "Mains"}
        onChange={(e) => onChange(e.target.value)}
        className={selectClassName.replace("focus:ring-orange-500", ring)}
        required
      >
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
