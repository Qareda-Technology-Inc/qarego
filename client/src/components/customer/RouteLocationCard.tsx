import React, { FC } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import LocationInput from "@/components/customer/LocationInput";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { Colors } from "@/utils/Constants";

type Props = {
  showPickup: boolean;
  pickup: string;
  drop: string;
  pickupLabel?: string;
  dropLabel?: string;
  pickupPlaceholder?: string;
  dropPlaceholder: string;
  focusedInput: "pickup" | "drop";
  onFocusPickup: () => void;
  onFocusDrop: () => void;
  onChangePickup: (text: string) => void;
  onChangeDrop: (text: string) => void;
  onSwap?: () => void;
  /** Colour of the field being edited (ride orange, parcel purple). */
  accent?: string;
};

const PICKUP = "#16a34a";

/**
 * Pickup → destination in one card: a green dot and an accent square joined by a dashed line,
 * with a round swap button on the card's edge.
 */
const RouteLocationCard: FC<Props> = ({
  showPickup,
  pickup,
  drop,
  pickupLabel = "Pickup",
  dropLabel = "Destination",
  pickupPlaceholder = "Your pickup point",
  dropPlaceholder,
  focusedInput,
  onFocusPickup,
  onFocusDrop,
  onChangePickup,
  onChangeDrop,
  onSwap,
  accent = Colors.theme,
}) => {
  const pickupOn = focusedInput === "pickup";
  const dropOn = focusedInput === "drop";
  return (
    <View style={[styles.card, { borderColor: "rgba(15, 23, 42, 0.10)" }]}>
      {showPickup ? (
        <>
          <View style={styles.row}>
            <View style={styles.markerCol}>
              <View style={[styles.dot, { backgroundColor: PICKUP }]} />
            </View>
            <View style={styles.field}>
              <CustomText fontSize={11} fontFamily="Medium" style={{ color: pickupOn ? accent : T.inkMuted }}>
                {pickupLabel}
              </CustomText>
              <LocationInput
                placeholder={pickupPlaceholder}
                type="pickup"
                value={pickup}
                onChangeText={onChangePickup}
                onFocus={onFocusPickup}
                compact
              />
            </View>
          </View>
          <View style={styles.middle}>
            <View style={styles.markerCol}>
              <View style={styles.dash} />
            </View>
            <View style={styles.divider} />
          </View>
        </>
      ) : null}

      <View style={styles.row}>
        <View style={styles.markerCol}>
          <View style={[styles.square, { backgroundColor: accent }]} />
        </View>
        <View style={styles.field}>
          <CustomText fontSize={11} fontFamily="Medium" style={{ color: dropOn ? accent : T.inkMuted }}>
            {dropLabel}
          </CustomText>
          <LocationInput
            placeholder={dropPlaceholder}
            type="drop"
            value={drop}
            onChangeText={onChangeDrop}
            onFocus={onFocusDrop}
            compact
            autoFocus={!showPickup}
          />
        </View>
      </View>

      {showPickup && onSwap ? (
        <TouchableOpacity
          style={styles.swapBtn}
          onPress={onSwap}
          activeOpacity={0.85}
          accessibilityLabel="Swap pickup and destination"
        >
          <Ionicons name="swap-vertical" size={17} color={T.ink} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    marginTop: 6,
    marginRight: 14,
    borderRadius: 18,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 22,
    paddingVertical: 4,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  markerCol: { width: 18, alignItems: "center" },
  dot: { width: 11, height: 11, borderRadius: 6 },
  square: { width: 11, height: 11, borderRadius: 2 },
  field: { flex: 1, marginLeft: 10 },
  middle: { flexDirection: "row", alignItems: "center", height: 10 },
  dash: {
    height: 26,
    marginVertical: -8,
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#94a3b8",
  },
  divider: { flex: 1, marginLeft: 10, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(15, 23, 42, 0.12)" },
  swapBtn: {
    position: "absolute",
    right: -15,
    top: "50%",
    marginTop: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default RouteLocationCard;
