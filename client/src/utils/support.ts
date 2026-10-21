import { Alert, Linking } from "react-native";

/** Same contacts as the website footer. */
export const SUPPORT_PHONE = "+233501774210";
export const SUPPORT_EMAIL = "support@qaretech.com";

const open = (url: string, fallback: string) =>
  Linking.openURL(url).catch(() => Alert.alert("Couldn't open", fallback));

/** Help / Support: call, WhatsApp or email the QareGO team. */
export function openSupport() {
  Alert.alert("Contact QareGO support", "We're here to help with trips, orders, payments and your account.", [
    { text: "Call", onPress: () => open(`tel:${SUPPORT_PHONE}`, `Call us on ${SUPPORT_PHONE}`) },
    {
      text: "WhatsApp",
      onPress: () => open(`https://wa.me/${SUPPORT_PHONE.replace(/\D/g, "")}`, `WhatsApp us on ${SUPPORT_PHONE}`),
    },
    { text: "Email", onPress: () => open(`mailto:${SUPPORT_EMAIL}`, `Email us at ${SUPPORT_EMAIL}`) },
    { text: "Cancel", style: "cancel" },
  ]);
}

/** Safety: Ghana emergency services, plus QareGO support. */
export function openSafety() {
  Alert.alert("Safety", "In an emergency, call the services below. Report anything else to QareGO support.", [
    { text: "Police (191)", onPress: () => open("tel:191", "Call 191") },
    { text: "Ambulance (193)", onPress: () => open("tel:193", "Call 193") },
    { text: "Contact QareGO support", onPress: openSupport },
    { text: "Cancel", style: "cancel" },
  ]);
}
