import { useRiderStore } from "@/store/riderStore";
import { tokenStorage } from "@/store/storage";
import { useUserStore } from "@/store/userStore";
import { resetAndNavigate } from "@/utils/Helpers";
import axios from "axios";
import { Alert, Platform } from "react-native";
import { apiPost } from "./apiClient";
import { ensureApiBaseUrl, getApiBaseUrl, getPhysicalDeviceNetworkHelp } from "./config";
import { clearSession } from "./session";
import { getReviewAccount } from "@/utils/reviewLogin";

export const signin = async (
  payload: {
    phone: string;
  },
  updateAccessToken: () => void
) => {
  const { setUser } = useUserStore.getState();
  const { setUser: setRiderUser } = useRiderStore.getState();

  try {
    const base = await ensureApiBaseUrl();
    const res = await axios.post(`${base}/auth/signin`, payload);
    
    // Clear the opposite store to avoid conflicts
    if (res.data.user.role === "customer") {
      const { clearRiderData } = useRiderStore.getState();
      clearRiderData();
      setUser(res.data.user);
    } else {
      const { clearData } = useUserStore.getState();
      clearData();
      setRiderUser(res.data.user);
    }

    tokenStorage.set("access_token", res.data.access_token);
    tokenStorage.set("refresh_token", res.data.refresh_token);

    if (res.data.user.role === "customer") {
        resetAndNavigate("/customer");
    } else {
      resetAndNavigate("/rider/home");
    }

    updateAccessToken();
    void import("./pushNotifications").then((m) => m.refreshPushRegistration());
  } catch (error: any) {
    const message = error?.response?.data?.msg || error?.message || "Something went wrong. Please try again.";
    Alert.alert("Sign in failed", message);
    if (error.response) {
      console.log("Server response:", error.response.status, error.response.data);
    }
  }
};

/** Sign in Google review accounts without the OTP screen. Returns true if handled. */
export const tryReviewLogin = async (
  phone: string,
  updateAccessToken: () => void
) => {
  const account = getReviewAccount(phone);
  if (!account) return false;
  await verifyOtp({ phone, otp: account.otp }, updateAccessToken);
  return true;
};

/** Digits in a sign-in code: 6 from Arkesel's OTP service, 4 when the server falls back. */
export type OtpRequestResult = { msg?: string; codeLength?: number; ussdCode?: string | null };

export const requestOtp = async (payload: { phone: string; method?: "sms" }) => {
  try {
    return await apiPost<OtpRequestResult>("/auth/request-otp", {
      phone: payload.phone,
      method: payload.method || "sms",
      // This app can take Arkesel's 6-digit codes (older versions only had 4 boxes).
      codeLength: 6,
    });
  } catch (error: any) {
    const msg =
      (typeof error?.data === "object" && error?.data?.msg) ||
      error?.message ||
      "Unknown error";
    console.log("Error requesting OTP:", msg, "| API:", getApiBaseUrl());
    if (error?.message === "Network Error") {
      Alert.alert("Cannot reach server", getPhysicalDeviceNetworkHelp());
    }
    throw error;
  }
};

export const verifyOtp = async (
  payload: {
    phone: string;
    otp: string;
  },
  updateAccessToken: () => void
) => {
  const { setUser } = useUserStore.getState();
  const { setUser: setRiderUser } = useRiderStore.getState();

  try {
    const res = await apiPost<{
      user: { role: string };
      access_token: string;
      refresh_token: string;
    }>("/auth/verify-otp", payload);

    // Clear the opposite store to avoid conflicts
    if (res.user.role === "customer") {
      const { clearRiderData } = useRiderStore.getState();
      clearRiderData();
      setUser(res.user);
    } else {
      const { clearData } = useUserStore.getState();
      clearData();
      setRiderUser(res.user);
    }

    tokenStorage.set("access_token", res.access_token);
    tokenStorage.set("refresh_token", res.refresh_token);

    if (res.user.role === "customer") {
      resetAndNavigate("/customer");
    } else {
      resetAndNavigate("/rider/home");
    }

    updateAccessToken();
    void import("./pushNotifications").then((m) => m.refreshPushRegistration());
    return res;
  } catch (error: any) {
    console.log("Error verifying OTP:", error?.response?.data?.msg || error.message);
    throw error;
  }
};

export const logout = async (disconnect?: () => void) => {
  if (disconnect) {
    disconnect();
  }
  clearSession();
};

/**
 * Account deletion (required by Google Play). Asks twice, then the server removes personal data
 * and blocks sign-in. The server refuses while a trip/order is active or a rider has money owed.
 */
export const confirmDeleteAccount = (disconnect?: () => void) => {
  Alert.alert(
    "Delete your account?",
    "Your personal details will be removed and you'll be signed out. This can't be undone.",
    [
      { text: "Keep account", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { appAxios } = await import("./apiInterceptors");
            await appAxios.delete("/auth/account");
            await logout(disconnect);
            Alert.alert("Account deleted", "Your account has been deleted.");
          } catch (error: any) {
            Alert.alert(
              "Couldn't delete account",
              error?.response?.data?.msg || "Please try again or contact support."
            );
          }
        },
      },
    ]
  );
};
