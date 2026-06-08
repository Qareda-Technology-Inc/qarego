
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Loader2, Eye, UserPlus } from 'lucide-react';
import { getTripTypeBadge } from '@/lib/parcelMode';

export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RIDE' | 'DELIVERY'>('ALL');
  const [assignModal, setAssignModal] = useState<{
    rideId: string;
    serviceType: string;
  } | null>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    loadTrips();
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    if (assignModal) {
      fetcher("/admin/dispatch/drivers?status=active")
        .then((data) => setDrivers(data.drivers || []))
        .catch(() => setDrivers([]));
    }
  }, [assignModal]);

  const loadTrips = async () => {
    setLoading(true);
    try {
      const data = await fetcher(`/admin/trips?page=${page}&limit=10&status=${statusFilter}&type=${typeFilter}`);
      setTrips(data.trips);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error("Failed to load trips", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAssign = async (rideId: string, driverId: string) => {
    setAssignError(null);
    setAssigningDriverId(driverId);
    try {
      await fetcher(`/admin/rides/${rideId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ driverId }),
      });
      setAssignModal(null);
      loadTrips();
    } catch (e: any) {
      setAssignError(e?.message || 'Failed to assign');
    } finally {
      setAssigningDriverId(null);
    }
  };

  const assignServiceType = assignModal?.serviceType || "RIDE";
  const eligibleDrivers = drivers.filter((d: any) => {
    const prefs = d.effectivePreferences;
    if (prefs && typeof prefs === "object") {
      return !!prefs[assignServiceType];
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Trips Management</h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as 'ALL' | 'RIDE' | 'DELIVERY');
              setPage(1);
            }}
          >
            <option value="ALL">All (Rides + Parcels)</option>
            <option value="RIDE">Rides only</option>
            <option value="DELIVERY">Parcels only</option>
          </select>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="SEARCHING_FOR_RIDER">Searching</option>
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {!loading && trips.length > 0 && (
            <div className="md:hidden divide-y divide-gray-200">
              {trips.map((trip: any) => {
                const typeBadge = getTripTypeBadge(trip);
                return (
                <div key={trip._id} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(trip.createdAt).toLocaleString()}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeBadge.className}`}>
                      {typeBadge.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{trip.customer?.name || "Unknown"}</span>
                    {trip.customer?.phone ? ` · ${trip.customer.phone}` : ""}
                  </p>
                  <p className="text-sm text-gray-600">
                    Driver: {trip.rider?.name || "Unassigned"}
                  </p>
                  <p className="text-sm text-gray-800 line-clamp-2">
                    <span className="text-green-700 font-bold">●</span>{" "}
                    <span className="font-medium text-gray-900">Pickup:</span> {trip.pickup?.address}
                  </p>
                  <p className="text-sm text-gray-800 line-clamp-2">
                    <span className="text-red-700 font-bold">●</span>{" "}
                    <span className="font-medium text-gray-900">Drop:</span> {trip.drop?.address}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="font-semibold text-gray-900">{formatCurrency(trip.fare)}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(trip.status)}`}>
                      {trip.status.replace(/_/g, " ")}
                    </span>
                    <Link href={`/trips/${trip._id}`} className="ml-auto text-sm text-blue-600 font-medium">
                      View
                    </Link>
                    {trip.status === "SEARCHING_FOR_RIDER" && (
                      <button
                        type="button"
                        onClick={() =>
                          setAssignModal({
                            rideId: trip._id,
                            serviceType: trip.serviceType || "RIDE",
                          })
                        }
                        className="text-sm text-amber-600 font-medium"
                      >
                        Assign
                      </button>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          )}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase font-medium">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Driver</th>
                  <th className="px-6 py-3">Route</th>
                  <th className="px-6 py-3">Fare</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center">
                      <div className="flex justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                      </div>
                    </td>
                  </tr>
                ) : trips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      No trips found.
                    </td>
                  </tr>
                ) : (
                  trips.map((trip: any) => {
                    const typeBadge = getTripTypeBadge(trip);
                    return (
                    <tr key={trip._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                        {new Date(trip.createdAt).toLocaleDateString()} <br/>
                        <span className="text-xs text-gray-500">{new Date(trip.createdAt).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${typeBadge.className}`}>
                          {typeBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{trip.customer?.name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{trip.customer?.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{trip.rider?.name || 'Unassigned'}</div>
                        <div className="text-xs text-gray-500">{trip.rider?.phone}</div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="truncate mb-1 text-gray-900" title={trip.pickup?.address}>
                          <span className="text-green-700 font-bold mr-1">●</span>
                          <span className="font-semibold mr-1">Pickup:</span>
                          {trip.pickup?.address}
                        </div>
                        <div className="truncate text-gray-900" title={trip.drop?.address}>
                          <span className="text-red-700 font-bold mr-1">●</span>
                          <span className="font-semibold mr-1">Drop:</span>
                          {trip.drop?.address}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {formatCurrency(trip.fare)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(trip.status)}`}>
                          {trip.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/trips/${trip._id}`} className="inline-flex items-center text-blue-600 hover:underline mr-2">
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Link>
                        {trip.status === 'SEARCHING_FOR_RIDER' && (
                          <button
                            type="button"
                            onClick={() =>
                          setAssignModal({
                            rideId: trip._id,
                            serviceType: trip.serviceType || "RIDE",
                          })
                        }
                            className="inline-flex items-center text-amber-600 hover:underline"
                          >
                            <UserPlus className="h-4 w-4 mr-1" /> Assign
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="text-sm text-gray-500 text-center sm:text-left">
          Page {page} of {totalPages || 1}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Modal
        isOpen={!!assignModal}
        onClose={() => { setAssignModal(null); setAssignError(null); }}
        title="Assign driver"
      >
        <div className="space-y-4">
          {assignError && <p className="text-sm text-red-600">{assignError}</p>}
          <p className="text-sm text-gray-500">
            Eligible active drivers for{" "}
            <span className="font-medium">
              {assignServiceType === "FOOD"
                ? "food"
                : assignServiceType === "DELIVERY"
                  ? "parcel"
                  : "ride"}
            </span>{" "}
            offers.
          </p>
          <ul className="max-h-60 overflow-y-auto border rounded divide-y">
            {eligibleDrivers.length === 0 ? (
              <li className="px-4 py-3 text-gray-500">No eligible drivers for this service type.</li>
            ) : (
              eligibleDrivers.map((d: any) => (
                <li key={d._id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium block">{d.name}</span>
                    <span className="text-sm text-gray-500">
                      {d.phone}
                      {d.effectiveMode ? ` · ${d.effectiveMode}` : ""}
                    </span>
                  </div>
                  <Button
                    className="w-full sm:w-auto shrink-0"
                    size="sm"
                    disabled={assigningDriverId === d._id}
                    onClick={() => assignModal && handleAssign(assignModal.rideId, d._id)}
                  >
                    {assigningDriverId === d._id ? 'Assigning...' : 'Assign'}
                  </Button>
                </li>
              ))
            )}
          </ul>
        </div>
      </Modal>
    </div>
  );
}
