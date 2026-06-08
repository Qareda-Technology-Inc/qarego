"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Bike, Loader2, Wifi } from "lucide-react";

export type RiderOption = {
  _id: string;
  name: string;
  phone?: string;
  isOnline?: boolean;
  vehicle?: string;
};

type AssignRiderModalProps = {
  open: boolean;
  onClose: () => void;
  orderLabel?: string;
  onAssign: (driverId: string) => Promise<void>;
  busy?: boolean;
};

export function AssignRiderModal({
  open,
  onClose,
  orderLabel,
  onAssign,
  busy,
}: AssignRiderModalProps) {
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetcher("/merchant/riders")
      .then((data) => setRiders(data.riders || []))
      .catch(() => setRiders([]))
      .finally(() => setLoading(false));
  }, [open]);

  const handlePick = async (driverId: string) => {
    setAssigningId(driverId);
    try {
      await onAssign(driverId);
      onClose();
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Assign rider">
      <p className="text-sm text-gray-600 mb-4">
        {orderLabel
          ? `Send ${orderLabel} directly to one driver. They will receive the trip on the rider app.`
          : "Choose an active driver. The order will be marked ready and sent only to them."}
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      ) : riders.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          No active drivers available. Use &quot;Mark ready&quot; to broadcast to all online riders.
        </p>
      ) : (
        <ul className="max-h-64 overflow-y-auto border rounded-lg divide-y">
          {riders.map((r) => (
            <li
              key={r._id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 flex items-center gap-2">
                  {r.name}
                  {r.isOnline && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                      <Wifi className="h-3 w-3" /> Online
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {r.phone || "—"}
                  {r.vehicle ? ` · ${r.vehicle}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                className="w-full sm:w-auto shrink-0"
                disabled={busy || assigningId !== null}
                onClick={() => handlePick(r._id)}
              >
                {assigningId === r._id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Bike className="h-4 w-4 mr-1" /> Assign
                  </>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
