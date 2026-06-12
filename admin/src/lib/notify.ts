export type NotificationType = "success" | "error" | "info" | "warning";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

type PushFn = (payload: NotificationPayload) => void;

let pushFn: PushFn | null = null;

export function registerNotifier(fn: PushFn) {
  pushFn = fn;
}

export function unregisterNotifier() {
  pushFn = null;
}

function push(payload: NotificationPayload) {
  pushFn?.(payload);
}

function inferTypeFromText(text: string): NotificationType {
  const lower = text.toLowerCase();
  if (/failed|error|could not|cannot|invalid|missing|required|unable/.test(lower)) {
    return "error";
  }
  if (/saved|success|created|updated|deleted|uploaded|sent|removed/.test(lower)) {
    return "success";
  }
  if (/warning|careful|caution/.test(lower)) {
    return "warning";
  }
  return "info";
}

export function notifyFromAlert(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  const parts = trimmed.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const title = parts[0] ?? trimmed;
  const message = parts.length > 1 ? parts.slice(1).join("\n") : undefined;
  const type = inferTypeFromText(trimmed);

  const duration = type === "error" ? 9000 : type === "success" ? 4500 : 6000;
  push({ type, title, message, duration });
}

export const notify = {
  success(title: string, message?: string) {
    push({ type: "success", title, message, duration: 4500 });
  },
  error(title: string, message?: string) {
    push({ type: "error", title, message, duration: 9000 });
  },
  info(title: string, message?: string) {
    push({ type: "info", title, message, duration: 6000 });
  },
  warning(title: string, message?: string) {
    push({ type: "warning", title, message, duration: 7000 });
  },
  fromAlert: notifyFromAlert,
};
