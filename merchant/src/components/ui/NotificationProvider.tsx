"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";
import {
  registerNotifier,
  unregisterNotifier,
  notifyFromAlert,
  type NotificationPayload,
  type NotificationType,
} from "@/lib/notify";

interface ToastItem extends NotificationPayload {
  id: string;
}

const TYPE_STYLES: Record<
  NotificationType,
  { icon: typeof CheckCircle2; border: string; bg: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  error: {
    icon: XCircle,
    border: "border-red-200",
    bg: "bg-red-50",
    iconColor: "text-red-600",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-amber-200",
    bg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  info: {
    icon: Info,
    border: "border-sky-200",
    bg: "bg-sky-50",
    iconColor: "text-sky-600",
  },
};

export default function NotificationProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (payload: NotificationPayload) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = { ...payload, id };
      setToasts((prev) => [...prev, item]);

      const ms = payload.duration ?? 6000;
      window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss]
  );

  useEffect(() => {
    registerNotifier(push);
    const nativeAlert = window.alert.bind(window);
    window.alert = (msg?: unknown) => {
      const text = typeof msg === "string" ? msg : String(msg ?? "Action completed.");
      notifyFromAlert(text);
    };
    return () => {
      unregisterNotifier();
      window.alert = nativeAlert;
    };
  }, [push]);

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const style = TYPE_STYLES[toast.type];
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex gap-3 rounded-xl border shadow-lg px-4 py-3 ${style.border} ${style.bg} animate-in slide-in-from-right-4 fade-in duration-200`}
          >
            <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${style.iconColor}`} aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
              {toast.message ? (
                <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line">{toast.message}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-700 hover:bg-black/5"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
