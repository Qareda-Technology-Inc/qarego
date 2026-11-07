"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { fetcher } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { formatCurrency } from "@/lib/currency";
import { Loader2, Search, Store, X } from "lucide-react";

export type PromoChoice = {
  kind: "item" | "store";
  id: string;
  name: string;
  imageUrl: string | null;
  restaurantName: string;
  price: number | null;
  vertical: string;
};

type SearchItem = {
  _id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  restaurantName: string;
  vertical: string;
};

type SearchStore = {
  _id: string;
  name: string;
  vertical: string;
  imageUrl: string | null;
  imageEmoji?: string;
  address?: string;
};

/**
 * Pick a menu item or store already in the app to promote. Its own photo goes with the
 * message, so nothing is uploaded here.
 */
export function PromoPicker({
  value,
  onChange,
}: {
  value: PromoChoice | null;
  onChange: (choice: PromoChoice | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [stores, setStores] = useState<SearchStore[]>([]);

  useEffect(() => {
    if (value) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetcher(
          `/admin/push-broadcast/promo-search?q=${encodeURIComponent(query.trim())}`
        );
        if (cancelled) return;
        setItems(data.items || []);
        setStores(data.stores || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, value]);

  if (value) {
    const src = resolveMediaUrl(value.imageUrl);
    return (
      <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-14 w-14 rounded-md object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-white">
            <Store className="h-6 w-6 text-gray-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{value.name}</p>
          <p className="truncate text-xs text-gray-600">
            {value.kind === "item"
              ? `${value.restaurantName}${value.price != null ? ` · ${formatCurrency(value.price)}` : ""}`
              : "Store · opens its menu"}
          </p>
          {!src ? <p className="text-xs text-amber-700">No photo, so the message goes out as text.</p> : null}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded p-1 text-gray-500 hover:bg-white hover:text-gray-900"
          aria-label="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search menu items or stores, e.g. pizza"
          className="pl-9"
        />
      </div>

      {loading && !items.length && !stores.length ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : null}

      {items.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Items with photos
          </p>
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
            {items.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() =>
                  onChange({
                    kind: "item",
                    id: item._id,
                    name: item.name,
                    imageUrl: item.imageUrl,
                    restaurantName: item.restaurantName,
                    price: item.price,
                    vertical: item.vertical,
                  })
                }
                className="overflow-hidden rounded-lg border border-gray-200 text-left hover:border-indigo-400"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveMediaUrl(item.imageUrl) || ""}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="p-2">
                  <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="truncate text-xs text-gray-500">{item.restaurantName}</p>
                  <p className="text-xs text-gray-700">
                    {formatCurrency(item.price)}
                    {!item.isAvailable ? <span className="ml-1 text-amber-700">· off menu</span> : null}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {stores.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Stores</p>
          <div className="flex flex-wrap gap-2">
            {stores.map((store) => {
              const src = resolveMediaUrl(store.imageUrl);
              return (
                <button
                  key={store._id}
                  type="button"
                  onClick={() =>
                    onChange({
                      kind: "store",
                      id: store._id,
                      name: store.name,
                      imageUrl: store.imageUrl,
                      restaurantName: store.name,
                      price: null,
                      vertical: store.vertical,
                    })
                  }
                  className="flex items-center gap-2 rounded-full border border-gray-200 py-1 pl-1 pr-3 text-sm hover:border-indigo-400"
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100">
                      {store.imageEmoji || "🏪"}
                    </span>
                  )}
                  {store.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!loading && !items.length && !stores.length ? (
        <p className="py-2 text-center text-sm text-gray-500">
          Nothing found{query.trim() ? ` for "${query.trim()}"` : ""}.
        </p>
      ) : null}
    </div>
  );
}

/** A starting title and message for a promotion; the admin can edit both. */
export function promoDraftText(choice: PromoChoice): { title: string; body: string } {
  const emoji =
    ({ FOOD: "🍽️", GROCERY: "🛒", PHARMACY: "💊", GAS: "🔥", LAUNDRY: "🧺" } as Record<string, string>)[
      choice.vertical
    ] || "✨";
  if (choice.kind === "item") {
    return {
      title: `Order ${choice.name} now on QareGO ${emoji}`,
      body: `${choice.name} from ${choice.restaurantName}${
        choice.price != null ? ` for ${formatCurrency(choice.price)}` : ""
      }. Tap to order and we'll deliver it to you.`,
    };
  }
  return {
    title: `${choice.name} is on QareGO ${emoji}`,
    body: `Tap to see the menu and order from ${choice.name}. We'll deliver it to you.`,
  };
}
