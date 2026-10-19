"use client";

import { useCallback, useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { fetchMerchantOrders } from "@/lib/ordersApi";
import type { FoodOrderRow } from "@/lib/orderTypes";
import { formatOrderModifierLine } from "@/lib/orderDisplay";
import { formatCurrency } from "@/lib/currency";
import { getSocket } from "@/lib/socket";
import { stopNewOrderRing } from "@/lib/sound";
import { useAuth } from "@/context/AuthContext";
import { getCommerceOrderCopy, type CommerceOrderCopy } from "@/lib/commerceOrderCopy";
import { Button } from "@/components/ui/Button";
import MerchantMap from "@/components/MerchantMap";
import { AssignRiderModal } from "@/components/AssignRiderModal";
import { PrescriptionAttachments } from "@/components/PrescriptionAttachments";
import { OrderPayoutNote } from "@/components/OrderPayoutNote";
import { VerticalIcon } from "@/components/VerticalIcon";
import {
  Bell,
  CheckCircle,
  XCircle,
  RefreshCw,
  MapPin,
  Banknote,
  Smartphone,
  Bike,
  Wifi,
  WifiOff,
  Power,
  Clock,
  ShoppingBag,
  Phone,
  PackageCheck,
} from "lucide-react";

type RestaurantLoc = {
  _id?: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  isAcceptingOrders?: boolean;
};
type OpenState = { isOpen: boolean; status: string; label: string; todayHours?: string | null };
type Stats = { todayOrders: number; todayRevenue: number; pending: number; active: number };
type Action =
  | "accept"
  | "reject"
  | "ready"
  | "assign_rider"
  | "cancel"
  | "empty_returned"
  | "collected";
type ColumnKey = "new" | "preparing" | "ready" | "out";

/** Minutes after which a card turns amber, then red, per column. */
const LATE_AFTER: Record<ColumnKey, [number, number]> = {
  new: [3, 6],
  preparing: [20, 35],
  ready: [10, 20],
  out: [30, 50],
};

function columnOf(order: FoodOrderRow): ColumnKey {
  switch (order.status) {
    case "PLACED":
      return "new";
    case "PREPARING":
      return "preparing";
    case "READY_FOR_PICKUP":
      return "ready";
    default:
      return "out";
  }
}

/** When the order entered its current column (for the timer on the card). */
function columnSince(order: FoodOrderRow): string {
  if (order.status === "PLACED") return order.createdAt;
  if (order.status === "PREPARING") return order.preparingStartedAt || order.updatedAt || order.createdAt;
  return order.updatedAt || order.createdAt;
}

function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

/** Re-render every 30 s so card timers stay current. */
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export default function OrdersPage() {
  const { activeRestaurant, activeRestaurantId } = useAuth();
  const vertical = activeRestaurant?.vertical;
  const copy = getCommerceOrderCopy(vertical);
  const now = useNow();
  const [orders, setOrders] = useState<FoodOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantLoc | null>(null);
  const [openState, setOpenState] = useState<OpenState | null>(null);
  const [pausing, setPausing] = useState(false);
  const [mapOrderId, setMapOrderId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [live, setLive] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<ColumnKey>("new");
  const [assignTarget, setAssignTarget] = useState<{ orderId: string; label: string } | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setStats(await fetcher("/merchant/stats"));
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchMerchantOrders({ view: "kitchen", limit: 100 });
      setOrders(data.orders ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load now (and again when the active store changes), then poll as a fallback to the socket.
  useEffect(() => {
    const refresh = () => {
      load();
      loadStats();
    };
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 20000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, loadStats, activeRestaurantId]);

  useEffect(() => {
    fetcher("/merchant/restaurant")
      .then((data) => {
        setRestaurant(data.restaurant);
        setOpenState(data.openState ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    onConnect();
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      load();
      loadStats();
    };
    window.addEventListener("kitchen:new-order", refresh);
    window.addEventListener("kitchen:orders-changed", refresh);
    return () => {
      window.removeEventListener("kitchen:new-order", refresh);
      window.removeEventListener("kitchen:orders-changed", refresh);
    };
  }, [load, loadStats]);

  const togglePause = async () => {
    if (!restaurant) return;
    const next = !(restaurant.isAcceptingOrders ?? true);
    setPausing(true);
    try {
      const res = await fetcher("/merchant/restaurant/accepting", {
        method: "PATCH",
        body: JSON.stringify({ isAcceptingOrders: next }),
      });
      setRestaurant((r) => (r ? { ...r, isAcceptingOrders: res.isAcceptingOrders } : r));
      setOpenState(res.openState ?? null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Could not update");
    } finally {
      setPausing(false);
    }
  };

  const act = async (orderId: string, action: Action, driverId?: string) => {
    if (action === "reject" && !confirm("Decline this order?")) return;
    // Cancelling after accepting (e.g. no courier came): ask why, the customer sees it.
    let cancelReason: string | undefined;
    if (action === "cancel") {
      const reason = prompt(
        "Cancel this order? Any assigned courier is released.\n\nReason (shown to the customer):",
        ""
      );
      if (reason === null) return;
      cancelReason = reason.trim() || "Cancelled by the store";
    }
    if (action === "collected" && !confirm("Customer has paid and collected this order?")) return;
    if (action === "accept" || action === "reject") {
      stopNewOrderRing();
      window.dispatchEvent(new CustomEvent("kitchen:order-handled"));
    }
    setActing(orderId);
    try {
      await fetcher(`/merchant/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: action === "cancel" ? "reject" : action,
          ...(driverId ? { driverId } : {}),
          ...(cancelReason ? { cancelReason } : {}),
        }),
      });
      await Promise.all([load(), loadStats()]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  const columns: { key: ColumnKey; title: string; empty: string; accent: string }[] = [
    { key: "new", title: "New", empty: "No new orders", accent: "bg-amber-500" },
    { key: "preparing", title: copy.preparingColumn, empty: copy.preparingEmpty, accent: "bg-blue-500" },
    { key: "ready", title: "Ready", empty: "Nothing waiting", accent: "bg-violet-500" },
    { key: "out", title: "On the way", empty: "No orders out", accent: "bg-emerald-500" },
  ];
  const byColumn = (key: ColumnKey) =>
    orders
      .filter((o) => columnOf(o) === key)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const paused = restaurant?.isAcceptingOrders === false;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <VerticalIcon vertical={vertical} className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground">{copy.ordersTitle}</h1>
              <p className="text-sm text-muted">{copy.boardSubtitle}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              live ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
            title={live ? "Receiving orders in real time" : "Connecting to the live order feed…"}
          >
            {live ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {live ? "Live" : "Connecting…"}
          </span>
          {restaurant ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                openState?.isOpen && !paused ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
              title={openState?.todayHours ? `Today ${openState.todayHours}` : undefined}
            >
              <span
                className={`h-2 w-2 rounded-full ${openState?.isOpen && !paused ? "bg-emerald-500" : "bg-red-500"}`}
              />
              {paused
                ? "Paused"
                : openState?.status === "closed"
                  ? "Outside opening hours"
                  : openState?.label ?? "Open"}
            </span>
          ) : null}
          {restaurant ? (
            <Button
              onClick={togglePause}
              disabled={pausing}
              variant="outline"
              className={paused ? "border-green-300 text-green-700" : "border-red-300 text-red-600"}
            >
              <Power className="mr-1 inline h-4 w-4" />
              {paused ? "Resume orders" : "Pause orders"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => {
              load();
              loadStats();
            }}
          >
            <RefreshCw className="mr-1 inline h-4 w-4" /> Refresh
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Orders today" value={stats ? String(stats.todayOrders) : "—"} />
        <StatCard label="Sales today" value={stats ? formatCurrency(stats.todayRevenue) : "—"} />
        <StatCard
          label="Waiting to accept"
          value={stats ? String(stats.pending) : "—"}
          highlight={!!stats?.pending}
        />
        <StatCard label={copy.inProgressStat} value={stats ? String(stats.active) : "—"} />
      </div>

      {/* Phones: one column at a time. Tablets and up: the whole board. */}
      <div className="flex gap-2 overflow-x-auto md:hidden">
        {columns.map((c) => (
          <button
            key={c.key}
            onClick={() => setMobileColumn(c.key)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium ${
              mobileColumn === c.key ? "bg-brand text-white" : "border bg-white text-gray-700"
            }`}
          >
            {c.title} · {byColumn(c.key).length}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading orders…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((c) => {
            const list = byColumn(c.key);
            return (
              <section
                key={c.key}
                className={`flex min-h-[200px] flex-col rounded-2xl bg-slate-100/70 p-3 ${
                  mobileColumn === c.key ? "" : "hidden md:flex"
                }`}
              >
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${c.accent}`} />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{c.title}</h2>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {list.length}
                  </span>
                </div>
                {list.length === 0 ? (
                  <p className="flex flex-1 items-center justify-center py-10 text-sm text-slate-400">{c.empty}</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {list.map((order) => (
                      <OrderCard
                        key={order._id}
                        order={order}
                        column={c.key}
                        copy={copy}
                        now={now}
                        busy={acting === order._id}
                        mapOpen={mapOrderId === order._id}
                        restaurant={restaurant}
                        onToggleMap={() => setMapOrderId(mapOrderId === order._id ? null : order._id)}
                        onAct={(action) => act(order._id, action)}
                        onAssign={() =>
                          setAssignTarget({ orderId: order._id, label: order.customer?.name || "this order" })
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <AssignRiderModal
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        orderLabel={assignTarget?.label}
        busy={acting !== null}
        onAssign={(driverId) =>
          assignTarget ? act(assignTarget.orderId, "assign_rider", driverId) : Promise.resolve()
        }
      />
    </div>
  );
}

function OrderCard({
  order,
  column,
  copy,
  now,
  busy,
  mapOpen,
  restaurant,
  onToggleMap,
  onAct,
  onAssign,
}: {
  order: FoodOrderRow;
  column: ColumnKey;
  copy: CommerceOrderCopy;
  now: number;
  busy: boolean;
  mapOpen: boolean;
  restaurant: RestaurantLoc | null;
  onToggleMap: () => void;
  onAct: (action: Action) => void;
  onAssign: () => void;
}) {
  const mins = minutesSince(columnSince(order), now);
  const [warn, late] = LATE_AFTER[column];
  const timerClass =
    mins >= late
      ? "bg-red-100 text-red-700"
      : mins >= warn
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-600";
  const isNew = order.status === "PLACED";
  const isPickup = order.fulfillmentType === "PICKUP";
  const refillWaiting = order.status === "PREPARING" && order.gasMode === "REFILL" && order.gasStage !== "AT_STATION";
  const canCancel =
    (order.status === "PREPARING" && !(order.gasMode === "REFILL" && order.gasStage)) ||
    order.status === "READY_FOR_PICKUP";

  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        isNew ? "border-amber-300 ring-2 ring-amber-200" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{order.customer?.name || "Customer"}</p>
          <p className="text-xs text-muted">#{order._id.slice(-6).toUpperCase()}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${timerClass}`}>
          <Clock className="h-3 w-3" />
          {mins < 1 ? "now" : `${mins} min`}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <PaymentBadge method={order.paymentMethod} />
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {isPickup ? <ShoppingBag className="h-3 w-3" /> : <Bike className="h-3 w-3" />}
          {isPickup ? "Pickup" : "Delivery"}
        </span>
        {order.gasMode ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
            {order.gasMode === "REFILL" ? "Refill" : "Exchange"}
            {order.gasSizeKg ? ` · ${order.gasSizeKg} kg` : ""}
          </span>
        ) : null}
      </div>

      <ul className="mt-3 space-y-1.5 text-sm text-gray-800">
        {order.items?.map((item, i) => (
          <li key={i}>
            <span className="font-semibold">{item.quantity}×</span> {item.name}
            {item.modifiers?.length ? (
              <ul className="ml-5 mt-0.5 space-y-0.5 text-xs text-muted">
                {item.modifiers.map((mod, j) => (
                  <li key={j}>+ {formatOrderModifierLine(mod)}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      {order.notes ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-sm text-amber-900">Note: {order.notes}</p>
      ) : null}
      <PrescriptionAttachments urls={order.prescriptionUrls} />

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-muted">Order total</span>
        <span className="font-bold text-foreground">{formatCurrency(order.subtotal)}</span>
      </div>
      <OrderPayoutNote order={order} />

      {order.customer?.phone ? (
        <a
          href={`tel:${order.customer.phone}`}
          className="mt-2 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand"
        >
          <Phone className="h-3 w-3" /> {order.customer.phone}
        </a>
      ) : null}
      {!isPickup && order.delivery?.address ? (
        <p className="mt-1 text-xs text-muted">{order.delivery.address}</p>
      ) : null}
      {order.ride?.rider?.name ? (
        <p className="mt-2 flex items-center gap-1 text-sm text-indigo-700">
          <Bike className="h-4 w-4" /> {order.ride.rider.name}
          {order.ride.rider.phone ? ` · ${order.ride.rider.phone}` : ""}
        </p>
      ) : null}

      {order.delivery?.latitude != null && order.delivery?.longitude != null && !isPickup ? (
        <div className="mt-2">
          <button onClick={onToggleMap} className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
            <MapPin className="h-3.5 w-3.5" /> {mapOpen ? "Hide map" : "Show on map"}
          </button>
          {mapOpen ? (
            <div className="mt-2">
              <MerchantMap
                markers={[
                  ...(restaurant?.latitude != null && restaurant?.longitude != null
                    ? [
                        {
                          position: { lat: restaurant.latitude, lng: restaurant.longitude },
                          title: restaurant.name ? `${restaurant.name} (pickup)` : copy.mapPickupTitle,
                        },
                      ]
                    : []),
                  {
                    position: { lat: order.delivery.latitude, lng: order.delivery.longitude },
                    title: `Delivery — ${order.delivery.address}`,
                  },
                ]}
                height={180}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {isNew ? (
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={busy} onClick={() => onAct("accept")} className="h-11 bg-green-600 hover:bg-green-700">
              <CheckCircle className="mr-1 inline h-4 w-4" /> Accept
            </Button>
            <Button
              disabled={busy}
              onClick={() => onAct("reject")}
              variant="outline"
              className="h-11 border-red-300 text-red-600"
            >
              <XCircle className="mr-1 inline h-4 w-4" /> Decline
            </Button>
          </div>
        ) : null}

        {refillWaiting ? (
          <p className="flex items-center gap-1 text-sm text-gray-600">
            <Bike className="h-4 w-4" />
            {order.gasStage === "TO_STATION"
              ? "Courier is bringing the empty cylinder"
              : "Courier collecting the customer's empty"}
          </p>
        ) : null}
        {order.status === "PREPARING" && !refillWaiting ? (
          <Button disabled={busy} onClick={() => onAct("ready")} className="h-11">
            <PackageCheck className="mr-1 inline h-4 w-4" /> {copy.readyButton}
          </Button>
        ) : null}
        {order.status === "PREPARING" && order.gasMode !== "REFILL" && !isPickup ? (
          <Button disabled={busy} variant="outline" onClick={onAssign}>
            <Bike className="mr-1 inline h-4 w-4" /> Assign rider
          </Button>
        ) : null}

        {order.status === "READY_FOR_PICKUP" && isPickup ? (
          <>
            <p className="flex items-center gap-1 text-sm text-gray-600">
              <Bell className="h-4 w-4" /> Waiting for the customer to collect
            </p>
            <Button disabled={busy} className="h-11 bg-green-600 hover:bg-green-700" onClick={() => onAct("collected")}>
              <CheckCircle className="mr-1 inline h-4 w-4" /> Customer collected
            </Button>
          </>
        ) : null}
        {order.status === "READY_FOR_PICKUP" && !isPickup && !order.ride?.rider?.name ? (
          <>
            <p className="flex items-center gap-1 text-sm text-gray-600">
              <Clock className="h-4 w-4" /> Finding a rider…
            </p>
            {order.ride?.status === "SEARCHING_FOR_RIDER" ? (
              <Button disabled={busy} variant="outline" onClick={onAssign}>
                <Bike className="mr-1 inline h-4 w-4" /> Assign rider
              </Button>
            ) : null}
          </>
        ) : null}

        {order.gasMode === "EXCHANGE" &&
        (order.status === "PICKED_UP" || order.status === "DELIVERED") &&
        !order.gasEmptyReturnedAt ? (
          <Button disabled={busy} variant="outline" onClick={() => onAct("empty_returned")}>
            Empty cylinder returned
          </Button>
        ) : null}

        {canCancel ? (
          <button
            disabled={busy}
            onClick={() => onAct("cancel")}
            className="self-center text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
          >
            Cancel order
          </button>
        ) : null}
      </div>
    </article>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-brand/20 bg-brand/5" : "border-border bg-white"}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-xl font-bold ${highlight ? "text-brand" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function PaymentBadge({ method }: { method?: "CASH" | "MOBILE_MONEY" }) {
  if (!method) return null;
  const isCash = method === "CASH";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isCash ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"
      }`}
    >
      {isCash ? <Banknote className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
      {isCash ? "Cash" : "Mobile money"}
    </span>
  );
}
