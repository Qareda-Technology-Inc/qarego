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
