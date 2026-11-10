"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Minus, Plus, X } from "lucide-react";
import ImageUploadField from "@/components/ImageUploadField";
import { resolveImageUrl } from "@/lib/resolveImageUrl";
import { laundryServiceLabel } from "@/lib/laundryOptions";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import type { FoodOrderRow } from "@/lib/orderTypes";

type PriceItem = { _id: string; name: string; price: number; category?: string; laundryService?: string | null };
const MAX_PHOTOS = 4;

/**
 * Count a laundry bag when it reaches the shop. Starts from what the customer chose; the shop
 * corrects the numbers from its own price list. If it comes to more than the estimate, the
 * customer is asked to approve before washing.
 */
export function LaundryCountModal({
  order,
  onClose,
  onCounted,
}: {
  order: FoodOrderRow | null;
  onClose: () => void;
  onCounted: () => void;
}) {
  const [priceList, setPriceList] = useState<PriceItem[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [uploadKey, setUploadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    let alive = true;
    const start: Record<string, number> = {};
    for (const i of order.items) if (i.menuItem) start[String(i.menuItem)] = (start[String(i.menuItem)] || 0) + i.quantity;
    const t = setTimeout(() => {
      setCounts(start);
      setError(null);
      setPhotos(order.laundry?.countPhotos ?? []);
      setNote(order.laundry?.countNote ?? "");
      fetcher("/merchant/menu")
        .then((d) => alive && setPriceList((d.menuItems ?? []) as PriceItem[]))
        .catch((e) => alive && setError(e instanceof Error ? e.message : "Couldn't load your price list"));
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [order]);

  const total = useMemo(
    () => (priceList ?? []).reduce((s, p) => s + p.price * (counts[p._id] || 0), 0),
    [priceList, counts]
  );
  const itemCount = Object.values(counts).reduce((n, q) => n + q, 0);

  if (!order) return null;
  const estimate = order.laundry?.estimatedSubtotal ?? order.subtotal;
  const dearer = total > estimate + 0.004;

  const set = (id: string, q: number) => setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(500, q)) }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await fetcher(`/merchant/orders/${order._id}/laundry-count`, {
        method: "POST",
        body: JSON.stringify({
          items: Object.entries(counts)
            .filter(([, q]) => q > 0)
            .map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
          photos,
          note: note.trim() || undefined,
        }),
      });
      onCounted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the count");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Count ${order.customer?.name ? `${order.customer.name}'s` : "the"} laundry`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          The customer estimated <strong>{order.laundry?.estimatedItemCount ?? "?"} items</strong> (
          {formatCurrency(estimate)}). Correct the numbers to what&apos;s in the bag.
        </p>

        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        {priceList === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <ul className="max-h-[50vh] divide-y divide-gray-100 overflow-y-auto rounded-xl border border-border">
            {priceList.map((p) => {
              const q = counts[p._id] || 0;
              return (
                <li key={p._id} className={`flex items-center gap-3 px-3 py-2.5 ${q ? "bg-brand/5" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
                    <span className="block text-xs text-muted">
                      {formatCurrency(p.price)} each
                      {laundryServiceLabel(p.laundryService) ? ` · ${laundryServiceLabel(p.laundryService)}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`One less ${p.name}`}
                      onClick={() => set(p._id, q - 1)}
                      disabled={!q}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-gray-700 disabled:opacity-30"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      aria-label={`${p.name} count`}
                      inputMode="numeric"
                      value={q}
                      onChange={(e) => set(p._id, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)}
                      className="h-8 w-12 rounded-lg border border-border text-center text-sm font-semibold"
                    />
                    <button
                      type="button"
                      aria-label={`One more ${p.name}`}
                      onClick={() => set(p._id, q + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-gray-700"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
          <span className="text-sm text-gray-600">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
          <span className="text-lg font-bold text-foreground">{formatCurrency(total)}</span>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">Photos (optional)</p>
          <p className="text-xs text-muted">
            Snap stains, damage or anything worth noting. The customer sees them with the price.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((url) => (
              <div key={url} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveImageUrl(url) ?? url} alt="Count photo" className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setPhotos((list) => list.filter((u) => u !== url))}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          {photos.length < MAX_PHOTOS ? (
            <div className="mt-2">
              <ImageUploadField
                key={uploadKey}
                label="Add a photo"
                folder="laundry"
                aspect="document"
                value=""
                onChange={(url) => {
                  if (url) setPhotos((list) => [...list, url].slice(0, MAX_PHOTOS));
                  setUploadKey((k) => k + 1);
                }}
              />
            </div>
          ) : null}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="Stain on the white shirt, one button missing"
            className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>

        {dearer ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            That&apos;s {formatCurrency(total - estimate)} more than the estimate. The customer will be asked to approve
            before you wash. If they say no, it goes back unwashed.
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !itemCount || priceList === null}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : dearer ? "Send new price to customer" : "Confirm count"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
