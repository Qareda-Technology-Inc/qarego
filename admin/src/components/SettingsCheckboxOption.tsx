"use client";

import { cn } from "@/lib/utils";

type SettingsCheckboxOptionProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  activeHint?: string;
  variant?: "default" | "warning";
};

export function SettingsCheckboxOption({
  id,
  checked,
  onChange,
  title,
  description,
  activeHint,
  variant = "default",
}: SettingsCheckboxOptionProps) {
  const isWarning = variant === "warning" && checked;

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 cursor-pointer rounded-lg border p-4 transition-colors",
        "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
        checked && !isWarning && "border-blue-300 bg-blue-50/60",
        isWarning && "border-amber-400 bg-amber-50"
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-400 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
      />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        {description ? (
          <span className="block text-sm text-gray-700 mt-1 leading-snug">{description}</span>
        ) : null}
        {checked && activeHint ? (
          <span
            className={cn(
              "block text-xs font-medium mt-2",
              isWarning ? "text-amber-800" : "text-blue-800"
            )}
          >
            {activeHint}
          </span>
        ) : null}
      </span>
    </label>
  );
}
