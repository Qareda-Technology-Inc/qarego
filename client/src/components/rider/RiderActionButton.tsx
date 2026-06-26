import React, { FC } from "react";
import { View, TouchableOpacity, Linking, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SwipeButton from "rn-swipe-button";
import { RFValue } from "react-native-responsive-fontsize";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomText from "../shared/CustomText";
import { getRiderDeliveryPhase } from "@/utils/riderCourierUi";
import { riderDeliveryStyles as s } from "@/styles/riderDeliveryStyles";

type Props = {
  ride: any;
  title: string;
  meetLabel?: string;
  contactPhone?: string;
  pickupLabel?: string;
  dropLabel?: string;
  onPress: () => void;
  swipeColor?: string;
};

const RiderActionButton: FC<Props> = ({
  ride,
  title,
  meetLabel = "Contact",
  contactPhone,
  pickupLabel = "Pickup",
  dropLabel = "Drop",
  onPress,
  swipeColor,
}) => {
  const insets = useSafeAreaInsets();
  const phase = getRiderDeliveryPhase(ride);
  const accent = swipeColor ?? phase.swipeColor;
  const phone = contactPhone ?? ride?.customer?.phone;
  const customerName =
    ride?.customer?.name ||
    ride?.recipientName ||
    (ride?.serviceType === "DELIVERY" ? "Recipient" : "Customer");

  const ThumbIcon = () => (
    <Ionicons name="chevron-forward" size={28} color="#fff" style={{ marginLeft: 2 }} />
  );

  const callCustomer = () => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const navigateToCurrentLeg = () => {
    const destination = ride?.status === "START" ? ride?.pickup : ride?.drop;
    const lat = Number(destination?.latitude);
    const lng = Number(destination?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert("Navigation unavailable", "Destination coordinates are missing.");
      return;
    }

    const googleMapsUrl = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}&directionsmode=driving`,
      android: `google.navigation:q=${lat},${lng}`,
    });
    const appleMapsUrl = `maps://app?daddr=${lat},${lng}&directionsmode=driving`;
    const webMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

    const fallback = () => Linking.openURL(webMapsUrl).catch(() => {});

    if (Platform.OS === "ios") {
      Linking.canOpenURL(appleMapsUrl)
        .then((supported) =>
          supported ? Linking.openURL(appleMapsUrl) : Linking.openURL(googleMapsUrl || webMapsUrl)
        )
        .catch(fallback);
      return;
    }

    Linking.canOpenURL(googleMapsUrl || webMapsUrl)
      .then((supported) => Linking.openURL(supported ? googleMapsUrl || webMapsUrl : webMapsUrl))
      .catch(fallback);
  };

  const navTargetLabel = ride?.status === "START" ? pickupLabel : dropLabel;

  return (
    <View style={[s.panel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={s.handle} />

      <View style={s.phaseRow}>
        <View style={[s.phaseBadge, { backgroundColor: `${phase.accentColor}18` }]}>
          <CustomText fontSize={11} fontFamily="SemiBold" style={{ color: phase.accentColor }}>
            Step {phase.step} of {phase.totalSteps}
          </CustomText>
        </View>
        <CustomText fontFamily="SemiBold" fontSize={15} style={s.phaseLabel}>
          {phase.phaseLabel}
        </CustomText>
        <CustomText fontSize={12} color="#64748b" style={{ marginTop: 4, lineHeight: 18 }}>
          {phase.phaseHint}
        </CustomText>
      </View>

      <View style={s.contactCard}>
        <View style={s.contactAvatar}>
          <Ionicons name="person" size={20} color="#64748b" />
        </View>
        <View style={s.contactBody}>
          <CustomText fontSize={11} color="#94a3b8">
            {meetLabel}
          </CustomText>
          <CustomText fontFamily="SemiBold" fontSize={15} numberOfLines={1}>
            {customerName}
          </CustomText>
          {phone ? (
            <CustomText fontSize={12} color="#64748b" style={{ marginTop: 2 }}>
              {phone}
            </CustomText>
          ) : null}
        </View>
        {phone ? (
          <TouchableOpacity style={s.callBtn} onPress={callCustomer} activeOpacity={0.85}>
            <Ionicons name="call" size={20} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={s.routeCard}>
        <View style={s.routeRow}>
          <View style={s.pickupDot} />
          <View style={s.routeLine} />
          <View style={s.routeContent}>
            <CustomText fontSize={10} fontFamily="SemiBold" style={s.routeLabel}>
              {pickupLabel}
            </CustomText>
            <CustomText fontSize={13} fontFamily="Medium" numberOfLines={2}>
              {ride?.pickup?.address || "—"}
            </CustomText>
          </View>
        </View>
        <View style={[s.routeRow, { marginTop: 12 }]}>
          <View style={s.dropDot} />
          <View style={s.routeContent}>
            <CustomText fontSize={10} fontFamily="SemiBold" style={s.routeLabel}>
              {dropLabel}
            </CustomText>
            <CustomText fontSize={13} fontFamily="Medium" numberOfLines={2}>
              {ride?.drop?.address || "—"}
            </CustomText>
          </View>
        </View>
      </View>

      <TouchableOpacity style={s.navigateBtn} activeOpacity={0.9} onPress={navigateToCurrentLeg}>
        <Ionicons name="navigate" size={17} color="#fff" />
        <CustomText fontSize={13} fontFamily="SemiBold" style={s.navigateBtnText}>
          Navigate to {navTargetLabel}
        </CustomText>
      </TouchableOpacity>

      <SwipeButton
        containerStyles={s.swipeContainer}
        height={52}
        shouldResetAfterSuccess
        resetAfterSuccessAnimDelay={300}
        onSwipeSuccess={onPress}
        railBackgroundColor={accent}
        railStyles={s.swipeRail}
        railBorderColor="transparent"
        railFillBackgroundColor="rgba(255,255,255,0.25)"
        railFillBorderColor="transparent"
        titleColor="#fff"
        titleFontSize={RFValue(14)}
        titleStyles={s.swipeTitle}
        thumbIconComponent={ThumbIcon}
        thumbIconStyles={[s.swipeThumb, { backgroundColor: accent }]}
        title={title}
        thumbIconBackgroundColor="#fff"
        thumbIconBorderColor="transparent"
        thumbIconHeight={44}
        thumbIconWidth={52}
      />
    </View>
  );
};

export default RiderActionButton;
