"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetcher } from "@/lib/api";
import { fetchMerchantOrders } from "@/lib/ordersApi";
import type { FoodOrderRow } from "@/lib/orderTypes";
import { formatOrderModifierLine } from "@/lib/orderDisplay";
import { formatCurrency } from "@/lib/currency";
import { getSocket } from "@/lib/socket";
import { stopNewOrderRing } from "@/lib/sound";
import { useAuth } from "@/context/AuthContext";
import { getCommerceOrderCopy } from "@/lib/commerceOrderCopy";
import { Button } from "@/components/ui/Button";
import MerchantMap from "@/components/MerchantMap";
import { AssignRiderModal } from "@/components/AssignRiderModal";
import {
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  ChefHat,
  RefreshCw,
  MapPin,
  Banknote,
  Smartphone,
  Bike,
  KeyRound,
  Wifi,
  WifiOff,
  Power,
} from "lucide-react";

type Ride = {
  _id?: string;
  status?: string;
  rider?: { name?: string; phone?: string };
};

type RestaurantLoc = {
  _id?: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  isAcceptingOrders?: boolean;
};
type OpenState = { isOpen: boolean; status: string; label: string; todayHours?: string | null };
type Stats = { todayOrders: number; todayRevenue: number; pending: number; active: number };
type Filter = "pending" | "active" | "all";

