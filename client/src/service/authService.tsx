import { useRiderStore } from "@/store/riderStore";
import { tokenStorage } from "@/store/storage";
import { useUserStore } from "@/store/userStore";
import { resetAndNavigate } from "@/utils/Helpers";
import axios from "axios";
import { Alert, Platform } from "react-native";
import { apiPost } from "./apiClient";
import { ensureApiBaseUrl, getApiBaseUrl, getPhysicalDeviceNetworkHelp } from "./config";
import { clearSession } from "./session";

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

export const requestOtp = async (payload: { phone: string; method?: "sms" }) => {
  try {
    return await apiPost<{ msg?: string }>("/auth/request-otp", {
      phone: payload.phone,
      method: payload.method || "sms",
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
