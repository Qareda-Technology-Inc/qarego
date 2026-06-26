import { router } from "expo-router";
import { appAxios } from "./apiInterceptors";
import { useRiderStore } from "@/store/riderStore";
import { Alert } from "react-native";
import { resetAndNavigate } from "@/utils/Helpers";
import { tokenStorage } from "@/store/storage";
import { fetchActiveFoodOrder } from "./foodService";
import { stopRiderOfferRing } from "@/utils/ringSound";
import { emitRiderOfferAccepted } from "@/utils/riderOfferEvents";

import {
  ACTIVE_RIDER_RIDE_STATUSES,
  isAssignedActiveRide,
  riderIdFromUser,
  rideAssignedRiderId,
} from "@/utils/riderRideUtils";
import {
  clearSkipActiveRideResume,
  shouldSkipActiveRideResume,
} from "@/utils/devRideResume";

const ACTIVE_RIDER_STATUSES = [...ACTIVE_RIDER_RIDE_STATUSES];

function currentRiderId(): string {
  return riderIdFromUser(useRiderStore.getState().user);
}

function isRiderLiveTrip(ride: { status?: string; rider?: unknown } | null | undefined): boolean {
  if (!ride?.status || !ACTIVE_RIDER_STATUSES.includes(ride.status as (typeof ACTIVE_RIDER_RIDE_STATUSES)[number])) {
    return false;
  }
  const riderId = currentRiderId();
  if (!riderId) return false;
  return rideAssignedRiderId(ride) === riderId;
}

export function openAssignedRiderRide(rideId: string) {
  if (!rideId) return;
  if (shouldSkipActiveRideResume()) return;
  void stopRiderOfferRing();
  emitRiderOfferAccepted();
  resetAndNavigate({
    pathname: "/rider/liveride",
    params: { id: rideId },
  });
}

/** Jump to live trip when merchant assigned this courier or trip is already active. */
export function handleAssignedRiderRide(
  ride: Parameters<typeof isAssignedActiveRide>[0],
  riderUser: { _id?: string; id?: string } | null | undefined
): boolean {
  const riderId = riderIdFromUser(riderUser);
  if (!isAssignedActiveRide(ride, riderId)) return false;
  openAssignedRiderRide(String(ride?._id));
  return true;
}

export const fetchRiderActiveRide = async () => {
  if (shouldSkipActiveRideResume()) return null;
  if (!tokenStorage.getString("access_token")) return null;
  try {
    const res = await appAxios.get("/ride/rides");
    const rides = res.data?.rides ?? [];
    return (
      rides.find((ride: { status?: string; rider?: unknown }) =>
        isRiderLiveTrip(ride)
      ) ?? null
    );
  } catch {
    return null;
  }
};

interface coords {
  address: string;
  latitude: number;
  longitude: number;
}

export type RideFareRates = Record<
  string,
  { baseFare: number; perKmRate: number; minimumFare: number }
> | null;

export const fetchRideFareRates = async (): Promise<RideFareRates> => {
  const res = await appAxios.get("/ride/fare-rates");
  return res.data?.fareRates ?? null;
};

export const createRide = async (payload: {
  serviceType?: "RIDE" | "DELIVERY";
  vehicle: "motorcycle" | "pragya" | "comfort";
  paymentMethod?: "CASH" | "MOBILE_MONEY";
  pickup: coords;
  drop: coords;
  /** Delivery only */
  parcelMode?: "SEND" | "RECEIVE";
  recipientName?: string;
  recipientPhone?: string;
  deliveryNote?: string;
  parcelDescription?: string;
  parcelPhotoUrl?: string;
}) => {
  try {
    const res = await appAxios.post(`/ride/create`, payload);
    router?.navigate({
      pathname: "/customer/liveride",
      params: {
        id: res?.data?.ride?._id,
      },
    });
  } catch (error: any) {
    const message = error?.response?.data?.msg || error?.message || "Could not create ride. Please try again.";
    Alert.alert("Error", message);
    console.log("Error:Create Ride ", error);
  }
};

export const getRideById = async (rideId: string): Promise<any | null> => {
  if (!rideId || !tokenStorage.getString("access_token")) return null;
  try {
    const res = await appAxios.get(`/ride/${rideId}`);
    return res?.data?.ride ?? null;
  } catch (error: any) {
    if (error?.response?.status === 401) return null;
    return null;
  }
};

export type CourierLiveCoords = {
  latitude: number;
  longitude: number;
  heading?: number;
};

export const fetchCourierLocation = async (
  rideId: string
): Promise<CourierLiveCoords | null> => {
  if (!rideId || !tokenStorage.getString("access_token")) return null;
  try {
    const res = await appAxios.get(`/ride/${rideId}/courier-location`);
    const coords = res?.data?.coords;
    if (coords?.latitude == null || coords?.longitude == null) return null;
    return {
      latitude: Number(coords.latitude),
      longitude: Number(coords.longitude),
      heading: Number(coords.heading) || 0,
    };
  } catch {
    return null;
  }
};

export type RiderServicePreferencesPatch = {
  preset?: string;
  servicePreferences?: Record<
    string,
    { enabled?: boolean; schedule?: { useSchedule?: boolean; start?: string; end?: string } }
  >;
};

export const fetchRiderServiceSettings = async () => {
  const res = await appAxios.get("/ride/service-preferences");
  return res.data;
};

export const updateRiderServicePreferences = async (payload: RiderServicePreferencesPatch) => {
  const res = await appAxios.patch("/ride/service-preferences", payload);
  if (res.data?.user) {
    useRiderStore.getState().setUser(res.data.user);
  }
  return res.data;
};

