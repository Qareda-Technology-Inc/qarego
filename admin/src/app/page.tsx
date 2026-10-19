"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bike,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Loader2,
  Package,
  Pill,
  RefreshCw,
  ShoppingBasket,
  Store,
  UserPlus,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import DashboardMap from "@/components/DashboardMap";

type DayTotals = {
  rides: number;
  parcels: number;
  food: number;
  grocery: number;
  pharmacy: number;
  gas: number;
  bookings: number;
};

type Overview = {
  today: DayTotals;
  yesterday: DayTotals;
  live: { onlineRiders: number; activeTrips: number; activeOrders: number; newCustomersToday: number };
  actions: {
    pendingRiders: { count: number; items: { _id: string; name: string; phone?: string }[] };
    ridersOverLimit: { debtLimit: number; items: { _id: string; name: string; phone?: string; owed: number }[] };
    ordersWaitingAccept: { _id: string; store: string; minutes: number; total: number }[];
    ordersWithoutRider: { _id: string; store: string; minutes: number; total: number }[];
    ridesSearching: { _id: string; type: string; pickup?: string; minutes: number; fare: number }[];
    storesOwing: { count: number; total: number };
  };
};

const SERVICES: { key: keyof Omit<DayTotals, "bookings">; label: string; icon: LucideIcon; tint: string }[] = [
  { key: "rides", label: "Rides", icon: Car, tint: "bg-emerald-50 text-emerald-700" },
  { key: "parcels", label: "Parcels", icon: Package, tint: "bg-sky-50 text-sky-700" },
  { key: "food", label: "Food", icon: UtensilsCrossed, tint: "bg-orange-50 text-orange-700" },
  { key: "grocery", label: "Groceries", icon: ShoppingBasket, tint: "bg-lime-50 text-lime-700" },
  { key: "pharmacy", label: "Pharmacy", icon: Pill, tint: "bg-rose-50 text-rose-700" },
  { key: "gas", label: "Cooking gas", icon: Flame, tint: "bg-amber-50 text-amber-700" },
];

