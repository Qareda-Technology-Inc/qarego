import { Alert, AlertButton } from "react-native";
import { bridgeShowMessage } from "./alertBridge";
import { MessageButton, MessageType } from "@/components/shared/MessagePopup";
import { useConnectivity } from "@/service/connectivity";

const NETWORK_ERROR_RE = /^(network error|network request failed|timeout of \d+ms exceeded|request timed out)$/i;
function isNetworkErrorText(text?: string): boolean {
  return !!text && NETWORK_ERROR_RE.test(text.trim());
}

let installed = false;
let originalAlert: typeof Alert.alert | null = null;

function inferType(title?: string, buttons?: AlertButton[]): MessageType {
  const t = (title || "").toLowerCase();
  if (t.includes("error") || t.includes("failed") || t.includes("wrong")) return "error";
  if (t.includes("warning")) return "warning";
  if (t.includes("success")) return "success";
  // The question-mark "confirm" style is for real choices. A single-button notice
  // ("Ride Started!", "Order placed") is informational, not a question.
  return buttons && buttons.length > 1 ? "confirm" : "info";
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
    // Raw "Network Error" popups: the offline banner already says so, and when it isn't up
    // yet a plain explanation beats axios' wording.
    if (isNetworkErrorText(message) || isNetworkErrorText(title)) {
      if (!useConnectivity.getState().online) return;
      bridgeShowMessage({
        title: "Connection problem",
        message: "We couldn't reach QareGO. Check your internet and try again.",
        type: "warning",
        buttons: mapButtons(buttons),
        dismissOnBackdrop: !buttons || buttons.length <= 1,
      });
      return;
    }
    bridgeShowMessage({
      title: title || "Notice",
      message,
      type: inferType(title, buttons),
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
