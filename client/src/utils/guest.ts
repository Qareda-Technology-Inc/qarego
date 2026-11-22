/**
 * Browsing without an account (Apple guideline 5.1.1(v)): anyone can look at services, stores,
 * menus and prices. Account features (ordering, booking, orders, profile) ask to sign in first,
 * and after signing in the customer comes back to the screen they were on.
 */
import { Alert } from "react-native";
import { router } from "expo-router";
import { tokenStorage } from "@/store/storage";

const GUEST_KEY = "guest_browse";

export const isSignedIn = () => !!tokenStorage.getString("access_token");

/** Chose "Browse without an account" and hasn't signed in since (remembered across launches). */
export const isGuestBrowsing = () => !isSignedIn() && tokenStorage.getString(GUEST_KEY) === "1";

export function startGuestBrowsing() {
  tokenStorage.set(GUEST_KEY, "1");
}

export function endGuestBrowsing() {
  tokenStorage.delete(GUEST_KEY);
}

let returnAfterSignIn = false;

/** Open the sign-in screen; once signed in, the customer is brought back here. */
export function goToSignIn() {
  returnAfterSignIn = true;
  router.push("/role");
}

/** True once, right after a sign-in that started from a guest screen. */
export function consumeReturnAfterSignIn(): boolean {
  const pending = returnAfterSignIn;
  returnAfterSignIn = false;
  return pending;
}

/** The sign-in screen was left without signing in. */
export function cancelReturnAfterSignIn() {
  returnAfterSignIn = false;
}

/**
 * Guard an account-only action. Signed in: returns true. Guest: explains and offers to sign in,
 * returns false (the caller stops).
 */
export function requireAccount(action = "continue"): boolean {
  if (isSignedIn()) return true;
  Alert.alert(
    `Sign in to ${action}`,
    "You can look around without an account. To order or book, sign in with your phone number. It takes a minute.",
    [
      { text: "Not now", style: "cancel" },
      { text: "Sign in", onPress: goToSignIn },
    ]
  );
  return false;
}
