import { View, FlatList, Image, Vibration, TouchableOpacity } from "react-native";
import React, { useEffect, useMemo, useState, useRef } from "react";
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
import { ensureForegroundPermission } from "@/utils/locationUtils";
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
import WelcomeSlides from "@/components/customer/onboarding/WelcomeSlides";
import SpotlightTour, { type TourStep } from "@/components/customer/onboarding/SpotlightTour";
import { RIDER_SLIDES } from "@/components/rider/onboarding/riderSlides";
import { onboardingUserId, useOnboardingStore } from "@/store/onboardingStore";

const RiderHome = () => {
  const isFocused = useIsFocused();
  const { on, off, emitIfConnected } = useWS();
  const { user, onDuty, setLocation } = useRiderStore();

  // First-time guidance: rider intro slides, then a tour of the home controls.
  const tourUserId = onboardingUserId(user);
  const tourReady = !!tourUserId;
  const welcomeSeen = useOnboardingStore((st) => st.hasSeen(tourUserId, "rider:welcome"));
  const tourSeen = useOnboardingStore((st) => st.hasSeen(tourUserId, "rider:tour:home"));
  const markSeen = useOnboardingStore((st) => st.markSeen);
  const menuRef = useRef<View>(null);
  const dutyRef = useRef<View>(null);
  const earningsRef = useRef<View>(null);
  const offersRef = useRef<View>(null);
  const tourRefs = useMemo(
    () => ({ menu: menuRef, duty: dutyRef, earnings: earningsRef }),
    []
  );
  const tourSteps = useMemo<TourStep[]>(
    () => [
      {
        key: "duty",
        target: dutyRef,
        title: "Go on duty",
        body: "Tap here to go ON-DUTY and start getting offers. Tap again to go OFF-DUTY when you stop.",
      },
      {
        key: "earnings",
        target: earningsRef,
        title: "Your status and earnings",
        body: "Shows whether you're on duty, your earnings and anything you owe. Tap it to open your earnings.",
      },
      {
        key: "offers",
        target: offersRef,
        title: "Offers appear here",
        body: "Each offer shows your pay and the pickup distance. The best match is highlighted. Accept before the timer runs out.",
      },
      {
        key: "menu",
        target: menuRef,
        title: "Your menu",
        body: "Trip history, earnings, your documents and support. Tap \"Show me around\" there to see this again.",
      },
    ],
    []
  );

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
      const status = await ensureForegroundPermission();
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
            // Not queued while offline: only the latest position matters.
            emitIfConnected("updateLocation", {
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
      <StatusBar style="dark" />
      <RiderHeader tourRefs={tourRefs} />

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

      <View ref={offersRef} collapsable={false} style={{ flex: 1 }}>
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

      <WelcomeSlides
        visible={tourReady && !welcomeSeen}
        slides={RIDER_SLIDES}
        onDone={() => markSeen(tourUserId, "rider:welcome")}
      />
      <SpotlightTour
        visible={tourReady && welcomeSeen && !tourSeen}
        steps={tourSteps}
        onDone={() => markSeen(tourUserId, "rider:tour:home")}
      />
    </View>
  );
};

export default RiderHome;

