"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Car, Loader2, MessageCircle, Package, Phone, ShoppingBag, Star } from "lucide-react";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type History = {
  customer: {
    _id: string;
    name?: string;
    phone?: string;
    email?: string;
    averageRating?: number;
    totalRatings?: number;
    isSuspended?: boolean;
    createdAt: string;
    deletedAt?: string | null;
  };
  totals: { trips: number; orders: number; spent: number };
  rides: {
    _id: string;
    serviceType: string;
    status: string;
    fare: number;
    pickup?: { address?: string };
    drop?: { address?: string };
    rider?: { name?: string } | null;
    createdAt: string;
  }[];
  orders: {
    _id: string;
    restaurantName?: string;
    restaurant?: { imageEmoji?: string; vertical?: string } | null;
    status: string;
    total: number;
    fulfillmentType?: string;
    cancelReason?: string | null;
    createdAt: string;
  }[];
};

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  SEARCHING_FOR_RIDER: "bg-yellow-100 text-yellow-800",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-blue-100 text-blue-800"}`}>
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

export default function CustomerHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"trips" | "orders">("trips");

  useEffect(() => {
    let alive = true;
    fetcher(`/customers/${id}/history`)
      .then((d: History) => alive && setData(d))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Couldn't load this customer"));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const c = data.customer;
  return (
    <div className="min-w-0 space-y-6">
      <BackLink />

      <Card>
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-600">
              {(c.name || "?").charAt(0).toUpperCase()}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{c.name || "Customer"}</h1>
                {c.deletedAt ? (
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">Account closed</span>
                ) : c.isSuspended ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Suspended</span>
                ) : null}
              </div>
              <p className="text-sm text-gray-500">
                Joined {new Date(c.createdAt).toLocaleDateString()}
                {c.email ? ` · ${c.email}` : ""}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm text-gray-700">
                <Star className="h-4 w-4 fill-current text-yellow-400" />
                {c.averageRating ? c.averageRating.toFixed(1) : "No ratings"}{" "}
                {c.totalRatings ? <span className="text-gray-400">({c.totalRatings})</span> : null}
              </p>
              {c.phone ? (
                <div className="mt-2 flex gap-2">
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Phone className="h-3 w-3" /> {c.phone}
                  </a>
                  <a
                    href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
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
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat label="Trips" value={String(data.totals.trips)} />
            <Stat label="Orders" value={String(data.totals.orders)} />
            <Stat label="Spent" value={formatCurrency(data.totals.spent)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <CardTitle className="mr-auto text-base">History</CardTitle>
          {(["trips", "orders"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === t ? "bg-gray-900 text-white" : "border text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t === "trips" ? `Trips (${data.rides.length})` : `Store orders (${data.orders.length})`}
            </button>
          ))}
        </CardHeader>
        <CardContent>
          {tab === "trips" ? (
            data.rides.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No trips yet.</p>
            ) : (
              <ul className="divide-y">
                {data.rides.map((r) => (
                  <li key={r._id}>
                    <Link href={`/trips/${r._id}`} className="flex items-center gap-3 py-3 hover:bg-gray-50">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                        {r.serviceType === "DELIVERY" ? <Package className="h-4 w-4" /> : <Car className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-gray-900">
                          {r.pickup?.address ?? "Pickup"} → {r.drop?.address ?? "Drop-off"}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {new Date(r.createdAt).toLocaleString()}
                          {r.rider?.name ? ` · ${r.rider.name}` : ""}
                        </span>
                      </span>
                      <StatusPill status={r.status} />
                      <span className="w-20 shrink-0 text-right text-sm font-medium text-gray-900">{formatCurrency(r.fare)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : data.orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No store orders yet.</p>
          ) : (
            <ul className="divide-y">
              {data.orders.map((o) => (
                <li key={o._id}>
                  <Link href={`/food-orders/${o._id}`} className="flex items-center gap-3 py-3 hover:bg-gray-50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">
                      {o.restaurant?.imageEmoji || <ShoppingBag className="h-4 w-4 text-gray-600" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-900">{o.restaurantName || "Store"}</span>
                      <span className="block text-xs text-gray-500">
                        {new Date(o.createdAt).toLocaleString()}
                        {o.fulfillmentType === "PICKUP" ? " · pickup" : ""}
                        {o.cancelReason ? ` · ${o.cancelReason}` : ""}
                      </span>
                    </span>
                    <StatusPill status={o.status} />
                    <span className="w-20 shrink-0 text-right text-sm font-medium text-gray-900">{formatCurrency(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {(tab === "trips" ? data.rides.length : data.orders.length) === 50 ? (
            <p className="pt-3 text-xs text-gray-400">Showing the latest 50.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
      <ArrowLeft className="h-4 w-4" /> Customers
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
