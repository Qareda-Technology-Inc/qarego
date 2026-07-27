import React, { FC, ReactNode } from "react";
import { View, TouchableOpacity, Linking, Alert, LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomText from "../shared/CustomText";
import { Colors } from "@/utils/Constants";
import { getRiderDeliveryPhase } from "@/utils/riderCourierUi";
import { riderDeliveryStyles as s } from "@/styles/riderDeliveryStyles";
import { openMapsToPoint } from "@/utils/openMapsNavigation";

type Props = {
  ride: any;
  actionLabel: string;
  meetLabel?: string;
  contactPhone?: string;
  pickupLabel?: string;
  dropLabel?: string;
  onAction: () => void;
  actionColor?: string;
  banner?: ReactNode;
  actionLoading?: boolean;
  onPanelLayout?: (height: number) => void;
};

const RiderActionButton: FC<Props> = ({
  ride,
  actionLabel,
  meetLabel = "Contact",
  contactPhone,
  pickupLabel = "Pickup",
  dropLabel = "Drop",
  onAction,
  actionColor,
  banner,
  actionLoading = false,
  onPanelLayout,
}) => {
  const insets = useSafeAreaInsets();
  const phase = getRiderDeliveryPhase(ride);
  const accent = actionColor ?? phase.swipeColor;
  const phone = contactPhone ?? ride?.customer?.phone;
  const customerName =
    ride?.customer?.name ||
    ride?.recipientName ||
    (ride?.serviceType === "DELIVERY" ? "Recipient" : "Customer");

  const isStart = ride?.status === "START";
  const navTarget = isStart ? ride?.pickup : ride?.drop;
  const navLabel = isStart ? pickupLabel : dropLabel;
  const navAddress = isStart ? ride?.pickup?.address : ride?.drop?.address;

  const callCustomer = () => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const navigateToCurrentLeg = () => {
    if (!navTarget) {
      Alert.alert("Navigation unavailable", "Destination coordinates are missing.");
      return;
    }
    openMapsToPoint(navTarget, navLabel);
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) onPanelLayout?.(h);
  };

  return (
    <View
      style={[s.panel, s.panelCompact, { paddingBottom: Math.max(insets.bottom, 12) }]}
      onLayout={handleLayout}
    >
      <View style={s.handle} />

      <View style={s.phaseHeader}>
        <View style={[s.phaseBadge, { backgroundColor: `${phase.accentColor}22` }]}>
          <CustomText fontSize={10} fontFamily="SemiBold" style={{ color: phase.accentColor }}>
            Step {phase.step}/{phase.totalSteps}
          </CustomText>
        </View>
        <CustomText fontFamily="Bold" fontSize={18} style={s.phaseLabel}>
          {phase.phaseLabel}
        </CustomText>
        {phase.phaseHint ? (
          <CustomText fontSize={12} style={s.phaseHint}>
            {phase.phaseHint}
          </CustomText>
        ) : null}
      </View>

      {banner}

      <View style={s.destCard}>
        <View style={[s.destIconWrap, isStart ? s.destIconPickup : s.destIconDrop]}>
          <Ionicons
            name={isStart ? "flag" : "location"}
            size={18}
            color={isStart ? "#16a34a" : Colors.theme}
          />
        </View>
        <View style={s.destBody}>
          <CustomText fontSize={10} fontFamily="SemiBold" style={s.destLabel}>
            {isStart ? `Navigate to ${navLabel}` : `Heading to ${navLabel}`}
          </CustomText>
          <CustomText fontSize={14} fontFamily="Medium" numberOfLines={2} style={s.destAddress}>
            {navAddress || "—"}
          </CustomText>
        </View>
        <TouchableOpacity
          style={s.destNavChip}
          onPress={navigateToCurrentLeg}
          activeOpacity={0.85}
          accessibilityLabel="Open directions"
        >
          <Ionicons name="navigate" size={16} color={Colors.tertiary} />
        </TouchableOpacity>
      </View>

      <View style={s.contactRow}>
        <View style={s.contactMini}>
          <View style={s.contactAvatarMini}>
            <Ionicons name="person" size={16} color={Colors.theme} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <CustomText fontSize={10} style={s.meetLabel}>
              {meetLabel}
            </CustomText>
            <CustomText fontFamily="SemiBold" fontSize={13} numberOfLines={1} style={s.contactName}>
              {customerName}
            </CustomText>
          </View>
        </View>
        {phone ? (
          <TouchableOpacity style={s.callBtnSmall} onPress={callCustomer} activeOpacity={0.85}>
            <Ionicons name="call" size={18} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        style={[s.actionBtn, { backgroundColor: accent }, actionLoading && { opacity: 0.7 }]}
        activeOpacity={0.9}
        onPress={onAction}
        disabled={actionLoading}
      >
        <CustomText fontSize={15} fontFamily="Bold" style={s.actionBtnText}>
          {actionLoading ? "Please wait…" : actionLabel}
        </CustomText>
      </TouchableOpacity>
    </View>
  );
};

export default RiderActionButton;
