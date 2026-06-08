"use client";

import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export default function AlertBridge() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const nativeAlert = window.alert.bind(window);
    window.alert = (msg?: unknown) => {
      const text = typeof msg === "string" ? msg : String(msg ?? "Action completed.");
      setMessage(text);
    };
    return () => {
      window.alert = nativeAlert;
    };
  }, []);

  return (
    <Modal isOpen={!!message} onClose={() => setMessage(null)} title="Notice">
      <div className="space-y-4">
        <p className="text-sm text-gray-700 whitespace-pre-line">{message}</p>
        <div className="flex justify-end">
          <Button onClick={() => setMessage(null)}>OK</Button>
        </div>
      </div>
    </Modal>
  );
}

