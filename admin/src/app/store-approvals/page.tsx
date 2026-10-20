"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileX,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { fetcher } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type ReviewStatus = "draft" | "pending" | "changes_requested";
type DayHours = { closed: boolean; open: string; close: string };
type StoreForReview = {
  _id: string;
  name: string;
  imageEmoji?: string;
  imageUrl?: string | null;
  vertical: string;
  address: string;
  latitude: number;
  longitude: number;
  openingHours?: DayHours[];
  licence?: { url?: string | null; number?: string | null };
  licenceLabel: string | null;
  review?: { note?: string | null; submittedAt?: string | null; decidedAt?: string | null };
  reviewStatus: ReviewStatus;
  owner?: { _id: string; name?: string; username?: string; phone?: string } | null;
  createdAt: string;
  readiness: { ready: boolean; items: { key: string; label: string; done: boolean; hint?: string }[] };
};

const VERTICAL_LABEL: Record<string, string> = {
  FOOD: "Food",
  GROCERY: "Groceries",
  PHARMACY: "Pharmacy",
  GAS: "Cooking gas",
};

const STATUS_BADGE: Record<ReviewStatus, { label: string; className: string }> = {
  pending: { label: "Waiting", className: "bg-blue-100 text-blue-800" },
  changes_requested: { label: "Sent back", className: "bg-amber-100 text-amber-800" },
  draft: { label: "Setting up", className: "bg-gray-100 text-gray-600" },
};

