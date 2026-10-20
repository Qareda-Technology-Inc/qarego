"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Bike,
  CheckCircle,
  Loader2,
  MessageCircle,
  Phone,
  Store,
  User,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type Person = { _id?: string; name?: string; phone?: string };
type OrderDetail = {
  _id: string;
  status: string;
  restaurantName?: string;
  restaurant?: {
    _id: string;
    name?: string;
    imageEmoji?: string;
    vertical?: string;
    address?: string;
    owner?: Person | null;
  } | null;
  customer?: Person | null;
  ride?: { _id: string; status?: string; gasLeg?: string | null; rider?: Person | null } | null;
  /** Collect-first orders (gas refill, laundry): the trip that brought it to the store. */
  collectionRide?: { _id: string; status?: string; rider?: Person | null } | null;
  gasStage?: "TO_STATION" | "AT_STATION" | null;
  laundry?: {
    estimatedSubtotal: number;
    estimatedItemCount: number;
    priceStatus: "estimate" | "awaiting_customer" | "approved" | "declined";
    countedAt?: string | null;
    countedItemCount?: number | null;
    previousSubtotal?: number | null;
    decidedAt?: string | null;
  } | null;
  tripShare?: { type: "TRIP_SHARE_CREDIT" | "TRIP_SHARE_DEBIT"; amount: number; driver?: Person | null }[];
  items: { name: string; quantity: number; price: number; modifiers?: { optionName: string }[] }[];
  notes?: string;
  prescriptionUrls?: string[];
  delivery?: { address?: string };
  fulfillmentType?: "DELIVERY" | "PICKUP" | "SCHEDULED";
  paymentMethod?: "CASH" | "MOBILE_MONEY";
  paymentStatus?: string;
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
  restaurantNet?: number | null;
  riderNet?: number | null;
  platformNet?: number | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  refundStatus?: "NONE" | "DUE" | "REFUNDED";
  gasMode?: "REFILL" | "EXCHANGE" | null;
  gasSizeKg?: number | null;
  gasEmptyReturnedAt?: string | null;
  createdAt: string;
  timeline: { status: string; at: string; approximate?: boolean }[];
};
type Rider = { _id: string; name?: string; phone?: string; isOnline?: boolean; vehicle?: string };

