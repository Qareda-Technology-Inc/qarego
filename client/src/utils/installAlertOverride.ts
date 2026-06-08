import { Alert, AlertButton } from "react-native";
import { bridgeShowMessage } from "./alertBridge";
import { MessageButton, MessageType } from "@/components/shared/MessagePopup";

let installed = false;
let originalAlert: typeof Alert.alert | null = null;

function inferType(title?: string): MessageType {
  const t = (title || "").toLowerCase();
  if (t.includes("error") || t.includes("failed") || t.includes("wrong")) return "error";
  if (t.includes("warning")) return "warning";
  if (t.includes("success")) return "success";
  return "confirm";
}

function mapButtons(buttons?: AlertButton[]): MessageButton[] | undefined {
  if (!buttons || buttons.length === 0) return undefined;
  return buttons.map((btn) => ({
    text: btn.text || "OK",
    style: btn.style,
    onPress: btn.onPress,
  }));
}

export function installAlertOverride(): void {
  if (installed) return;
  installed = true;
  originalAlert = Alert.alert.bind(Alert);

  Alert.alert = (title?: string, message?: string, buttons?: AlertButton[]) => {
    bridgeShowMessage({
      title: title || "Notice",
      message,
      type: inferType(title),
      buttons: mapButtons(buttons),
      dismissOnBackdrop: !buttons || buttons.length <= 1,
    });
  };
}

export function uninstallAlertOverride(): void {
  if (!installed || !originalAlert) return;
  Alert.alert = originalAlert;
  installed = false;
}
