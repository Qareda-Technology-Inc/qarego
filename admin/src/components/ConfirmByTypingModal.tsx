"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * For actions that can't be undone: the admin types the exact name before the button unlocks,
 * so a slip of the mouse can't delete a store or close an account.
 */
export function ConfirmByTypingModal({
  open,
  title,
  name,
  consequences,
  actionLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  /** What the admin must type (e.g. the store name). */
  name: string;
  consequences: string[];
  actionLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  const close = () => {
    setTyped("");
    onCancel();
  };

  const confirm = async () => {
    if (!matches) return;
    setBusy(true);
    try {
      await onConfirm();
      setTyped("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={close} title={title}>
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <ul className="list-disc space-y-1 pl-4">
            {consequences.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm-name" className="text-sm text-gray-700">
            Type <strong className="select-all text-gray-900">{name}</strong> to confirm
          </label>
          <input
            id="confirm-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!matches || busy} onClick={confirm}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : actionLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
