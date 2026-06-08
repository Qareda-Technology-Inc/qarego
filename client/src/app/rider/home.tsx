import { View, FlatList, Image, Vibration, TouchableOpacity } from "react-native";
import React, { useEffect, useState, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useWS } from "@/service/WSProvider";
import { useRiderStore } from "@/store/riderStore";
import {
  getMyRides,
  fetchPendingRideOffers,
  fetchRiderReliability,
  fetchRiderActiveRide,
  handleAssignedRiderRide,
  openAssignedRiderRide,
} from "@/service/rideService";
import { router } from "expo-router";
import CustomText from "@/components/shared/CustomText";
import {
  mergeRideOffers,
  isFoodDelivery,
  isAssignedActiveRide,
  riderIdFromUser,
} from "@/utils/riderRideUtils";
import { getCommerceOrderCopy } from "@/utils/commerceOrderCopy";
import { getBestOfferId } from "@/utils/offerRanking";
import * as Location from "expo-location";
import { homeStyles } from "@/styles/homeStyles";
import { StatusBar } from "expo-status-bar";
import RiderHeader from "@/components/rider/RiderHeader";
import { riderStyles } from "@/styles/riderStyles";
import RiderRidesItem from "@/components/rider/RiderRidesItem";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import { DS } from "@/theme/designSystem";
import {
  loadRiderAlertSoundUrl,
  primeRiderOfferAudio,
  startRiderOfferRing,
  stopRiderOfferRing,
} from "@/utils/ringSound";
import { onRiderOfferAccepted } from "@/utils/riderOfferEvents";

