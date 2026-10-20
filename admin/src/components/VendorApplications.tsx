"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Inbox, Loader2, Mail, MapPin, MessageCircle, Phone, Send, UserCheck } from "lucide-react";
import { fetcher } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { VendorLoginModal, type VendorLogin } from "@/components/VendorLoginModal";

type Status = "new" | "contacted" | "invited" | "declined";
type Application = {
  _id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email?: string | null;
  storeType: "FOOD" | "GROCERY" | "PHARMACY" | "GAS" | "LAUNDRY" | "OTHER";
  area: string;
  message?: string;
  status: Status;
  note?: string | null;
  createdAt: string;
  vendor?: { _id: string; name?: string; username?: string } | null;
  existingVendor?: { name?: string; username?: string } | null;
};

const TYPE_LABEL: Record<Application["storeType"], string> = {
  FOOD: "Restaurant",
  GROCERY: "Grocery",
  PHARMACY: "Pharmacy",
  GAS: "Gas station",
  LAUNDRY: "Laundry",
  OTHER: "Other",
};

const STATUS_BADGE: Record<Status, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-amber-100 text-amber-800",
  invited: "bg-emerald-100 text-emerald-800",
  declined: "bg-gray-100 text-gray-600",
};

const FILTERS = [
  { key: "open", label: "To follow up" },
  { key: "invited", label: "Invited" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
] as const;

function since(date: string) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Businesses that asked to sell on QareGO from the website, and inviting them. */
/** `onChanged` runs after any status change or invite, so the page can refresh its counts. */
export function VendorApplications({ onChanged }: { onChanged: () => void }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("open");
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState<VendorLogin | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetcher(`/admin/vendor-applications?status=${filter}`);
      setApps(data.applications ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load applications");
    }
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setApps(null);
              setFilter(f.key);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f.key ? "bg-gray-900 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
        <p className="ml-auto text-xs text-gray-500">From the “List your store” form on the website.</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : apps === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : apps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <Inbox className="h-9 w-9 text-gray-300" />
            <p className="font-medium text-gray-900">Nothing here</p>
            <p className="text-sm text-gray-500">New applications from the website show up in “To follow up”.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {apps.map((a) => (
            <ApplicationCard
              key={`${a._id}-${a.status}`}
              app={a}
              onChanged={() => {
                load();
                onChanged();
              }}
              onInvited={(l) => {
                setLogin(l);
                load();
                onChanged();
              }}
            />
          ))}
        </div>
      )}

      <VendorLoginModal login={login} onClose={() => setLogin(null)} />
    </div>
  );
}

function ApplicationCard({
  app,
  onChanged,
  onInvited,
}: {
  app: Application;
  onChanged: () => void;
  onInvited: (login: VendorLogin) => void;
}) {
  const [note, setNote] = useState(app.note ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [username, setUsername] = useState("");
  const open = app.status === "new" || app.status === "contacted";
  const digits = app.phone.replace(/\D/g, "");

  const update = async (patch: { status?: Status; note?: string }, label: string) => {
    setBusy(label);
    try {
      await fetcher(`/admin/vendor-applications/${app._id}`, { method: "PATCH", body: JSON.stringify(patch) });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't update the application");
    } finally {
      setBusy(null);
    }
  };

  const invite = async () => {
    setBusy("invite");
    try {
      const data = await fetcher(`/admin/vendor-applications/${app._id}/invite`, {
        method: "POST",
        body: JSON.stringify({ username: username.trim() || undefined }),
      });
      onInvited({ ...data.login, name: data.vendor?.name, phone: data.vendor?.phone, reason: "invite" });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't invite this business");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">{app.businessName}</p>
            <p className="text-sm text-gray-500">
              {TYPE_LABEL[app.storeType]} · {app.contactName} · {since(app.createdAt)}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[app.status]}`}>
            {app.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <a
            href={`tel:${app.phone}`}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium text-gray-700 hover:bg-gray-50"
          >
            <Phone className="h-3 w-3" /> {app.phone}
          </a>
          <a
            href={`https://wa.me/${digits}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-green-200 px-2 py-1 font-medium text-green-700 hover:bg-green-50"
          >
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </a>
          {app.email ? (
            <a
              href={`mailto:${app.email}`}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium text-gray-700 hover:bg-gray-50"
            >
              <Mail className="h-3 w-3" /> {app.email}
            </a>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-gray-600">
            <MapPin className="h-3 w-3" /> {app.area}
          </span>
        </div>

        {app.message ? (
          <p className="whitespace-pre-line rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{app.message}</p>
        ) : null}

        {app.existingVendor ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This phone already has a vendor account ({app.existingVendor.name || `@${app.existingVendor.username}`}). Add
            stores to that account instead of inviting again.
          </p>
        ) : null}

        {app.status === "invited" && app.vendor ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <UserCheck className="h-4 w-4" /> Invited as @{app.vendor.username}
          </p>
        ) : null}

        <div>
          <label htmlFor={`note-${app._id}`} className="text-xs text-gray-500">
            Your notes (only admins see these)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id={`note-${app._id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Called, visiting the shop on Monday"
              className="h-9 min-w-0 flex-1 rounded-md border border-gray-300 px-2 text-sm"
            />
            {note !== (app.note ?? "") ? (
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => update({ note }, "note")}>
                Save
              </Button>
            ) : null}
          </div>
        </div>

        {open ? (
          inviting ? (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
              <p className="text-sm text-gray-800">
                Create a vendor login for <strong>{app.businessName}</strong> and text it to {app.phone}?
              </p>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username (optional, made from the name if blank)"
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={!!busy} onClick={invite}>
                  {busy === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1 h-4 w-4" /> Send invite</>}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setInviting(false)}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setInviting(true)} disabled={!!app.existingVendor || !!busy}>
                <Send className="mr-1 h-4 w-4" /> Invite as vendor
              </Button>
              {app.status === "new" ? (
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => update({ status: "contacted", note }, "contacted")}>
                  Mark contacted
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                className="text-gray-500 hover:text-red-600"
                onClick={() => {
                  if (confirm(`Decline ${app.businessName}? You can still find it under Declined.`)) {
                    update({ status: "declined", note }, "declined");
                  }
                }}
              >
                Decline
              </Button>
            </div>
          )
        ) : app.status === "declined" ? (
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => update({ status: "new" }, "reopen")}>
            Reopen
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
