"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, Loader2, MessageSquareWarning, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fetcher } from "@/lib/api";
import { notify } from "@/lib/notify";

export type ReviewStatus = "draft" | "pending" | "changes_requested" | "approved";
export type Readiness = {
  ready: boolean;
  items: { key: string; label: string; done: boolean; hint?: string }[];
};

/** Where each checklist item is fixed. */
const FIX_PATH: Record<string, string> = {
  photo: "/settings#store-profile",
  location: "/settings#store-location",
  hours: "/settings#store-hours",
  licence: "/settings#store-licence",
  menu: "/menu",
};

export function reviewBadge(status: ReviewStatus, isActive: boolean) {
  if (status === "pending") return { label: "In review", className: "bg-blue-100 text-blue-700" };
  if (status === "changes_requested") return { label: "Changes needed", className: "bg-amber-100 text-amber-800" };
  if (status === "draft") return { label: "Not live yet", className: "bg-gray-100 text-gray-700" };
  return isActive
    ? { label: "Live", className: "bg-green-100 text-green-700" }
    : { label: "Hidden by QareGO", className: "bg-gray-100 text-gray-600" };
}

/**
 * Steps a new store must finish before QareGO reviews it and puts it live.
 * `onOpen(path)` switches to this store (if needed) and opens the page that fixes an item.
 */
export function GoLiveChecklist({
  restaurantId,
  status,
  readiness,
  note,
  compact = false,
  onOpen,
  onSubmitted,
}: {
  restaurantId: string;
  status: ReviewStatus;
  readiness: Readiness;
  note?: string | null;
  compact?: boolean;
  onOpen: (path: string) => void;
  onSubmitted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  if (status === "approved") return null;

  const done = readiness.items.filter((i) => i.done).length;
  const total = readiness.items.length;

  const submit = async () => {
    setSubmitting(true);
    try {
      await fetcher("/merchant/restaurant/submit-review", {
        method: "POST",
        headers: { "x-restaurant-id": restaurantId },
      });
      notify.success("Sent for review", "QareGO will check your store and let you know.");
      onSubmitted();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not send for review");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "pending") {
    return (
      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Waiting for QareGO to review</p>
          <p className="text-blue-800">
            We check every new store before customers can see it, and we&apos;ll let you know. You can keep editing
            your menu meanwhile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${status === "changes_requested" ? "border-amber-200" : "border-border"} bg-white`}>
      {status === "changes_requested" && note ? (
        <div className="flex gap-3 rounded-t-xl border-b border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">QareGO asked for changes</p>
            <p className="whitespace-pre-line">{note}</p>
          </div>
        </div>
      ) : null}

      <div className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">
            {status === "changes_requested" ? "Fix and send again" : "Get ready to go live"}
          </p>
          <span className="text-xs text-muted">
            {done} of {total} done
          </span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>

        <ul className={compact ? "space-y-1" : "space-y-2"}>
          {readiness.items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onOpen(FIX_PATH[item.key] ?? "/settings")}
                className="flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left hover:bg-gray-50"
              >
                {item.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                )}
                <span className="min-w-0">
                  <span className={`block text-sm ${item.done ? "text-gray-500" : "text-foreground"}`}>{item.label}</span>
                  {!item.done && !compact && item.hint ? (
                    <span className="block text-xs text-muted">{item.hint}</span>
                  ) : null}
                </span>
                {!item.done ? <span className="ml-auto shrink-0 text-xs font-medium text-brand">Fix</span> : null}
              </button>
            </li>
          ))}
        </ul>

        <Button className="mt-3 w-full" disabled={!readiness.ready || submitting} onClick={submit}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="mr-1 inline h-4 w-4" />
              {status === "changes_requested" ? "Send again for review" : "Submit for review"}
            </>
          )}
        </Button>
        {!readiness.ready ? (
          <p className="mt-2 text-center text-xs text-muted">Finish every step to submit.</p>
        ) : null}
      </div>
    </div>
  );
}
