import { MessageButton, MessageType } from "@/components/shared/MessagePopup";

export interface BridgeShowOptions {
  title: string;
  message?: string;
  type?: MessageType;
  buttons?: MessageButton[];
  dismissOnBackdrop?: boolean;
}

type ShowFn = (options: BridgeShowOptions) => void;
type HideFn = () => void;

let showFn: ShowFn | null = null;
let hideFn: HideFn | null = null;

export function registerAlertBridge(show: ShowFn, hide: HideFn): void {
  showFn = show;
  hideFn = hide;
}

export function clearAlertBridge(): void {
  showFn = null;
  hideFn = null;
}

export function bridgeShowMessage(options: BridgeShowOptions): void {
  showFn?.(options);
}

export function bridgeHideMessage(): void {
  hideFn?.();
}
