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
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";

interface MenuCategoryFieldProps {
  id: string;
  label?: string;
  value: string;
  onChange: (category: string) => void;
}

export default function MenuCategoryField({
  id,
  label = "Category",
  value,
  onChange,
}: MenuCategoryFieldProps) {
  const options = useMemo(() => {
    const set = new Set(MENU_ITEM_CATEGORIES);
    const trimmed = value?.trim();
    if (trimmed && !set.has(trimmed)) set.add(trimmed);
    return Array.from(set);
  }, [value]);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value || "Mains"}
        onChange={(e) => onChange(e.target.value)}
        className={selectClassName}
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
