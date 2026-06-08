"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/context/AuthContext";
import { getCommerceOrderCopy } from "@/lib/commerceOrderCopy";
import { Button } from "@/components/ui/Button";
import {
  LayoutDashboard,
  Store,
  Users,
  ClipboardList,
  Banknote,
  Bell,
  UtensilsCrossed,
  Plus,
  ChefHat,
  ArrowRight,
} from "lucide-react";

type StoreOverview = {
  _id: string;
  name: string;
  imageEmoji?: string;
  cuisine?: string;
  vertical?: string;
  address?: string;
  isActive: boolean;
  isAcceptingOrders: boolean;
  menuItemCount: number;
  cookCount: number;
  todayOrders: number;
  todayRevenue: number;
  pending: number;
  active: number;
};

type Totals = {
  stores: number;
  staff: number;
  menuItems: number;
  todayOrders: number;
  todayRevenue: number;
  pending: number;
  active: number;
};

export default function HomePage() {
  const { user, isOwner, activeRestaurantId, setActiveRestaurant, activeRestaurant } = useAuth();
  const activeCopy = getCommerceOrderCopy(activeRestaurant?.vertical);
  const router = useRouter();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [stores, setStores] = useState<StoreOverview[]>([]);
  const [loading, setLoading] = useState(true);

  // Cooks operate a single store — send them straight to the kitchen.
  useEffect(() => {
    if (user && !isOwner) router.replace("/orders");
  }, [user, isOwner, router]);

  useEffect(() => {
    if (!isOwner) return;
    fetcher("/merchant/overview")
      .then((data) => {
        setTotals(data.totals);
        setStores(data.stores ?? []);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [isOwner]);

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        {activeCopy.dashboardTakingYou}
      </div>
    );
  }

  const openKitchen = (id: string) => {
    if (id === activeRestaurantId) router.push("/orders");
    else setActiveRestaurant(id, "/orders");
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-3 mb-2">
        <LayoutDashboard className="h-7 w-7 text-orange-500" />
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
      </div>
      <p className="text-gray-600 mb-6">
        Welcome back{user?.name ? `, ${user.name}` : ""}. Here&apos;s how all your stores are doing today.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <StatCard label="Stores" value={totals ? String(totals.stores) : "—"} icon={Store} />
        <StatCard label="Staff" value={totals ? String(totals.staff) : "—"} icon={Users} />
        <StatCard label="Orders today" value={totals ? String(totals.todayOrders) : "—"} icon={ClipboardList} />
        <StatCard
          label="Revenue today"
          value={totals ? formatCurrency(totals.todayRevenue) : "—"}
          icon={Banknote}
        />
        <StatCard
          label="Awaiting accept"
          value={totals ? String(totals.pending) : "—"}
          icon={Bell}
          highlight={!!totals?.pending}
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Your stores</h2>
        <Button variant="outline" onClick={() => router.push("/stores")}>
          <Plus className="h-4 w-4 mr-1 inline" /> Add store
        </Button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : stores.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
          You don&apos;t have any stores yet.{" "}
          <button onClick={() => router.push("/stores")} className="text-orange-600 font-medium hover:underline">
            Create your first store
          </button>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stores.map((s) => {
            const storeCopy = getCommerceOrderCopy(s.vertical);
            return (
            <div
              key={s._id}
              className={`bg-white rounded-xl border p-5 ${
                s._id === activeRestaurantId ? "ring-2 ring-orange-300" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-gray-900 truncate">
                    {s.imageEmoji} {s.name}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{s.address || s.cuisine}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {s.isActive ? "Online" : "Offline"}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      s.isAcceptingOrders ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {s.isAcceptingOrders ? "Accepting" : "Paused"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <Metric label="Today" value={String(s.todayOrders)} />
                <Metric label="Revenue" value={formatCurrency(s.todayRevenue)} />
                <Metric label="New" value={String(s.pending)} highlight={!!s.pending} />
              </div>

              <div className="flex flex-wrap gap-2 mt-4 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <ChefHat className="h-3.5 w-3.5" /> {s.active} {storeCopy.dashboardInKitchen}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UtensilsCrossed className="h-3.5 w-3.5" /> {s.menuItemCount} {storeCopy.productCountLabel}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {s.cookCount} staff
                </span>
              </div>

              <div className="mt-4">
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  onClick={() => openKitchen(s._id)}
                >
                  {storeCopy.openOrders} <ArrowRight className="h-4 w-4 ml-1 inline" />
                </Button>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "bg-orange-50 border-orange-200" : "bg-white"}`}>
      <div className="flex items-center gap-2 text-gray-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-xl font-bold mt-1 ${highlight ? "text-orange-600" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-50 py-2">
      <p className={`text-base font-bold ${highlight ? "text-orange-600" : "text-gray-900"}`}>{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}
