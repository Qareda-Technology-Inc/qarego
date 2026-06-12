"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { formatOrderModifierLine } from "@/lib/orderDisplay";
import { fetchMerchantOrders } from "@/lib/ordersApi";
import type { FoodOrderRow } from "@/lib/orderTypes";
import { useAuth } from "@/context/AuthContext";
import { getCommerceOrderCopy } from "@/lib/commerceOrderCopy";
import { Button } from "@/components/ui/Button";
import {
  History,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Banknote,
  Smartphone,
  Bike,
  Star,
} from "lucide-react";

type StatusFilter = "" | "DELIVERED" | "CANCELLED";

const PAGE_SIZE = 20;

export default function OrderHistoryPage() {
  const { activeRestaurant, activeRestaurantId } = useAuth();
  const copy = getCommerceOrderCopy(activeRestaurant?.vertical);
  const [orders, setOrders] = useState<FoodOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState<StatusFilter>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMerchantOrders({
        view: "history",
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        paymentMethod: paymentMethod || undefined,
        fulfillmentType: fulfillmentType || undefined,
        q: search || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.pages ?? 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [status, from, to, paymentMethod, fulfillmentType, search, page, activeRestaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const clearFilters = () => {
    setStatus("");
    setFrom("");
    setTo("");
    setPaymentMethod("");
    setFulfillmentType("");
    setSearch("");
    setSearchInput("");
    setPage(1);
  };

  const hasFilters =
    status || from || to || paymentMethod || fulfillmentType || search;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <History className="h-7 w-7 text-orange-500" />
        <h1 className="text-2xl font-bold text-gray-900">Order history</h1>
        {activeRestaurant && (
          <span className="text-sm text-gray-500">
            {activeRestaurant.imageEmoji} {activeRestaurant.name}
          </span>
        )}
        <Link
          href="/orders"
          className="ml-auto text-sm text-orange-600 hover:underline font-medium"
        >
          ← {copy.backToOrders}
        </Link>
      </div>
      <p className="text-gray-600 mb-6">
        Completed and cancelled orders. Filter by date, status, payment, or search by customer or
        order ID.
      </p>

      <div className="bg-white rounded-xl border p-4 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Customer name, phone, address, or order ID…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <Button onClick={applySearch} className="bg-gray-900 hover:bg-gray-800">
            Search
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => {
              setPage(1);
              setStatus(v as StatusFilter);
            }}
            options={[
              { value: "", label: "All completed" },
              { value: "DELIVERED", label: "Delivered" },
              { value: "CANCELLED", label: "Cancelled" },
            ]}
          />
          <FilterSelect
            label="Payment"
            value={paymentMethod}
            onChange={(v) => {
              setPage(1);
              setPaymentMethod(v);
            }}
            options={[
              { value: "", label: "Any" },
              { value: "CASH", label: "Cash" },
              { value: "MOBILE_MONEY", label: "Mobile money" },
            ]}
          />
          <FilterSelect
            label="Fulfillment"
            value={fulfillmentType}
            onChange={(v) => {
              setPage(1);
              setFulfillmentType(v);
            }}
            options={[
              { value: "", label: "Any" },
              { value: "DELIVERY", label: "Delivery" },
              { value: "PICKUP", label: "Pickup" },
              { value: "SCHEDULED", label: "Scheduled" },
            ]}
          />
          <div>
            <label className="text-xs text-gray-500 block mb-1">From date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => load()}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-900 text-white flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 rounded-lg text-sm border text-gray-700 hover:bg-gray-50"
            >
              Clear filters
            </button>
          )}
          <span className="text-sm text-gray-500 ml-auto">
            {total} order{total === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
          No orders match your filters
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order._id} className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-lg">{order.customer?.name || "Customer"}</h2>
                    <StatusBadge status={order.status} />
                    <PaymentBadge method={order.paymentMethod} />
                    {order.fulfillmentType && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        {order.fulfillmentType.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{order.customer?.phone || "—"}</p>
                  {order.delivery?.address && (
                    <p className="text-sm text-gray-500 mt-1">{order.delivery.address}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">{formatCurrency(order.subtotal)}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    #{order._id.slice(-8).toUpperCase()}
                  </p>
                </div>
              </div>

              <ul className="mt-3 text-sm text-gray-800 space-y-1 border-t pt-3">
                {order.items?.map((item, i) => (
                  <li key={i}>
                    {item.quantity}× {item.name} — {formatCurrency(item.price * item.quantity)}
                    {item.modifiers?.length ? (
                      <ul className="text-gray-500 text-xs ml-4 mt-0.5 space-y-0.5">
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

              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                {order.ride?.rider?.name && (
                  <span className="flex items-center gap-1 text-indigo-700">
                    <Bike className="h-4 w-4" />
                    {order.ride.rider.name}
                  </span>
                )}
                {order.restaurantRating != null && order.restaurantRating > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {order.restaurantRating}/5
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <Button
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
      >
        {options.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
    DELIVERED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors[status] || "bg-gray-100"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