const STATUS_LABEL: Record<string, string> = {
  PLACED: "Order placed",
  PREPARING: "Store accepted",
  READY_FOR_PICKUP: "Ready",
  PICKED_UP: "Picked up by rider",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const STATUS_BADGE: Record<string, string> = {
  PLACED: "bg-yellow-100 text-yellow-800",
  PREPARING: "bg-blue-100 text-blue-800",
  READY_FOR_PICKUP: "bg-purple-100 text-purple-800",
  PICKED_UP: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const RIDE_STATUS_LABEL: Record<string, string> = {
  SEARCHING_FOR_RIDER: "Looking for a rider",
  START: "Heading to the store",
  ARRIVED: "At the store",
  IN_PROGRESS: "On the way to the customer",
  COMPLETED: "Delivered",
};

const VERTICAL_LABEL: Record<string, string> = {
  FOOD: "Restaurant",
  GROCERY: "Grocery",
  PHARMACY: "Pharmacy",
  GAS: "Gas station",
  LAUNDRY: "Laundry",
};

/** Collection trips run the other way: rider goes to the customer, then to the store. */
const COLLECT_STATUS_LABEL: Record<string, string> = {
  SEARCHING_FOR_RIDER: "Looking for a rider",
  START: "Heading to the customer",
  ARRIVED: "At the customer",
  IN_PROGRESS: "Taking it to the store",
  COMPLETED: "Dropped at the store",
};

const LAUNDRY_PRICE: Record<string, { label: string; tone: string }> = {
  estimate: { label: "Not counted yet", tone: "bg-gray-100 text-gray-700" },
  awaiting_customer: { label: "Waiting for customer to approve", tone: "bg-amber-100 text-amber-800" },
  approved: { label: "Price agreed", tone: "bg-green-100 text-green-800" },
  declined: { label: "Declined · returning unwashed", tone: "bg-red-100 text-red-800" },
};

function gapLabel(fromIso: string, toIso: string) {
  const mins = Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000);
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} h ${mins % 60} min`;
}

/** WhatsApp wants the number in international form without "+". */
function whatsappLink(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export default function StoreOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [riders, setRiders] = useState<Rider[] | null>(null);
  const [riderId, setRiderId] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetcher(`/food/admin/orders/${id}`);
      setOrder(data.order);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this order");
    }
  }, [id]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 20000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      await fetcher(`/food/admin/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, ...extra }),
      });
      setCancelling(false);
      setReason("");
      setRiderId("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const loadRiders = async () => {
    if (riders) return;
    try {
      const data = await fetcher("/food/admin/riders");
      setRiders(data.riders ?? []);
    } catch {
      setRiders([]);
    }
  };

  if (error && !order) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isPickup = order.fulfillmentType === "PICKUP";
  const rider = order.ride?.rider ?? null;
  const open = ["PLACED", "PREPARING", "READY_FOR_PICKUP"].includes(order.status);
  const laundry = order.laundry ?? null;
  const collectFirst = order.gasMode === "REFILL" || !!laundry;
  // Collect-first orders only take a chosen rider for the return trip, once the store marks them ready.
  const canAssign =
    !isPickup &&
    !rider &&
    (collectFirst ? order.status === "READY_FOR_PICKUP" : order.status === "PREPARING" || order.status === "READY_FOR_PICKUP");
  const laundryReady =
    !!laundry && order.gasStage === "AT_STATION" && (laundry.priceStatus === "approved" || laundry.priceStatus === "declined");
  const collector = order.collectionRide?.rider ?? null;
  const isReturnLeg = collectFirst && order.ride?.gasLeg === "RETURN";
  const storeName = order.restaurant?.name || order.restaurantName || "Store";

  return (
    <div className="min-w-0 space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
              {order.restaurant?.imageEmoji} {storeName}
            </h1>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE[order.status] ?? "bg-gray-100"}`}>
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
            {order.refundStatus === "DUE" ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">Refund due</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Order #{order._id.slice(-6).toUpperCase()} · {VERTICAL_LABEL[order.restaurant?.vertical ?? "FOOD"]} ·{" "}
            {isPickup ? "Customer pickup" : "Delivery"} · {order.paymentMethod === "MOBILE_MONEY" ? "Mobile money" : "Cash"} ·{" "}
            {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {order.status === "CANCELLED" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Cancelled{order.cancelledBy ? ` by ${order.cancelledBy.toLowerCase()}` : ""}
          {order.cancelReason ? `: ${order.cancelReason}` : ""}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What happened</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative ml-2 border-l border-gray-200">
                {order.timeline.map((e, i) => {
                  const prev = order.timeline[i - 1];
                  const bad = e.status === "CANCELLED";
                  return (
                    <li key={`${e.status}-${i}`} className="mb-5 ml-5 last:mb-0">
                      <span
                        className={`absolute -left-[7px] mt-1 h-3.5 w-3.5 rounded-full ring-4 ring-white ${
                          bad ? "bg-red-500" : i === order.timeline.length - 1 ? "bg-blue-600" : "bg-gray-300"
                        }`}
                      />
                      <p className={`text-sm font-semibold ${bad ? "text-red-700" : "text-gray-900"}`}>
                        {e.status === "DELIVERED" && isPickup ? "Collected by customer" : STATUS_LABEL[e.status] ?? e.status}
                      </p>
                      <p className="text-xs text-gray-500">
                        {e.approximate ? "around " : ""}
                        {new Date(e.at).toLocaleString()}
                        {prev ? ` · ${gapLabel(prev.at, e.at)} after the previous step` : ""}
                      </p>
                    </li>
                  );
                })}
              </ol>
              {open ? (
                <p className="mt-4 text-xs text-gray-500">
                  Waiting {gapLabel(order.timeline[order.timeline.length - 1].at, new Date().toISOString())} at this step.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {order.items.map((item, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2">
                    <span>
                      <span className="font-semibold">{item.quantity}×</span> {item.name}
                      {item.modifiers?.length ? (
                        <span className="block text-xs text-gray-500">
                          {item.modifiers.map((m) => m.optionName).join(", ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-gray-700">{formatCurrency(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              {order.gasMode ? (
                <p className="mt-2 text-sm text-gray-700">
                  Gas: {order.gasMode === "REFILL" ? "refill" : "exchange"}
                  {order.gasSizeKg ? ` · ${order.gasSizeKg} kg` : ""}
                </p>
              ) : null}
              {order.notes ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Note: {order.notes}</p>
              ) : null}
              {order.prescriptionUrls?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.prescriptionUrls.map((url, i) => (
                    <a
                      key={url}
                      href={resolveMediaUrl(url) ?? url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                    >
                      Prescription {i + 1}
                    </a>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {laundry ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Laundry</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${LAUNDRY_PRICE[laundry.priceStatus]?.tone}`}>
                    {LAUNDRY_PRICE[laundry.priceStatus]?.label ?? laundry.priceStatus}
                  </span>
                  <span className="text-gray-600">
                    {order.gasStage === "AT_STATION"
                      ? "Bag is at the shop"
                      : order.gasStage === "TO_STATION"
                        ? "Bag is with the collecting rider"
                        : order.status === "PLACED"
                          ? "Not collected yet"
                          : "Bag has left the shop"}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  <dt className="text-gray-500">Customer estimate</dt>
                  <dd className="text-right">
                    {laundry.estimatedItemCount} items · {formatCurrency(laundry.estimatedSubtotal)}
                  </dd>
                  {laundry.countedAt ? (
                    <>
                      <dt className="text-gray-500">Shop counted</dt>
                      <dd className="text-right font-medium">
                        {laundry.countedItemCount ?? "?"} items ·{" "}
                        {formatCurrency(laundry.priceStatus === "declined" ? laundry.previousSubtotal ?? 0 : order.subtotal)}
                      </dd>
                      <dt className="text-gray-500">Counted at</dt>
                      <dd className="text-right text-gray-700">{new Date(laundry.countedAt).toLocaleString()}</dd>
                    </>
                  ) : null}
                  {laundry.decidedAt ? (
                    <>
                      <dt className="text-gray-500">Customer answered</dt>
                      <dd className="text-right text-gray-700">
                        {laundry.priceStatus === "declined" ? "Declined" : "Approved"} ·{" "}
                        {new Date(laundry.decidedAt).toLocaleString()}
                      </dd>
                    </>
                  ) : null}
                </dl>
                {laundry.priceStatus === "declined" ? (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                    Nothing is washed. The customer pays the delivery fee only and the store earns nothing on this order.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Money</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <dl className="space-y-1.5 text-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Customer paid</p>
                <Row label="Items" value={order.subtotal} />
                <Row label="Service fee" value={order.serviceFee} />
                <Row label="Delivery" value={order.deliveryFee} />
                <Row label="Total" value={order.total} strong />
              </dl>
              <dl className="space-y-1.5 text-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Split</p>
                <Row label="Store" value={order.restaurantNet} />
                <Row label="Rider" value={order.riderNet} />
                <Row label="QareGO" value={order.platformNet} strong />
              </dl>
              {order.tripShare?.length ? (
                <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900 sm:col-span-2">
                  <p className="font-semibold">Rider pay split between two riders</p>
                  {order.tripShare.map((t, i) => (
                    <p key={i}>
                      {t.driver?.name || "Rider"}: {t.amount > 0 ? "+" : ""}
                      {formatCurrency(t.amount)} {t.type === "TRIP_SHARE_CREDIT" ? "(collected the bag)" : "(returned it)"}
                    </p>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">People</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Contact icon={User} role="Customer" person={order.customer} detail={!isPickup ? order.delivery?.address : undefined} />
              <Contact
                icon={Store}
                role="Store"
                person={{ name: storeName, phone: order.restaurant?.owner?.phone }}
                detail={order.restaurant?.address}
              />
              {collectFirst && collector ? (
                <Contact
                  icon={Bike}
                  role="Collected by"
                  person={collector}
                  detail={order.collectionRide?.status ? COLLECT_STATUS_LABEL[order.collectionRide.status] : undefined}
                />
              ) : null}
              {isPickup ? null : rider && !(collectFirst && !isReturnLeg) ? (
                <Contact
                  icon={Bike}
                  role={isReturnLeg ? "Bringing it back" : "Rider"}
                  person={rider}
                  detail={order.ride?.status ? RIDE_STATUS_LABEL[order.ride.status] ?? order.ride.status : undefined}
                />
              ) : collectFirst && collector && !isReturnLeg ? null : (
                <p className="flex items-center gap-2 text-sm text-gray-500">
                  <Bike className="h-4 w-4" /> No rider yet
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.status === "PLACED" ? (
                <Button disabled={busy} onClick={() => act("accept")} className="w-full bg-green-600 hover:bg-green-700">
                  <CheckCircle className="mr-1 inline h-4 w-4" /> Accept for the store
                </Button>
              ) : null}
              {order.status === "PREPARING" && order.gasMode !== "REFILL" && (!laundry || laundryReady) ? (
                <Button disabled={busy} onClick={() => act("ready")} className="w-full">
                  Mark ready
                </Button>
              ) : null}
              {order.status === "READY_FOR_PICKUP" && isPickup ? (
                <Button disabled={busy} onClick={() => act("collected")} className="w-full bg-green-600 hover:bg-green-700">
                  Customer collected
                </Button>
              ) : null}
              {order.gasMode === "EXCHANGE" &&
              (order.status === "PICKED_UP" || order.status === "DELIVERED") &&
              !order.gasEmptyReturnedAt ? (
                <Button disabled={busy} variant="outline" onClick={() => act("empty_returned")} className="w-full">
                  Empty cylinder returned
                </Button>
              ) : null}

              {canAssign ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-medium text-gray-800">Assign a rider</p>
                  <select
                    value={riderId}
                    onFocus={loadRiders}
                    onClick={loadRiders}
                    onChange={(e) => setRiderId(e.target.value)}
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                  >
                    <option value="">{riders === null ? "Choose a rider…" : riders.length ? "Choose a rider…" : "No active riders"}</option>
                    {(riders ?? []).map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.isOnline ? "● " : "○ "}
                        {r.name || "Rider"} {r.vehicle ? `· ${r.vehicle}` : ""}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={busy || !riderId}
                    variant="outline"
                    onClick={() => act("assign_rider", { driverId: riderId })}
                    className="w-full"
                  >
                    <Bike className="mr-1 inline h-4 w-4" /> Send to this rider
                  </Button>
                </div>
              ) : null}

              {order.refundStatus === "DUE" ? (
                <Button disabled={busy} onClick={() => act("mark_refunded")} className="w-full bg-amber-500 hover:bg-amber-600">
                  Mark refunded
                </Button>
              ) : null}

              {open && collectFirst && order.gasStage ? (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  Can&apos;t cancel while the customer&apos;s {laundry ? "laundry" : "cylinder"} is with the rider or the store. It has to go back first.
                </p>
              ) : open ? (
                cancelling ? (
                  <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-3">
                    <label htmlFor="cancel-reason" className="text-sm font-medium text-red-800">
                      Why is it cancelled? The customer sees this.
                    </label>
                    <textarea
                      id="cancel-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-red-200 bg-white p-2 text-sm"
                      placeholder="e.g. The store is out of this item"
                    />
                    <div className="flex gap-2">
                      <Button
                        disabled={busy || !reason.trim()}
                        onClick={() => act("reject", { cancelReason: reason.trim() })}
                        className="flex-1 bg-red-600 hover:bg-red-700"
                      >
                        Cancel order
                      </Button>
                      <Button variant="outline" onClick={() => setCancelling(false)} className="flex-1">
                        Keep it
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setCancelling(true)}
                    className="w-full border-red-300 text-red-600"
                  >
                    <XCircle className="mr-1 inline h-4 w-4" />
                    {order.status === "PLACED" ? "Decline order" : "Cancel order"}
                  </Button>
                )
              ) : null}

              {!open && order.refundStatus !== "DUE" && !(order.gasMode === "EXCHANGE" && !order.gasEmptyReturnedAt && order.status !== "CANCELLED") ? (
                <p className="text-sm text-gray-500">Nothing to do: this order is finished.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/food-orders" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
      <ArrowLeft className="h-4 w-4" /> Store orders
    </Link>
  );
}

function Row({ label, value, strong }: { label: string; value?: number | null; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t pt-1.5 font-semibold text-gray-900" : "text-gray-700"}`}>
      <dt>{label}</dt>
      <dd>{value == null ? "—" : formatCurrency(value)}</dd>
    </div>
  );
}

function Contact({
  icon: Icon,
  role,
  person,
  detail,
}: {
  icon: LucideIcon;
  role: string;
  person?: Person | null;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">{role}</p>
        <p className="truncate text-sm font-medium text-gray-900">{person?.name || "—"}</p>
        {detail ? <p className="truncate text-xs text-gray-500">{detail}</p> : null}
        {person?.phone ? (
          <div className="mt-1.5 flex gap-2">
            <a
              href={`tel:${person.phone}`}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Phone className="h-3 w-3" /> {person.phone}
            </a>
            <a
              href={whatsappLink(person.phone)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-green-200 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
            >
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
