import React, { FC } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import LocationInput from "@/components/customer/LocationInput";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";

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
  onMapPress: () => void;
};

/** Bolt-style pickup → destination editor with connector line. */
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
  onMapPress,
}) => (
  <View style={styles.card}>
    <View style={styles.routeColumn}>
      {showPickup ? (
        <>
          <View style={styles.routeRow}>
            <View style={styles.markerCol}>
              <View style={[styles.dot, styles.dotPickup]} />
              <View style={styles.connector} />
            </View>
            <View style={[styles.inputCol, focusedInput === "pickup" && styles.inputColFocused]}>
              <CustomText fontSize={11} fontFamily="Medium" style={styles.fieldLabel}>
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
          {onSwap ? (
            <TouchableOpacity style={styles.swapBtn} onPress={onSwap} activeOpacity={0.85}>
              <Ionicons name="swap-vertical" size={18} color={T.ink} />
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}

      <View style={styles.routeRow}>
        <View style={styles.markerCol}>
          {!showPickup ? <View style={styles.dotSpacer} /> : null}
          <View style={[styles.dot, styles.dotDrop]} />
        </View>
        <View style={[styles.inputCol, focusedInput === "drop" && styles.inputColFocused]}>
          <CustomText fontSize={11} fontFamily="Medium" style={styles.fieldLabel}>
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
    </View>

    <TouchableOpacity style={styles.mapBtn} onPress={onMapPress} activeOpacity={0.88}>
      <Ionicons name="map-outline" size={18} color={T.ink} />
      <CustomText fontFamily="Medium" fontSize={13} style={styles.mapBtnText}>
        Set location on map
      </CustomText>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.sheetBg,
    marginTop: 8,
    borderRadius: T.radius.card,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    ...T.shadow.card,
  },
  routeColumn: {
    position: "relative",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  markerCol: {
    width: 20,
    alignItems: "center",
    paddingTop: 28,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
    ...T.shadow.card,
  },
  dotPickup: {
    backgroundColor: T.success,
  },
  dotDrop: {
    backgroundColor: T.danger,
  },
  dotSpacer: {
    height: 4,
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 36,
    backgroundColor: T.border,
    marginVertical: 4,
    borderRadius: 1,
  },
  inputCol: {
    flex: 1,
    marginLeft: 10,
    marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingBottom: 4,
    backgroundColor: T.surfaceMuted,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  inputColFocused: {
    backgroundColor: "#fff",
    borderColor: T.ink,
  },
  fieldLabel: {
    color: T.inkSoft,
    marginTop: 8,
    marginBottom: 0,
  },
  swapBtn: {
    position: "absolute",
    right: 0,
    top: 52,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    ...T.shadow.card,
  },
  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: T.surfaceMuted,
    borderWidth: 1,
    borderColor: T.border,
  },
  mapBtnText: {
    color: T.ink,
  },
});

export default RouteLocationCard;
