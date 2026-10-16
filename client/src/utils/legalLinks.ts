import { Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";

/** Public privacy policy (also entered in Play Console / App Store Connect). */
export const PRIVACY_POLICY_URL = "https://www.qarego.com/privacy";
export const DELETE_ACCOUNT_INFO_URL = "https://www.qarego.com/delete-account";

/** Open a legal page in an in-app browser, falling back to the system browser. */
export async function openLegalPage(url: string = PRIVACY_POLICY_URL) {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url).catch(() => {});
  }
}