/** Open ride/food offers — REST fallback when socket misses broadcast */
export const fetchPendingRideOffers = async (): Promise<any[]> => {
  if (!tokenStorage.getString("access_token")) return [];
  try {
    const res = await appAxios.get("/ride/offers/pending");
    return res.data?.rides ?? [];
  } catch {
    return [];
  }
};

export const fetchRideHistory = async () => {
  if (!tokenStorage.getString("access_token")) return [];
  try {
    const res = await appAxios.get(`/ride/rides`);
    return res.data.rides;
  } catch (error: any) {
    if (error?.response?.status === 401) return []; // Auth cleared by interceptor; avoid duplicate alert
    const message = error?.response?.data?.msg || error?.message || "Could not load ride history.";
    Alert.alert("Error", message);
    console.log("Error:GET MY Ride ", error);
    return [];
  }
};

function foodOrderIdFromRide(ride: { foodOrder?: string | { _id?: string } }): string | null {
  const fo = ride?.foodOrder;
  if (!fo) return null;
  if (typeof fo === "string") return fo;
  return fo._id?.toString?.() ?? null;
}

function isFoodCourierRide(ride: { serviceType?: string; foodOrder?: unknown }) {
  return ride?.serviceType === "FOOD" || !!ride?.foodOrder;
}

/** Resume in-progress food order or ride (customer). Returns true if navigated away. */
export const resumeCustomerSession = async (options?: {
  useReset?: boolean;
}): Promise<boolean> => {
  if (!tokenStorage.getString("access_token")) return false;

  const go = (pathname: string, params?: Record<string, string>) => {
    if (options?.useReset) {
      resetAndNavigate({ pathname, params } as { pathname: string; params?: Record<string, string> });
    } else {
      router.navigate({ pathname, params } as { pathname: string; params?: Record<string, string> });
    }
  };

  try {
    const foodOrder = await fetchActiveFoodOrder();
    if (foodOrder?._id) {
      go(`/customer/stores/order/${foodOrder._id}`);
      return true;
    }

    const res = await appAxios.get(`/ride/rides`);
    const active = res.data.rides?.filter(
      (ride: { status?: string }) => ride?.status !== "COMPLETED"
    );
    const ride = active?.[0];
    if (!ride?._id) return false;

    const orderId = foodOrderIdFromRide(ride);
    if (isFoodCourierRide(ride) && orderId) {
      go(`/customer/stores/order/${orderId}`);
      return true;
    }

    go("/customer/liveride", { id: String(ride._id) });
    return true;
  } catch (error: any) {
    if (error?.response?.status === 401) return false;
    console.log("resumeCustomerSession:", error?.message || error);
    return false;
  }
};

export const getMyRides = async (isCustomer: boolean = true) => {
  if (!tokenStorage.getString("access_token")) return;

  if (isCustomer) {
    await resumeCustomerSession();
    return;
  }

  if (shouldSkipActiveRideResume()) return;

  try {
    const res = await appAxios.get(`/ride/rides`);
    const activeRide = res.data.rides?.find((ride: { status?: string; rider?: unknown }) =>
      isRiderLiveTrip(ride)
    );
    if (activeRide?._id) {
      router.navigate({
        pathname: "/rider/liveride",
        params: { id: String(activeRide._id) },
      });
    }
  } catch (error: any) {
    if (error?.response?.status === 401) return;
    const message = error?.response?.data?.msg || error?.message || "Could not load rides.";
    Alert.alert("Error", message);
    console.log("Error:GET MY Ride ", error);
  }
};

export const declineRideOffer = async (rideId: string) => {
  try {
    await appAxios.post(`/ride/offers/${rideId}/decline`);
  } catch (e) {
    console.warn("[declineRideOffer]", e);
  }
};

export const fetchRiderReliability = async () => {
  const res = await appAxios.get("/ride/reliability");
  return res.data;
};

export const fetchRiderDispatchAnalytics = async (days = 30) => {
  const res = await appAxios.get(`/ride/dispatch-analytics?days=${days}`);
  return res.data;
};

export const acceptRideOffer = async (rideId: string) => {
  try {
    clearSkipActiveRideResume();
    await stopRiderOfferRing();
    emitRiderOfferAccepted();
    const res = await appAxios.patch(`/ride/accept/${rideId}`);
    resetAndNavigate({
      pathname: "/rider/liveride",
      params: { id: rideId },
    });
  } catch (error: any) {
    const message = error?.response?.data?.msg || error?.message || "Could not accept ride. Please try again.";
    Alert.alert("Error", message);
    console.log(error);
  }
};

export const updateRideStatus = async (
  rideId: string,
  status: string,
  otp?: string
): Promise<{ ok: true; ride: any } | { ok: false; message: string }> => {
  try {
    const res = await appAxios.patch(`/ride/update/${rideId}`, {
      status,
      ...(otp ? { otp } : {}),
    });
    return { ok: true, ride: res.data?.ride ?? null };
  } catch (error: any) {
    const message =
      error?.response?.data?.msg ||
      error?.response?.data?.message ||
      error?.message ||
      "Could not update ride status.";
    const statusCode = error?.response?.status;
    if (statusCode && statusCode >= 500) {
      Alert.alert("Error", message);
    }
    console.log("updateRideStatus:", message);
    return { ok: false, message };
  }
};

export const rateRide = async (rideId: string, rating: number, review: string) => {
  try {
    const res = await appAxios.post(`/ride/${rideId}/rate`, {
      rating,
      review,
    });
    return true;
  } catch (error: any) {
    const message = error?.response?.data?.msg || error?.message || "Could not submit rating.";
    Alert.alert("Error", message);
    console.log(error);
    return false;
  }
};
