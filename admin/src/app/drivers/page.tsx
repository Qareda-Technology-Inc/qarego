"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Plus, Edit2, Trash2, Radio } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetcher } from "@/lib/api";

interface DispatchDriver {
  _id: string;
  name: string;
  phone: string;
  isOnline: boolean;
  status: string;
  vehicleCategory: string;
  vehicleLabel: string;
  servicePreset: string;
  effectiveMode: string;
  averageRating?: number;
  acceptanceRate?: number | null;
  offersSeen?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  motorcycle: "Motorcycle",
  pragya: "Pragya",
  comfort: "Comfort",
};

const PRESET_LABELS: Record<string, string> = {
  all: "All",
  ride_only: "Rides only",
  delivery_only: "Delivery",
  parcel_only: "Parcels",
  food_only: "Food",
  custom: "Custom",
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DispatchDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);

  const loadDrivers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (onlineOnly) params.set("online", "true");
      const qs = params.toString();
      const data = await fetcher(`/admin/dispatch/drivers${qs ? `?${qs}` : ""}`);
      setDrivers(data.drivers || []);
    } catch (error) {
      console.error("Failed to load drivers", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, onlineOnly]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this driver?")) return;
    try {
      await fetcher(`/drivers/${id}`, { method: "DELETE" });
      setDrivers(drivers.filter((d) => d._id !== id));
    } catch {
      alert("Failed to delete driver");
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await fetcher(`/drivers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      loadDrivers();
    } catch {
      alert("Failed to update status");
    }
  };

  if (loading && !drivers.length) {
    return <div className="p-6">Loading drivers...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Driver Management"
        description="Status, vehicle type, and work mode control which offers each rider receives."
        actions={
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Link href="/dispatch">
              <Button variant="outline" className="w-full sm:w-auto">
                <Radio className="mr-2 h-4 w-4" />
                Dispatch overview
              </Button>
            </Link>
            <Link href="/drivers/new" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add New Driver
              </Button>
            </Link>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border border-gray-300 px-3 text-sm"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
                <option value="suspended_debt">Suspended (debt)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Vehicle</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 rounded-md border border-gray-300 px-3 text-sm"
              >
                <option value="">All</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="pragya">Pragya</option>
                <option value="comfort">Comfort</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={onlineOnly}
                onChange={(e) => setOnlineOnly(e.target.checked)}
              />
              Online only
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium text-gray-900">Driver Directory</h3>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Online</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Work mode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accept %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active now</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {drivers.map((driver) => (
                  <tr key={driver._id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{driver.name}</div>
                      <div className="text-xs text-gray-500">{driver.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={driver.status}
                        onChange={(e) => handleStatusUpdate(driver._id, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${
                          driver.status === "active"
                            ? "bg-green-100 text-green-800"
                            : driver.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="suspended_debt">Suspended (Debt)</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {driver.isOnline ? (
                        <span className="text-green-700 font-medium">● Online</span>
                      ) : (
                        <span className="text-gray-400">Offline</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {CATEGORY_LABELS[driver.vehicleCategory] || driver.vehicleCategory}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {PRESET_LABELS[driver.servicePreset] || driver.servicePreset}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {driver.acceptanceRate != null ? (
                        <span
                          className={
                            driver.acceptanceRate < 50 && (driver.offersSeen ?? 0) >= 5
                              ? "text-amber-700 font-medium"
                              : ""
                          }
                        >
                          {driver.acceptanceRate}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[140px] truncate" title={driver.effectiveMode}>
                      {driver.effectiveMode}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/drivers/${driver._id}/edit`} className="text-indigo-600 inline-block">
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(driver._id)}
                        className="text-red-600 ml-4 inline-block"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {drivers.length === 0 && (
              <div className="text-center py-8 text-gray-500">No drivers match filters.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
