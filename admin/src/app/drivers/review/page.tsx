"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileX, Loader2, Pencil, RefreshCw, UserCheck } from "lucide-react";
import { fetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

type Review = {
  decision?: "approved" | "changes_requested" | "resubmitted" | null;
  note?: string | null;
  at?: string | null;
};
type PendingRider = {
  _id: string;
  name?: string;
  phone?: string;
  email?: string;
  createdAt: string;
  missing: string[];
  driverDetails?: {
    dob?: string;
    gender?: string;
    profileImage?: string;
    licenseNumber?: string;
    licenseFront?: string;
    licenseBack?: string;
    nationalId?: string;
    policeClearance?: string;
    vehicle?: {
      make?: string;
      model?: string;
      year?: string;
      plateNumber?: string;
      color?: string;
      category?: string;
      registrationDoc?: string;
      insuranceDoc?: string;
    };
    review?: Review;
  };
};

const VEHICLE_LABEL: Record<string, string> = { motorcycle: "Motorcycle", pragya: "Pragya", comfort: "Car" };

const QUICK_REASONS = [
  "Your licence photo is blurry. Please retake it in good light.",
  "Please upload the back of your driver's licence.",
  "Your Ghana Card photo doesn't show your name clearly.",
  "Please add your vehicle's number plate.",
  "Your profile photo must clearly show your face.",
];

/** New and resubmitted riders first; riders who still owe changes go last. */
function queueRank(r: PendingRider) {
  const d = r.driverDetails?.review?.decision;
  if (d === "resubmitted") return 0;
  if (d === "changes_requested") return 2;
  return 1;
}

function ReviewBadge({ review }: { review?: Review }) {
  if (review?.decision === "resubmitted") {
    return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">Resubmitted</span>;
  }
  if (review?.decision === "changes_requested") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        Waiting on rider
      </span>
    );
  }
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">New</span>;
}

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

