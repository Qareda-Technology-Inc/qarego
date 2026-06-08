"use client";

import StoreLocationPicker, { type StoreLocation } from "@/components/StoreLocationPicker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  StoreFormValues,
  StoreTypeOption,
  StoreVertical,
  getVerticalMeta,
  resolveFormVertical,
  setStoreModule,
  toggleStoreTypeId,
} from "@/lib/storeForm";
import { Loader2 } from "lucide-react";
import Link from "next/link";

type Props = {
  storeTypes: StoreTypeOption[];
  form: StoreFormValues;
  setForm: React.Dispatch<React.SetStateAction<StoreFormValues>>;
  location: StoreLocation | null;
  onLocationChange: (loc: StoreLocation | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving?: boolean;
  submitLabel?: string;
  showAdminStoreTypesLink?: boolean;
  theme?: "admin" | "merchant";
};

const THEME_STYLES = {
  admin: {
    accent: "bg-indigo-600 hover:bg-indigo-700",
    ring: "focus:ring-indigo-500",
    summary: "border-indigo-100 bg-indigo-50 text-indigo-900",
    summaryMuted: "text-indigo-700",
  },
  merchant: {
    accent: "bg-orange-500 hover:bg-orange-600",
    ring: "focus:ring-orange-500",
    summary: "border-orange-100 bg-orange-50 text-orange-900",
    summaryMuted: "text-orange-700",
  },
};

export default function StoreCreateForm({
  storeTypes,
  form,
  setForm,
  location,
  onLocationChange,
  onSubmit,
  onCancel,
  saving = false,
  submitLabel = "Create store",
  showAdminStoreTypesLink = false,
  theme = "admin",
}: Props) {
  const ui = THEME_STYLES[theme];
  const vertical = resolveFormVertical(form, storeTypes);
  const meta = getVerticalMeta(vertical);
  const hasTags = form.storeTypeIds.length > 0;
  const moduleOptions: StoreVertical[] = ["FOOD", "GROCERY", "PHARMACY"];
  const activeModule = form.moduleVertical || vertical;
  const moduleTags = activeModule
    ? storeTypes.filter((t) => t.vertical === activeModule)
    : [];
  const selectedTags = storeTypes.filter((t) => form.storeTypeIds.includes(t._id));

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">1. Module & category tags</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Choose the module, then select every tag that fits — e.g. Fast Food, Pizza, and Desserts
            for a burger & pizza spot.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {moduleOptions.map((v) => {
            const active = activeModule === v;
            const label = getVerticalMeta(v).label;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setForm((prev) => setStoreModule(prev, v))}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {activeModule ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {moduleTags.map((t) => {
              const selected = form.storeTypeIds.includes(t._id);
              return (
                <button
                  key={t._id}
                  type="button"
                  onClick={() =>
                    setForm((prev) => toggleStoreTypeId(prev, storeTypes, t._id))
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? theme === "admin"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                        : "border-orange-500 bg-orange-50 text-orange-800"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {t.emoji} {t.name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Select a module first, then pick one or more tags.</p>
        )}
        {showAdminStoreTypesLink ? (
          <p className="text-xs text-gray-500">
            Missing a tag? Add it under{" "}
            <Link href="/store-types" className="text-indigo-600 font-medium hover:underline">
              Store types
            </Link>
            .
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            Pick every tag that describes what the store sells so customers can find it in search.
          </p>
        )}
        {selectedTags.length > 0 ? (
          <div className={`rounded-lg border px-3 py-2 text-sm ${ui.summary}`}>
            <span className={ui.summaryMuted}>Selected ({selectedTags.length}): </span>
            <span className="font-medium">
              {selectedTags.map((t) => `${t.emoji} ${t.name}`).join(" · ")}
            </span>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">2. Store details</h4>
          <p className="text-xs text-gray-500 mt-0.5">Name and short description customers will see.</p>
        </div>
        <div>
          <Label htmlFor="storeName">Store name</Label>
          <Input
            id="storeName"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={meta.namePlaceholder}
            required
            disabled={!hasTags}
          />
        </div>
        <div>
          <Label htmlFor="storeDesc">Short description (optional)</Label>
          <textarea
            id="storeDesc"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What do you sell? e.g. Jollof, fresh produce, OTC medicines…"
            rows={2}
            disabled={!hasTags}
            className={`mt-1 flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 ${ui.ring} disabled:opacity-60`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">3. Delivery settings</h4>
          <p className="text-xs text-gray-500 mt-0.5">Fees and timing shown at checkout.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="deliveryFee">
              Delivery fee (GH₵)
              {vertical === "FOOD" ? " (distance-based for Food)" : ""}
            </Label>
            <Input
              id="deliveryFee"
              type="number"
              min="0"
              step="0.01"
              value={form.deliveryFee}
              onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })}
              required={vertical !== "FOOD"}
              disabled={vertical === "FOOD" || !hasTags}
            />
            {vertical === "FOOD" ? (
              <p className="text-xs text-gray-500 mt-1">
                Food delivery cost is calculated automatically on the customer cart using distance.
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="minOrder">Minimum order (GH₵)</Label>
            <Input
              id="minOrder"
              type="number"
              min="0"
              step="0.01"
              value={form.minOrderAmount}
              onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
              disabled={!hasTags}
            />
          </div>
          <div>
            <Label htmlFor="prepTime">{meta.prepLabel}</Label>
            <Input
              id="prepTime"
              type="number"
              min="5"
              value={form.estimatedPrepMinutes}
              onChange={(e) => setForm({ ...form, estimatedPrepMinutes: e.target.value })}
              disabled={!hasTags}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.allowsPickup}
            onChange={(e) => setForm({ ...form, allowsPickup: e.target.checked })}
            disabled={!hasTags}
            className="rounded border-gray-300"
          />
          Customers can pick up orders at this store (no delivery fee)
        </label>
      </section>

      <section className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">4. Store location</h4>
          <p className="text-xs text-gray-500 mt-0.5">Search or tap the map — riders use this for pickup.</p>
        </div>
        <StoreLocationPicker
          value={location}
          address={form.address}
          onLocationChange={onLocationChange}
          onAddressChange={(addr) => setForm((f) => ({ ...f, address: addr }))}
          mapHeight={220}
        />
      </section>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving || !hasTags}
          className={`w-full sm:w-auto text-white ${ui.accent}`}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null}
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export { EMPTY_STORE_FORM } from "@/lib/storeForm";
