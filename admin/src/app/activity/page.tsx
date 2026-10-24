"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History, Loader2, Search } from "lucide-react";
import { fetcher } from "@/lib/api";
import { ADMIN_ROLE_LABEL, type AdminRole } from "@/lib/adminAccess";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Entry = {
  _id: string;
  at: string;
  actor: { _id: string; name: string | null; role: AdminRole | null };
  area: string;
  action: string;
  summary: string;
  target: { type: string | null; id: string | null; label: string | null } | null;
  details: Record<string, unknown> | null;
  ip: string | null;
};

const AREAS: { value: string; label: string }[] = [
  { value: "", label: "Everything" },
  { value: "money", label: "Money (payouts, credits, write-offs)" },
  { value: "rider", label: "Riders" },
  { value: "vendor", label: "Vendors" },
  { value: "store", label: "Stores and menus" },
  { value: "order", label: "Store orders" },
  { value: "trip", label: "Trips" },
  { value: "customer", label: "Customers" },
  { value: "settings", label: "Settings, push, service areas" },
  { value: "catalog", label: "Store types" },
  { value: "team", label: "Team" },
  { value: "account", label: "Sign-ins and passwords" },
];

const AREA_TONE: Record<string, string> = {
  money: "bg-amber-100 text-amber-800",
  team: "bg-purple-100 text-purple-800",
  settings: "bg-blue-100 text-blue-800",
  account: "bg-gray-100 text-gray-600",
};

/** Where an entry's target opens in the portal, if it has a page. */
function targetHref(t: Entry["target"]): string | null {
  if (!t?.id) return null;
  switch (t.type) {
    case "rider":
      return `/drivers/${t.id}/edit`;
    case "store":
      return `/restaurants/${t.id}`;
    case "order":
      return `/food-orders/${t.id}`;
    case "trip":
      return `/trips/${t.id}`;
    case "customer":
      return `/customers/${t.id}`;
    default:
      return null;
  }
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Super admin: who did what in the admin portal, and when. */
export default function ActivityPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [people, setPeople] = useState<{ _id: string; name: string }[]>([]);
  const [actor, setActor] = useState("");
  const [area, setArea] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (actor) params.set("actor", actor);
    if (area) params.set("area", area);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (search) params.set("q", search);
    try {
      const data = await fetcher(`/admin/activity?${params}`);
      setEntries(data.entries ?? []);
      setPeople(data.people ?? []);
      setPages(data.pages ?? 1);
      setTotal(data.total ?? 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the activity log");
    } finally {
      setLoading(false);
    }
  }, [page, actor, area, from, to, search]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Filters start again from the first page.
  const setFilter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
          <History className="h-6 w-6 text-blue-600" /> Activity
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Every change made in this admin portal, and every sign-in: who did it and when.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-gray-600">
          Person
          <select
            value={actor}
            onChange={(e) => setFilter(setActor)(e.target.value)}
            className="mt-1 block h-10 rounded-md border border-gray-300 bg-white px-2 text-sm"
          >
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">
          What
          <select
            value={area}
            onChange={(e) => setFilter(setArea)(e.target.value)}
            className="mt-1 block h-10 rounded-md border border-gray-300 bg-white px-2 text-sm"
          >
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">
          From
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setFilter(setFrom)(e.target.value)} className="mt-1 w-40" />
        </label>
        <label className="text-sm text-gray-600">
          To
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setFilter(setTo)(e.target.value)} className="mt-1 w-40" />
        </label>
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter(setSearch)(q.trim());
          }}
        >
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a name, store or rider" className="pl-9" />
        </form>
        {loading ? <Loader2 className="mb-2 h-5 w-5 animate-spin text-blue-600" /> : null}
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">{loading ? "Loading…" : "Nothing recorded for this filter."}</p>
          ) : (
            <ul className="divide-y">
              {entries.map((e, i) => {
                const day = dayLabel(e.at);
                const showDay = i === 0 || day !== dayLabel(entries[i - 1].at);
                const href = targetHref(e.target);
                return (
                  <li key={e._id}>
                    {showDay ? (
                      <p className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{day}</p>
                    ) : null}
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
                      <span className="w-16 shrink-0 text-sm tabular-nums text-gray-500">
                        {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-semibold">{e.actor.name || "Someone"}</span>{" "}
                          {href && e.target?.label && e.summary.includes(e.target.label) ? (
                            <>
                              {e.summary.split(e.target.label)[0]}
                              <Link href={href} className="text-blue-700 hover:underline">
                                {e.target.label}
                              </Link>
                              {e.summary.split(e.target.label).slice(1).join(e.target.label)}
                            </>
                          ) : (
                            e.summary
                          )}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>{e.actor.role ? ADMIN_ROLE_LABEL[e.actor.role] : "Admin"}</span>
                          <span className={`rounded-full px-2 py-0.5 ${AREA_TONE[e.area] ?? "bg-gray-100 text-gray-700"}`}>
                            {AREAS.find((a) => a.value === e.area)?.label.split(" (")[0] ?? e.area}
                          </span>
                          {e.details ? (
                            <button type="button" className="text-blue-700 hover:underline" onClick={() => setOpen(open === e._id ? null : e._id)}>
                              {open === e._id ? "Hide details" : "Details"}
                            </button>
                          ) : null}
                        </p>
                        {open === e._id && e.details ? (
                          <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                            {JSON.stringify(e.details, null, 2)}
                            {e.ip ? `\nfrom ${e.ip}` : ""}
                          </pre>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {total} entr{total === 1 ? "y" : "ies"}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