const RiderHome = () => {
  const isFocused = useIsFocused();
  const { emit, on, off } = useWS();
  const { user, onDuty, setLocation } = useRiderStore();

  const [rideOffers, setRideOffers] = useState<any[]>([]);
  const [busyWithDelivery, setBusyWithDelivery] = useState(false);
  const [pausedServices, setPausedServices] = useState<string[]>([]);
  const bestOfferId = React.useMemo(() => getBestOfferId(rideOffers), [rideOffers]);

  const previousOffersCount = useRef(0);

  // Check for active rides on mount and when screen is focused (defer so token is ready)
  useEffect(() => {
    if (!isFocused) return;
    const t = setTimeout(() => getMyRides(false), 100);
    return () => clearTimeout(t);
  }, [isFocused]);


  useEffect(() => {
    let locationsSubscription: any;
    const startLocationUpdates = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        locationsSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 10,
          },
          (location) => {
            const { latitude, longitude, heading } = location.coords;
            setLocation({
              latitude: latitude,
              longitude: longitude,
              address: "Somewhere",
              heading: heading as number,
            });
            emit("updateLocation", {
              latitude,
              longitude,
              heading,
            });
          }
        );
      }
    };

    if (onDuty && isFocused) {
      startLocationUpdates();
    }

    return () => {
      if (locationsSubscription) {
        locationsSubscription.remove();
      }
    };
  }, [onDuty, isFocused]);

  useEffect(() => {
    // Request notification permissions
    // TODO: Uncomment after installing expo-notifications
    // Notifications.requestPermissionsAsync().catch(console.error);
  }, []);

  const checkActiveDelivery = async () => {
    const active = await fetchRiderActiveRide();
    if (active?._id) {
      setBusyWithDelivery(true);
      setRideOffers([]);
      openAssignedRiderRide(String(active._id));
      return true;
    }
    setBusyWithDelivery(false);
    return false;
  };

  const syncPendingOffers = async () => {
    if (await checkActiveDelivery()) return;
    const pending = await fetchPendingRideOffers();
    if (pending.length === 0) return;
    setRideOffers((prev) => mergeRideOffers(prev, pending));
  };

  useEffect(() => {
    if (!onDuty || !isFocused) return;

    void checkActiveDelivery().then((busy) => {
      if (!busy) syncPendingOffers();
    });
    const poll = setInterval(() => {
      syncPendingOffers();
    }, 15000);
    return () => clearInterval(poll);
  }, [onDuty, isFocused]);

  useEffect(() => {
    if (!onDuty || !isFocused) return;
    void loadRiderAlertSoundUrl();
    void primeRiderOfferAudio();
  }, [onDuty, isFocused]);

  useEffect(() => {
    if (!isFocused) return;
    fetchRiderReliability()
      .then((data) => {
        const paused = (data.services || [])
          .filter((s: { isPaused?: boolean }) => s.isPaused)
          .map((s: { label?: string }) => s.label);
        setPausedServices(paused);
      })
      .catch(() => setPausedServices([]));
  }, [isFocused, onDuty]);

  useEffect(() => {
    if (!onDuty || !isFocused || busyWithDelivery) {
      void stopRiderOfferRing();
      return;
    }
    if (rideOffers.length > 0) {
      void startRiderOfferRing();
    } else {
      void stopRiderOfferRing();
    }
    return () => {
      void stopRiderOfferRing();
    };
  }, [rideOffers.length, onDuty, isFocused, busyWithDelivery]);

  useEffect(() => onRiderOfferAccepted(() => {
    setBusyWithDelivery(true);
    setRideOffers([]);
    void stopRiderOfferRing();
  }), []);

  useEffect(() => {
    if (onDuty && isFocused) {
      const riderId = riderIdFromUser(user);

      const onAssigned = (rideDetails: any) => {
        if (handleAssignedRiderRide(rideDetails, user)) return;
        if (busyWithDelivery) return;
        setBusyWithDelivery(true);
        setRideOffers([]);
        void triggerRideNotification(rideDetails);
        openAssignedRiderRide(String(rideDetails?._id));
      };

      on("rideAssigned", onAssigned);

      on("rideOffer", (rideDetails: any) => {
        if (handleAssignedRiderRide(rideDetails, user)) return;
        if (busyWithDelivery) return;
        if (isAssignedActiveRide(rideDetails, riderId)) {
          onAssigned(rideDetails);
          return;
        }
        setRideOffers((prevOffers) => {
          const existingIds = new Set(prevOffers?.map((offer) => offer?._id));
          if (!existingIds.has(rideDetails?._id)) {
            void triggerRideNotification(rideDetails);
            return mergeRideOffers(prevOffers, [rideDetails]);
          }
          return prevOffers;
        });
      });

      on("rideCanceled", (data: any) => {
        if (data?.rideId) {
          setRideOffers((prevOffers) =>
            prevOffers.filter((offer) => offer._id !== data.rideId)
          );
        }
      });
    } else {
      setRideOffers([]);
    }

    return () => {
      off("rideAssigned");
      off("rideOffer");
      off("rideCanceled");
    };
  }, [onDuty, on, off, isFocused, busyWithDelivery, user]);

  const triggerRideNotification = async (rideDetails: any) => {
    try {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      const food = isFoodDelivery(rideDetails);
      const commerceCopy = getCommerceOrderCopy(rideDetails?.storeVertical);
      const title = food ? commerceCopy.riderNewOfferTitle : "New ride offer";
      const body = food
        ? `${rideDetails?.restaurantName || commerceCopy.riderPickupLabel} → customer · ${rideDetails?.foodOrderSummary?.slice(0, 40) || commerceCopy.riderOfferFallback}`
        : `${rideDetails?.pickup?.address?.slice(0, 30) || "Pickup"}…`;
      console.log(`[offer] ${title}: ${body}`);
    } catch (error) {
      console.log("Error showing notification:", error);
    }
  };

  const removeRide = (id: string) => {
    setRideOffers((prevOffers) =>
      prevOffers.filter((offer) => offer._id !== id)
    );
  };

  const renderRides = ({ item }: any) => {
    return (
      <RiderRidesItem
        removeIt={() => removeRide(item?._id)}
        item={item}
        isBestOffer={!!bestOfferId && item?._id === bestOfferId}
      />
    );
  };

  return (
    <View style={[homeStyles.container, { backgroundColor: DS.color.bg }]}>
      <StatusBar style="light" backgroundColor="orange" translucent={false} />
      <RiderHeader />

      {pausedServices.length > 0 ? (
        <TouchableOpacity
          style={riderStyles.reliabilityBanner}
          onPress={() => router.push("/rider/reliability")}
          activeOpacity={0.85}
        >
          <CustomText fontSize={12} fontFamily="SemiBold" style={{ color: "#92400e" }}>
            {pausedServices.join(", ")} paused — tap for details
          </CustomText>
        </TouchableOpacity>
      ) : null}

      <FlatList
        data={!onDuty || busyWithDelivery ? [] : rideOffers}
        renderItem={renderRides}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 10, paddingBottom: 120 }}
        keyExtractor={(item: any) => item?._id || Math.random().toString()}
        ListEmptyComponent={
          <View style={riderStyles?.emptyContainer}>
            <Image
              source={require("@/assets/icons/ride.jpg")}
              style={riderStyles?.emptyImage}
            />
            <EmptyStateCard
              icon={onDuty ? "📡" : "🛵"}
              title={
                busyWithDelivery
                  ? "Delivery in progress"
                  : onDuty
                  ? "Waiting for offers..."
                  : "Go ON-DUTY to start earning"
              }
              description={
                busyWithDelivery
                  ? "Finish your current trip before new offers appear."
                  : onDuty
                  ? "Offers are ranked by pay, pickup distance, and urgency. Best match is highlighted."
                  : "Toggle ON-DUTY in the header to start receiving ride requests."
              }
            />
          </View>
        }
      />

    </View>
  );
};

export default RiderHome;