export default function OrdersPage() {
  const { activeRestaurant, activeRestaurantId } = useAuth();
  const copy = getCommerceOrderCopy(activeRestaurant?.vertical);
  const [orders, setOrders] = useState<FoodOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [acting, setActing] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantLoc | null>(null);
  const [openState, setOpenState] = useState<OpenState | null>(null);
  const [pausing, setPausing] = useState(false);
  const [mapOrderId, setMapOrderId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [live, setLive] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{
    orderId: string;
    label: string;
  } | null>(null);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const loadStats = useCallback(async () => {
    try {
      const data = await fetcher("/merchant/stats");
      setStats(data);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const f = filterRef.current;
      const params =
        f === "pending"
          ? { stage: "pending" as const, limit: 100 }
          : f === "active"
          ? { stage: "active" as const, limit: 100 }
          : { view: "kitchen" as const, limit: 100 };
      const data = await fetchMerchantOrders(params);
      setOrders(data.orders ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [filter, load, activeRestaurantId]);

  useEffect(() => {
    loadStats();
    const t = setInterval(() => {
      load();
      loadStats();
    }, 20000);
    return () => clearInterval(t);
  }, [load, loadStats]);

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

  const act = async (
    orderId: string,
    action: "accept" | "reject" | "ready" | "assign_rider",
    driverId?: string
  ) => {
    if (action === "reject" && !confirm("Decline this order?")) return;
    if (action === "accept" || action === "reject") {
      stopNewOrderRing();
      window.dispatchEvent(new CustomEvent("kitchen:order-handled"));
    }
    setActing(orderId);
    try {
      await fetcher(`/merchant/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          ...(driverId ? { driverId } : {}),
        }),
      });
      await Promise.all([load(), loadStats()]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <ClipboardList className="h-7 w-7 text-orange-500" />
        <h1 className="text-2xl font-bold text-gray-900">{copy.ordersTitle}</h1>
        {activeRestaurant && (
          <span className="text-sm text-gray-500">
            {activeRestaurant.imageEmoji} {activeRestaurant.name}
          </span>
        )}
        <span
          className={`ml-1 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            live ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}
          title={live ? "Receiving orders in real time" : "Connecting to the live order feed…"}
        >
          {live ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {live ? "Live" : "Connecting…"}
        </span>
      </div>
      <p className="text-gray-600 mb-4">
        Accept new orders, then <strong>Mark ready</strong> (broadcast to all online riders) or{" "}
        <strong>Assign rider</strong> (send directly to one driver).
      </p>

      {restaurant && (
        <div className="bg-white rounded-xl border p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                openState?.isOpen ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <div>
              <p className="font-medium text-gray-900">{openState?.label ?? "—"}</p>
              <p className="text-xs text-gray-500">
                {openState?.status === "closed"
                  ? `Outside opening hours${openState.todayHours ? ` · today ${openState.todayHours}` : ""}`
                  : restaurant.isAcceptingOrders === false
                  ? "You've paused new orders"
                  : "Customers can order now"}
              </p>
            </div>
          </div>
          <Button
            onClick={togglePause}
            disabled={pausing}
            variant="outline"
            className={
              restaurant.isAcceptingOrders === false
                ? "border-green-300 text-green-700"
                : "border-red-300 text-red-600"
            }
          >
            <Power className="h-4 w-4 mr-1 inline" />
            {restaurant.isAcceptingOrders === false ? "Resume orders" : "Pause orders"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Orders today" value={stats ? String(stats.todayOrders) : "—"} />
        <StatCard
          label="Revenue today"
          value={stats ? formatCurrency(stats.todayRevenue) : "—"}
        />
        <StatCard label="Awaiting accept" value={stats ? String(stats.pending) : "—"} highlight={!!stats?.pending} />
        <StatCard label={copy.inProgressStat} value={stats ? String(stats.active) : "—"} />
      </div>

      <div className="flex gap-2 mb-6">
        {(["pending", "active", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === f ? "bg-orange-500 text-white" : "bg-white text-gray-700 hover:bg-gray-100 border"
            }`}
          >
            {f === "pending" ? "New" : f === "active" ? copy.activeFilter : "All"}
          </button>
        ))}
        <button
          onClick={() => {
            load();
            loadStats();
          }}
          className="px-4 py-2 rounded-lg text-sm bg-gray-900 text-white ml-auto flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
          No orders in this view
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order._id}
              className="bg-white rounded-xl border shadow-sm p-5 flex flex-col md:flex-row md:items-start gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-lg">{order.customer?.name || "Customer"}</h2>
                  <StatusBadge status={order.status} />
                  <PaymentBadge method={order.paymentMethod} />
                </div>
                <p className="text-sm text-gray-600 mt-1">{order.customer?.phone || "—"}</p>
                <p className="text-sm text-gray-500 mt-1">{order.delivery?.address}</p>
                <ul className="mt-3 text-sm text-gray-800 space-y-2">
                  {order.items?.map((item, i) => (
                    <li key={i}>
                      <span>
                        {item.quantity}× {item.name} — {formatCurrency(item.price * item.quantity)}
                      </span>
                      {item.modifiers?.length ? (
                        <ul className="mt-1 ml-4 text-xs text-gray-500 space-y-0.5">
                          {item.modifiers.map((mod, j) => (
                            <li key={j}>+ {formatOrderModifierLine(mod)}</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {order.notes ? (
                  <p className="text-sm text-orange-700 mt-2">Note: {order.notes}</p>
                ) : null}
                <p className="font-semibold mt-3">{formatCurrency(order.total)} total</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(order.createdAt).toLocaleString()}
                </p>

                {order.ride?.rider?.name && (
                  <p className="text-sm text-indigo-700 mt-2 flex items-center gap-1">
                    <Bike className="h-4 w-4" />
                    Courier: {order.ride.rider.name}
                    {order.ride.rider.phone ? ` · ${order.ride.rider.phone}` : ""}
                  </p>
                )}

                {order.delivery?.latitude != null && order.delivery?.longitude != null && (
                  <div className="mt-3">
                    <button
                      onClick={() => setMapOrderId(mapOrderId === order._id ? null : order._id)}
                      className="text-sm text-orange-600 font-medium flex items-center gap-1 hover:underline"
                    >
                      <MapPin className="h-4 w-4" />
                      {mapOrderId === order._id ? "Hide map" : "View delivery on map"}
                    </button>
                    {mapOrderId === order._id && (
                      <div className="mt-2">
                        <MerchantMap
                          markers={[
                            ...(restaurant?.latitude != null && restaurant?.longitude != null
                              ? [
                                  {
                                    position: { lat: restaurant.latitude, lng: restaurant.longitude },
                                    title: restaurant.name
                                      ? `${restaurant.name} (pickup)`
                                      : copy.mapPickupTitle,
                                  },
                                ]
                              : []),
                            {
                              position: {
                                lat: order.delivery.latitude,
                                lng: order.delivery.longitude,
                              },
                              title: `Delivery — ${order.delivery.address}`,
                            },
                          ]}
                          height={220}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 min-w-[150px]">
                {order.status === "PLACED" && (
                  <>
                    <Button
                      disabled={acting === order._id}
                      onClick={() => act(order._id, "accept")}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1 inline" /> Accept
                    </Button>
                    <Button
                      disabled={acting === order._id}
                      onClick={() => act(order._id, "reject")}
                      variant="outline"
                      className="border-red-300 text-red-600"
                    >
                      <XCircle className="h-4 w-4 mr-1 inline" /> Decline
                    </Button>
                  </>
                )}
                {order.status === "PREPARING" && (
                  <>
                    <Button
                      disabled={acting === order._id}
                      onClick={() => act(order._id, "ready")}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <ChefHat className="h-4 w-4 mr-1 inline" /> Mark ready
                    </Button>
                    <Button
                      disabled={acting === order._id}
                      variant="outline"
                      onClick={() =>
                        setAssignTarget({
                          orderId: order._id,
                          label: order.customer?.name || "this order",
                        })
                      }
                    >
                      <Bike className="h-4 w-4 mr-1 inline" /> Assign rider
                    </Button>
                  </>
                )}
                {order.status === "READY_FOR_PICKUP" &&
                  order.ride?.status === "SEARCHING_FOR_RIDER" &&
                  !order.ride?.rider?.name && (
                    <Button
                      disabled={acting === order._id}
                      variant="outline"
                      onClick={() =>
                        setAssignTarget({
                          orderId: order._id,
                          label: order.customer?.name || "this order",
                        })
                      }
                    >
                      <Bike className="h-4 w-4 mr-1 inline" /> Assign rider
                    </Button>
                  )}
                {(order.status === "READY_FOR_PICKUP" || order.status === "PICKED_UP") &&
                  order.deliveryCode && (
                    <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-center">
                      <p className="text-xs text-purple-600 flex items-center justify-center gap-1">
                        <KeyRound className="h-3 w-3" /> Pickup code
                      </p>
                      <p className="text-xl font-bold tracking-widest text-purple-800">
                        {order.deliveryCode}
                      </p>
                    </div>
                  )}
                {order.status === "READY_FOR_PICKUP" && !order.ride?.rider?.name && (
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Clock className="h-4 w-4" /> Waiting for rider…
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AssignRiderModal
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        orderLabel={assignTarget?.label}
        busy={acting !== null}
        onAssign={(driverId) =>
          assignTarget
            ? act(assignTarget.orderId, "assign_rider", driverId)
            : Promise.resolve()
        }
      />
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "bg-orange-50 border-orange-200" : "bg-white"}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${highlight ? "text-orange-600" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function PaymentBadge({ method }: { method?: "CASH" | "MOBILE_MONEY" }) {
  if (!method) return null;
  const isCash = method === "CASH";
  return (
    <span
      className={`text-xs font-medium px-2 py-1 rounded-full inline-flex items-center gap-1 ${
        isCash ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"
      }`}
    >
      {isCash ? <Banknote className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
      {isCash ? "Cash" : "Mobile money"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PLACED: "bg-yellow-100 text-yellow-800",
    PREPARING: "bg-blue-100 text-blue-800",
    READY_FOR_PICKUP: "bg-purple-100 text-purple-800",
    PICKED_UP: "bg-indigo-100 text-indigo-800",
    DELIVERED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors[status] || "bg-gray-100"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