const QUICK_REASONS = [
  "The licence photo is hard to read. Please upload a clearer one.",
  "The licence number doesn't match the photo.",
  "The map pin isn't at your shop. Please move it to the entrance.",
  "Please add clearer photos of your items.",
  "Your store photo should show your shop or brand.",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function since(date?: string | null) {
  if (!date) return "";
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const b = STATUS_BADGE[status];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${b.className}`}>{b.label}</span>;
}

function StoreQueue() {
  const params = useSearchParams();
  const [stores, setStores] = useState<StoreForReview[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetcher("/admin/store-reviews");
      setStores(data.stores ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load stores");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  const list = stores ?? [];
  const selected = list.find((s) => s._id === selectedId) ?? list[0] ?? null;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Store approvals</h1>
          <p className="text-sm text-gray-500">
            Stores vendors set up themselves stay hidden from customers until you approve them.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {stores === null ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Store className="h-10 w-10 text-emerald-500" />
            <p className="font-medium text-gray-900">No stores waiting</p>
            <p className="text-sm text-gray-500">New stores appear here when a vendor creates one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit">
            <ul className="divide-y divide-gray-100">
              {list.map((s) => {
                const active = selected?._id === s._id;
                const photo = resolveMediaUrl(s.imageUrl);
                return (
                  <li key={s._id}>
                    <button
                      onClick={() => setSelectedId(s._id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 ${
                        active ? "bg-blue-50/70" : ""
                      }`}
                    >
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-lg">
                          {s.imageEmoji || "🏪"}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{s.name}</span>
                        <span className="block truncate text-xs text-gray-500">
                          {VERTICAL_LABEL[s.vertical] ?? s.vertical}
                          {s.reviewStatus === "pending"
                            ? ` · sent ${since(s.review?.submittedAt)}`
                            : s.reviewStatus === "changes_requested"
                            ? ` · sent back ${since(s.review?.decidedAt)}`
                            : ` · ${s.readiness.items.filter((i) => i.done).length}/${s.readiness.items.length} done`}
                        </span>
                      </span>
                      <StatusBadge status={s.reviewStatus} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {selected ? (
            // Re-mount when the store is resubmitted so the decision panel resets.
            <StoreReview key={`${selected._id}-${selected.review?.submittedAt ?? ""}`} store={selected} onDone={load} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function StoreReview({ store, onDone }: { store: StoreForReview; onDone: () => void }) {
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [note, setNote] = useState("");
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const missing = store.readiness.items.filter((i) => !i.done);
  const photo = resolveMediaUrl(store.imageUrl);
  const licencePhoto = resolveMediaUrl(store.licence?.url);
  const phone = store.owner?.phone;

  const submit = async (decision: "approve" | "request_changes") => {
    setBusy(true);
    try {
      await fetcher(`/admin/restaurants/${store._id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, note: note.trim(), override }),
      });
      setDone(
        decision === "approve"
          ? "Approved. The store is live and the vendor has been notified."
          : "Sent back. The vendor sees your note in their portal."
      );
      setTimeout(onDone, 1200);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't save the review");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  {store.imageEmoji} {store.name}
                </h2>
                <StatusBadge status={store.reviewStatus} />
              </div>
              <p className="text-sm text-gray-500">
                {VERTICAL_LABEL[store.vertical] ?? store.vertical} · created {new Date(store.createdAt).toLocaleDateString()}
                {store.review?.submittedAt ? ` · sent for review ${since(store.review.submittedAt)}` : ""}
              </p>
            </div>
            <Link
              href={`/restaurants/${store._id}`}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <UtensilsCrossed className="h-3.5 w-3.5" /> View items
            </Link>
          </div>

          {store.reviewStatus === "changes_requested" && store.review?.note ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              You asked{store.review.decidedAt ? ` on ${new Date(store.review.decidedAt).toLocaleDateString()}` : ""}: “
              {store.review.note}”
            </div>
          ) : null}

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">Vendor</dt>
              <dd className="text-gray-900">
                {store.owner?.name || store.owner?.username || "—"}
                {store.owner?.username ? <span className="text-gray-500"> (@{store.owner.username})</span> : null}
              </dd>
              {phone ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Phone className="h-3 w-3" /> {phone}
                  </a>
                  <a
                    href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-green-200 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                  >
                    <MessageCircle className="h-3 w-3" /> WhatsApp
                  </a>
                </div>
              ) : null}
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">Address</dt>
              <dd className="text-gray-900">{store.address}</dd>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${store.latitude},${store.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                <MapPin className="h-3 w-3" /> Check the pin on Google Maps
              </a>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-xs text-gray-500">Opening hours</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {store.openingHours?.length === 7 ? (
                  store.openingHours.map((d, i) => (
                    <span
                      key={DAYS[i]}
                      className={`rounded-md px-2 py-0.5 text-xs ${d.closed ? "bg-gray-100 text-gray-400" : "bg-gray-50 text-gray-700"}`}
                    >
                      {DAYS[i]} {d.closed ? "closed" : `${d.open}–${d.close}`}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400">Not set</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Doc label="Store photo" url={photo} required />
            {store.licenceLabel ? (
              <Doc
                label={store.licenceLabel}
                url={licencePhoto}
                required
                caption={store.licence?.number ? `Number: ${store.licence.number}` : "No number entered"}
              />
            ) : null}
          </div>

          <h3 className="mb-2 mt-6 text-sm font-semibold text-gray-900">Checklist</h3>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {store.readiness.items.map((i) => (
              <li key={i.key} className="flex items-start gap-2 text-sm">
                {i.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                )}
                <span className={i.done ? "text-gray-700" : "text-gray-900"}>
                  {i.label}
                  {i.key === "menu" && i.hint ? <span className="text-gray-400"> · {i.hint}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          {done ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> {done}
            </p>
          ) : mode === "changes" ? (
            <div className="space-y-3">
              <label htmlFor="review-note" className="text-sm font-medium text-gray-800">
                What should the vendor fix? They see this in their portal and get a notification.
              </label>
              <div className="flex flex-wrap gap-2">
                {QUICK_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNote((n) => (n ? `${n} ${r}` : r))}
                    className="rounded-full border px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    {r.split(".")[0]}
                  </button>
                ))}
              </div>
              <textarea
                id="review-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                placeholder="e.g. The licence photo is blurry. Please upload a clearer one."
              />
              <div className="flex gap-2">
                <Button
                  disabled={busy || !note.trim()}
                  onClick={() => submit("request_changes")}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  Send to vendor
                </Button>
                <Button variant="outline" onClick={() => setMode("idle")}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {store.reviewStatus === "draft" ? (
                <p className="text-sm text-gray-600">
                  The vendor hasn&apos;t sent this store for review yet. You can still approve it, or tell them what&apos;s
                  missing.
                </p>
              ) : null}
              {missing.length ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Missing: {missing.map((m) => m.label.toLowerCase()).join(", ")}.{" "}
                    <label className="ml-1 inline-flex items-center gap-1">
                      <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Approve
                      anyway
                    </label>
                  </span>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || (missing.length > 0 && !override)}
                  onClick={() => submit("approve")}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="mr-1 inline h-4 w-4" /> Approve and put live
                </Button>
                <Button variant="outline" onClick={() => setMode("changes")}>
                  Request changes
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Doc({ label, url, required, caption }: { label: string; url: string | null; required?: boolean; caption?: string }) {
  return (
    <figure className="min-w-0">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="group relative block aspect-[4/3] overflow-hidden rounded-xl border bg-gray-50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="h-full w-full object-cover transition group-hover:scale-105" />
          <span className="absolute right-2 top-2 rounded-md bg-white/90 p-1 text-gray-700 opacity-0 transition group-hover:opacity-100">
            <ExternalLink className="h-3.5 w-3.5" />
          </span>
        </a>
      ) : (
        <div
          className={`flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs ${
            required ? "border-red-200 bg-red-50/50 text-red-600" : "border-gray-200 text-gray-400"
          }`}
        >
          <FileX className="h-5 w-5" />
          Missing
        </div>
      )}
      <figcaption className="mt-1.5 text-xs font-medium text-gray-600">
        {label}
        {caption ? <span className="block font-normal text-gray-500">{caption}</span> : null}
      </figcaption>
    </figure>
  );
}

export default function StoreApprovalsPage() {
  return (
    <Suspense fallback={null}>
      <StoreQueue />
    </Suspense>
  );
}
