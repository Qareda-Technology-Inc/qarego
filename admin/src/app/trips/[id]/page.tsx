"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTripTypeBadge, parseParcelMode, parcelAdminLabels } from "@/lib/parcelMode";

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const resolvePayment = async (action: "paid_cash" | "write_off") => {
    const question =
      action === "paid_cash"
        ? "Mark this trip as paid in cash? It settles as a cash trip: QareGO's commission comes off the rider's balance."
        : `Write this trip off? QareGO pays the rider ${formatCurrency(trip?.fare ?? 0)} minus commission, and the customer no longer owes it.`;
    if (!window.confirm(question)) return;
    setResolving(true);
    try {
      const data = await fetcher(`/admin/trips/${id}/payment`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      const fresh = await fetcher(`/admin/trips/${id}`);
      setTrip(fresh.trip);
      if (data?.message) alert(data.message);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't update the payment");
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetcher(`/admin/trips/${id}`);
        setTrip(data.trip);
      } catch (e) {
        console.error("Failed to load trip", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="space-y-4">
        <Link href="/trips" className="inline-flex items-center text-blue-600 hover:underline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Trips
        </Link>
        <p className="text-gray-500">Trip not found.</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "bg-green-100 text-green-800";
      case "CANCELLED": return "bg-red-100 text-red-800";
      case "IN_PROGRESS": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const typeBadge = getTripTypeBadge(trip);
  const unpaid =
    trip.status === "COMPLETED" &&
    trip.paymentMethod === "MOBILE_MONEY" &&
    ["UNPAID", "PENDING", "FAILED"].includes(trip.paymentStatus);
  const paymentLabel = trip.paidInCashAt
    ? `Paid in cash (confirmed by ${trip.cashConfirmedBy === "ADMIN" ? "admin" : "the rider"})`
    : trip.paymentMethod === "CASH"
      ? "Cash"
      : ({
          PAID: "Paid by mobile money",
          WAIVED: "Written off: QareGO paid the rider",
          PENDING: "Mobile money: payment started, not confirmed",
          FAILED: "Mobile money: payment failed",
          UNPAID: "Mobile money: not paid",
          REFUNDED: "Refunded",
        } as Record<string, string>)[trip.paymentStatus] ?? "Mobile money";
  const parcelMode = parseParcelMode(trip.parcelMode);
  const parcelLabels =
    trip.serviceType === "DELIVERY" ? parcelAdminLabels(parcelMode) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/trips" className="inline-flex items-center text-blue-600 hover:underline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Trips
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Trip Details</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${typeBadge.className}`}>
          {typeBadge.label}
        </span>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(trip.status)}`}>
          {trip.status?.replace(/_/g, " ")}
        </span>
      </div>

      {trip.serviceType === "DELIVERY" && (trip.recipientName || trip.recipientPhone || trip.parcelDescription) && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Parcel details</h3>
            {parcelLabels ? (
              <p className="text-sm text-gray-500 mt-1">{parcelLabels.direction}</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2">
            {trip.recipientName && (
              <p>
                <span className="text-xs text-gray-500">{parcelLabels?.recipientLabel ?? "Recipient"}:</span>{" "}
                {trip.recipientName}
              </p>
            )}
            {trip.recipientPhone && <p><span className="text-xs text-gray-500">Phone:</span> {trip.recipientPhone}</p>}
            {trip.parcelDescription && <p><span className="text-xs text-gray-500">Description:</span> {trip.parcelDescription}</p>}
            {trip.deliveryNote && <p><span className="text-xs text-gray-500">Note:</span> {trip.deliveryNote}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Route</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">
                {parcelLabels?.pickupLabel ?? "Pickup"}
              </p>
              <p className="text-gray-900">{trip.pickup?.address || "—"}</p>
              {trip.pickup?.latitude != null && (
                <p className="text-xs text-gray-400">
                  {trip.pickup.latitude}, {trip.pickup.longitude}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">
                {parcelLabels?.dropLabel ?? "Drop"}
              </p>
              <p className="text-gray-900">{trip.drop?.address || "—"}</p>
              {trip.drop?.latitude != null && (
                <p className="text-xs text-gray-400">
                  {trip.drop.latitude}, {trip.drop.longitude}
                </p>
              )}
            </div>
            {trip.distance != null && (
              <p className="text-sm text-gray-500">Distance: {trip.distance.toFixed(2)} km</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Fare &amp; Time</h3>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(trip.fare)}</p>
            <p className={`text-sm font-medium ${unpaid ? "text-red-700" : "text-gray-700"}`}>{paymentLabel}</p>
            {trip.latePaymentAt ? (
              <p className="text-xs text-amber-700">
                The customer also paid by mobile money after the cash payment:{" "}
                {trip.refund?.status === "processed"
                  ? "refunded."
                  : trip.refund?.status === "failed"
                    ? `automatic refund failed (${trip.refund?.error || "unknown error"}). Refund them by hand.`
                    : "refund in progress."}
              </p>
            ) : null}
            {unpaid ? (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-800">
                  The customer hasn&apos;t paid for this trip, so they can&apos;t book again until it&apos;s settled.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={resolving} onClick={() => resolvePayment("paid_cash")}>
                    Customer paid cash
                  </Button>
                  <Button size="sm" variant="outline" disabled={resolving} onClick={() => resolvePayment("write_off")}>
                    Write off and pay the rider
                  </Button>
                </div>
              </div>
            ) : null}
            <p className="text-sm text-gray-500">
              Created: {new Date(trip.createdAt).toLocaleString()}
            </p>
            {trip.updatedAt && (
              <p className="text-sm text-gray-500">
                Updated: {new Date(trip.updatedAt).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Customer</h3>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-gray-900">{trip.customer?.name || "—"}</p>
            <p className="text-sm text-gray-500">{trip.customer?.phone}</p>
            <p className="text-sm text-gray-500">{trip.customer?.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Driver</h3>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-gray-900">{trip.rider?.name || "Unassigned"}</p>
            <p className="text-sm text-gray-500">{trip.rider?.phone}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