/** "+3 vs yesterday" / "−20%" style comparison. */
function Change({ today, yesterday, money }: { today: number; yesterday: number; money?: boolean }) {
  if (!yesterday && !today) return <span className="text-gray-400">Same as yesterday</span>;
  if (!yesterday) return <span className="text-emerald-600">New today</span>;
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  const up = pct >= 0;
  return (
    <span className={up ? "text-emerald-600" : "text-red-600"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}% vs yesterday
      {money ? null : <span className="text-gray-400"> ({yesterday})</span>}
    </span>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await fetcher("/admin/overview"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the dashboard");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  if (!data && !error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const today = data?.today;
  const yesterday = data?.yesterday;
  const a = data?.actions;
  const actionCount =
    (a?.pendingRiders.count ?? 0) +
    (a?.ridersOverLimit.items.length ?? 0) +
    (a?.ordersWaitingAccept.length ?? 0) +
    (a?.ordersWithoutRider.length ?? 0) +
    (a?.ridesSearching.length ?? 0);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">Dashboard</h2>
          <p className="text-sm text-gray-500">Today across every service. Updates every 30 seconds.</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {today && yesterday ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="border-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white lg:col-span-1">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-blue-100">Bookings today</p>
                <p className="mt-2 text-3xl font-bold">{formatCurrency(today.bookings)}</p>
                <p className="mt-2 text-xs text-blue-100">
                  {yesterday.bookings ? (
                    <>
                      {today.bookings >= yesterday.bookings ? "▲" : "▼"}{" "}
                      {Math.abs(Math.round(((today.bookings - yesterday.bookings) / yesterday.bookings) * 100))}% vs
                      yesterday ({formatCurrency(yesterday.bookings)})
                    </>
                  ) : (
                    "No bookings yesterday"
                  )}
                </p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-4">
              <LiveTile icon={Bike} label="Riders online" value={data.live.onlineRiders} />
              <LiveTile icon={Car} label="Trips in progress" value={data.live.activeTrips} />
              <LiveTile icon={Store} label="Open store orders" value={data.live.activeOrders} />
              <LiveTile icon={Users} label="New customers" value={data.live.newCustomersToday} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {SERVICES.map((s) => (
              <Card key={s.key}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.tint}`}>
                      <s.icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-gray-600">{s.label}</span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-gray-900">{today[s.key]}</p>
                  <p className="mt-1 text-xs">
                    <Change today={today[s.key]} yesterday={yesterday[s.key]} />
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {a ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {actionCount ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              )}
              <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Action needed</h3>
              {actionCount ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {actionCount}
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionCount === 0 ? (
              <p className="py-4 text-sm text-gray-500">All clear: nothing is waiting on you right now.</p>
            ) : null}

            {a.ordersWaitingAccept.length ? (
              <ActionGroup
                icon={Clock}
                tone="red"
                title="Stores haven't accepted these orders"
                hint="Open an order to call the store, or accept or decline it for them"
                href="/food-orders"
              >
                {a.ordersWaitingAccept.map((o) => (
                  <ActionRow
                    key={o._id}
                    main={o.store}
                    side={`${o.minutes} min · ${formatCurrency(o.total)}`}
                    href={`/food-orders/${o._id}`}
                  />
                ))}
              </ActionGroup>
            ) : null}

            {a.ordersWithoutRider.length ? (
              <ActionGroup
                icon={Bike}
                tone="red"
                title="Ready orders with no rider"
                hint="Open an order to assign a rider"
                href="/food-orders"
              >
                {a.ordersWithoutRider.map((o) => (
                  <ActionRow
                    key={o._id}
                    main={o.store}
                    side={`waiting ${o.minutes} min`}
                    href={`/food-orders/${o._id}`}
                  />
                ))}
              </ActionGroup>
            ) : null}

            {a.ridesSearching.length ? (
              <ActionGroup
                icon={Car}
                tone="amber"
                title="Ride requests still looking for a rider"
                hint="Check riders online near the pickup"
                href="/trips"
              >
                {a.ridesSearching.map((r) => (
                  <ActionRow key={r._id} main={`${r.type} · ${r.pickup ?? "Pickup"}`} side={`${r.minutes} min`} />
                ))}
              </ActionGroup>
            ) : null}

            {a.pendingRiders.count ? (
              <ActionGroup
                icon={UserPlus}
                tone="blue"
                title={`${a.pendingRiders.count} rider${a.pendingRiders.count === 1 ? "" : "s"} waiting for approval`}
                hint="Check their documents and approve"
                href="/drivers"
              >
                {a.pendingRiders.items.map((r) => (
                  <ActionRow
                    key={r._id}
                    main={r.name}
                    side={r.phone ?? ""}
                    href={`/drivers/${r._id}/edit`}
                  />
                ))}
              </ActionGroup>
            ) : null}

            {a.ridersOverLimit.items.length ? (
              <ActionGroup
                icon={Wallet}
                tone="amber"
                title="Riders past the debt limit"
                hint={`Owe more than ${formatCurrency(-a.ridersOverLimit.debtLimit)}; they can't go on duty`}
                href="/finance"
              >
                {a.ridersOverLimit.items.map((r) => (
                  <ActionRow key={r._id} main={r.name} side={`owes ${formatCurrency(r.owed)}`} />
                ))}
              </ActionGroup>
            ) : null}

            {a.storesOwing.count ? (
              <Link
                href="/finance"
                className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm hover:bg-gray-50"
              >
                <span className="text-gray-700">
                  {a.storesOwing.count} store{a.storesOwing.count === 1 ? "" : "s"} owe QareGO{" "}
                  <strong>{formatCurrency(a.storesOwing.total)}</strong>
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2 sm:pb-4">
          <h3 className="text-base font-medium text-gray-900 sm:text-lg">Live map</h3>
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">Online riders and active trips, every 10 seconds</p>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="h-[min(50vh,320px)] w-full overflow-hidden rounded-lg border border-gray-200 sm:h-80 md:h-96">
            <DashboardMap />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LiveTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className="h-5 w-5 text-gray-400" />
        <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </CardContent>
    </Card>
  );
}

const TONES = {
  red: "border-red-200 bg-red-50/60 text-red-700",
  amber: "border-amber-200 bg-amber-50/60 text-amber-700",
  blue: "border-blue-200 bg-blue-50/60 text-blue-700",
} as const;

function ActionGroup({
  icon: Icon,
  tone,
  title,
  hint,
  href,
  children,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  hint: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 ${TONES[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs opacity-80">{hint}</p>
          </div>
        </div>
        <Link href={href} className="shrink-0 text-xs font-semibold hover:underline">
          Open →
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-black/5 rounded-lg bg-white/70 text-sm text-gray-800">{children}</ul>
    </div>
  );
}

function ActionRow({ main, side, href }: { main: string; side: string; href?: string }) {
  const content = (
    <>
      <span className="min-w-0 truncate">{main}</span>
      <span className="shrink-0 text-xs text-gray-500">{side}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-white">
          {content}
        </Link>
      ) : (
        <div className="flex items-center justify-between gap-3 px-3 py-2">{content}</div>
      )}
    </li>
  );
}