function ReviewQueue() {
  const params = useSearchParams();
  const [riders, setRiders] = useState<PendingRider[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetcher("/drivers/review/pending");
      setRiders(data.riders ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load riders");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  const sorted = useMemo(
    () =>
      [...(riders ?? [])].sort(
        (a, b) => queueRank(a) - queueRank(b) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [riders]
  );
  const selected = sorted.find((r) => r._id === selectedId) ?? sorted[0] ?? null;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Rider approvals</h1>
          <p className="text-sm text-gray-500">Check each new rider&apos;s documents, then approve or ask for changes.</p>
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

      {riders === null ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <UserCheck className="h-10 w-10 text-emerald-500" />
            <p className="font-medium text-gray-900">No riders waiting</p>
            <p className="text-sm text-gray-500">New sign-ups appear here for review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit">
            <ul className="divide-y">
              {sorted.map((r) => {
                const active = selected?._id === r._id;
                return (
                  <li key={r._id}>
                    <button
                      onClick={() => setSelectedId(r._id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 ${
                        active ? "bg-blue-50/70" : ""
                      }`}
                    >
                      {r.driverDetails?.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.driverDetails.profileImage} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                          {(r.name || "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{r.name || "New rider"}</span>
                        <span className="block text-xs text-gray-500">
                          Signed up {daysAgo(r.createdAt)}
                          {r.missing.length ? ` · ${r.missing.length} missing` : ""}
                        </span>
                      </span>
                      <ReviewBadge review={r.driverDetails?.review} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {selected ? (
            // Re-mount when the review changes (e.g. the rider resubmitted) so the panel resets.
            <RiderReview
              key={`${selected._id}-${selected.driverDetails?.review?.at ?? ""}`}
              rider={selected}
              onDone={load}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function RiderReview({ rider, onDone }: { rider: PendingRider; onDone: () => void }) {
  const d = rider.driverDetails ?? {};
  const v = d.vehicle ?? {};
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [note, setNote] = useState("");
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (decision: "approve" | "request_changes") => {
    setBusy(true);
    try {
      await fetcher(`/drivers/${rider._id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, note: note.trim(), override }),
      });
      setDone(decision === "approve" ? "Approved. The rider has been notified." : "Sent. The rider has been notified.");
      setTimeout(onDone, 1200);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't save the review");
    } finally {
      setBusy(false);
    }
  };

  const docs: { label: string; url?: string; required?: boolean }[] = [
    { label: "Licence (front)", url: d.licenseFront, required: true },
    { label: "Licence (back)", url: d.licenseBack, required: true },
    { label: "Ghana Card", url: d.nationalId, required: true },
    { label: "Profile photo", url: d.profileImage },
    { label: "Vehicle registration", url: v.registrationDoc },
    { label: "Insurance", url: v.insuranceDoc },
    { label: "Police clearance", url: d.policeClearance },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{rider.name || "New rider"}</h2>
                <ReviewBadge review={d.review} />
              </div>
              <p className="text-sm text-gray-500">
                {rider.phone}
                {rider.email ? ` · ${rider.email}` : ""} · signed up {new Date(rider.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Link
              href={`/drivers/${rider._id}/edit`}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit / upload documents
            </Link>
          </div>

          {d.review?.decision === "changes_requested" && d.review.note ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              You asked on {d.review.at ? new Date(d.review.at).toLocaleDateString() : "—"}: “{d.review.note}”
            </div>
          ) : null}
          {d.review?.decision === "resubmitted" ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              The rider updated their documents{d.review.at ? ` on ${new Date(d.review.at).toLocaleDateString()}` : ""}
              {d.review.note ? ` after you asked: “${d.review.note}”` : "."}
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <Info label="Vehicle" value={v.category ? VEHICLE_LABEL[v.category] ?? v.category : undefined} />
            <Info label="Make & model" value={[v.make, v.model, v.year].filter(Boolean).join(" ") || undefined} />
            <Info label="Number plate" value={v.plateNumber} />
            <Info label="Colour" value={v.color} />
            <Info label="Licence number" value={d.licenseNumber} />
            <Info label="Date of birth" value={d.dob} />
            <Info label="Gender" value={d.gender} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Documents</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {docs.map((doc) => (
              <figure key={doc.label} className="min-w-0">
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block aspect-[4/3] overflow-hidden rounded-xl border bg-gray-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={doc.url} alt={doc.label} className="h-full w-full object-cover transition group-hover:scale-105" />
                    <span className="absolute right-2 top-2 rounded-md bg-white/90 p-1 text-gray-700 opacity-0 transition group-hover:opacity-100">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </a>
                ) : (
                  <div
                    className={`flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs ${
                      doc.required ? "border-red-200 bg-red-50/50 text-red-600" : "border-gray-200 text-gray-400"
                    }`}
                  >
                    <FileX className="h-5 w-5" />
                    {doc.required ? "Missing" : "Not uploaded"}
                  </div>
                )}
                <figcaption className="mt-1.5 text-xs font-medium text-gray-600">
                  {doc.label}
                  {doc.required ? <span className="text-red-500"> *</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
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
                What should the rider fix? They see this in the app and get a notification.
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
                placeholder="e.g. Your licence photo is blurry. Please retake it in good light."
              />
              <div className="flex gap-2">
                <Button disabled={busy || !note.trim()} onClick={() => submit("request_changes")} className="bg-amber-500 hover:bg-amber-600">
                  Send to rider
                </Button>
                <Button variant="outline" onClick={() => setMode("idle")}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {rider.missing.length ? (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Missing: {rider.missing.join(", ")}.{" "}
                    <label className="ml-1 inline-flex items-center gap-1">
                      <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Approve
                      anyway
                    </label>
                  </span>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || (rider.missing.length > 0 && !override)}
                  onClick={() => submit("approve")}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="mr-1 inline h-4 w-4" /> Approve rider
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

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`truncate ${value ? "text-gray-900" : "text-gray-400"}`}>{value || "—"}</dd>
    </div>
  );
}

export default function RiderApprovalsPage() {
  return (
    <Suspense fallback={null}>
      <ReviewQueue />
    </Suspense>
  );
}
