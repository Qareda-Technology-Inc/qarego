"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/resolveImageUrl";
import type { FoodOrderRow } from "@/lib/orderTypes";

type Row = { name: string; quantity: string; price: string };
type Product = { _id: string; name: string; price: number };

const emptyRow = (): Row => ({ name: "", quantity: "1", price: "" });
const money = (v: string) => Math.round((parseFloat(v) || 0) * 100) / 100;
const qty = (v: string) => Math.max(1, parseInt(v, 10) || 1);

/**
 * Price a prescription request: read the photo, write each medicine with its price, list what you
 * don't have. The customer approves before you pack anything (and pays first if it's MoMo).
 */
export function PharmacyQuoteModal({
  order,
  onClose,
  onQuoted,
}: {
  order: FoodOrderRow | null;
  onClose: () => void;
  onQuoted: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [unavailable, setUnavailable] = useState("");
  const [note, setNote] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    let alive = true;
    const t = setTimeout(() => {
      // Changing a price already sent: start from it.
      const q = order.pharmacyQuote;
      setRows(
        order.items?.length
          ? order.items.map((i) => ({ name: i.name, quantity: String(i.quantity), price: String(i.price) }))
          : [emptyRow()]
      );
      setUnavailable((q?.unavailable ?? []).join(", "));
      setNote(q?.pharmacistNote ?? "");
      setError(null);
      // Your product list, so typing a name can fill in its price.
      fetcher("/merchant/menu")
        .then((d) => alive && setProducts((d.menuItems ?? []) as Product[]))
        .catch(() => {});
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [order]);

  const subtotal = useMemo(() => rows.reduce((s, r) => s + money(r.price) * (r.name.trim() ? qty(r.quantity) : 0), 0), [rows]);
  const filled = rows.filter((r) => r.name.trim() && money(r.price) > 0);

  if (!order) return null;

  const update = (i: number, patch: Partial<Row>) =>
    setRows((list) =>
      list.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, ...patch };
        // Picked a product from the list: use its price unless one is already typed.
        if (patch.name !== undefined && !r.price) {
          const match = products.find((p) => p.name.toLowerCase() === patch.name!.trim().toLowerCase());
          if (match) next.price = String(match.price);
        }
        return next;
      })
    );

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await fetcher(`/merchant/orders/${order._id}/pharmacy-quote`, {
        method: "POST",
        body: JSON.stringify({
          items: filled.map((r) => ({ name: r.name.trim(), quantity: qty(r.quantity), price: money(r.price) })),
          unavailable: unavailable
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          note: note.trim() || undefined,
        }),
      });
      onQuoted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the price");
    } finally {
      setBusy(false);
    }
  };

  const photos = (order.prescriptionUrls ?? []).map((u) => resolveImageUrl(u)).filter(Boolean) as string[];
  const request = order.pharmacyQuote?.request;

  return (
    <Modal isOpen onClose={onClose} title={`Price ${order.customer?.name ? `${order.customer.name}'s` : "this"} prescription`}>
      <div className="space-y-4">
        {photos.length ? (
          <div className="flex gap-2 overflow-x-auto">
            {photos.map((src) => (
              <a
                key={src}
                href={src}
                target="_blank"
                rel="noreferrer"
                className="block h-40 w-32 shrink-0 overflow-hidden rounded-xl border border-border bg-slate-50"
                title="Open full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Prescription" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        ) : null}
        {request ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="font-medium">Customer wrote:</span> {request}
          </p>
        ) : null}

        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <div>
          <div className="mb-1 grid grid-cols-[1fr_4rem_6rem_2rem] gap-2 px-1 text-xs font-medium text-muted">
            <span>Medicine</span>
            <span>Qty</span>
            <span>Price each</span>
            <span />
          </div>
          <datalist id="pharmacy-products">
            {products.map((p) => (
              <option key={p._id} value={p.name} />
            ))}
          </datalist>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[1fr_4rem_6rem_2rem] items-center gap-2">
                <input
                  aria-label="Medicine"
                  list="pharmacy-products"
                  value={r.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="e.g. Amoxicillin 500mg"
                  className="h-10 rounded-lg border border-border px-3 text-sm"
                />
                <input
                  aria-label="Quantity"
                  inputMode="numeric"
                  value={r.quantity}
                  onChange={(e) => update(i, { quantity: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                  className="h-10 rounded-lg border border-border text-center text-sm"
                />
                <input
                  aria-label="Price each (GH₵)"
                  inputMode="decimal"
                  value={r.price}
                  onChange={(e) => update(i, { price: e.target.value.replace(/[^\d.]/g, "") })}
                  placeholder="0.00"
                  className="h-10 rounded-lg border border-border px-2 text-right text-sm"
                />
                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() => setRows((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : [emptyRow()]))}
                  className="flex h-10 w-8 items-center justify-center text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setRows((list) => [...list, emptyRow()])}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            <Plus className="h-4 w-4" /> Add medicine
          </button>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-foreground">Not in stock</span>
          <span className="ml-1 text-xs text-muted">(separate with commas)</span>
          <input
            value={unavailable}
            onChange={(e) => setUnavailable(e.target.value)}
            placeholder="e.g. Vitamin C syrup"
            className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-foreground">Note for the customer</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="e.g. We used the generic version, same medicine."
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>

        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
          <span className="text-sm text-gray-600">Medicines (what you receive, before commission)</span>
          <span className="text-lg font-bold text-foreground">{formatCurrency(subtotal)}</span>
        </div>
        <p className="text-xs text-muted">
          The customer sees this with the service and delivery fees and approves it before you pack anything.
          {order.paymentMethod === "MOBILE_MONEY" ? " They pay by MoMo first, then the order moves to Preparing." : ""}
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !filled.length}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send price to customer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
