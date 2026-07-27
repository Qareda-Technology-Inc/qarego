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
  onMapPress: () => void;
};

/** Pickup → destination editor with connector line. */
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
            <View
              style={[
                styles.inputCol,
                focusedInput === "pickup" && styles.inputColFocused,
                pickup.trim().length > 0 && focusedInput !== "pickup" && styles.inputColFilled,
              ]}
            >
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
        <View
          style={[
            styles.inputCol,
            focusedInput === "drop" && styles.inputColFocused,
            drop.trim().length > 0 && focusedInput !== "drop" && styles.inputColFilled,
          ]}
        >
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
      <View style={styles.mapBtnIcon}>
        <Ionicons name="map" size={16} color={Colors.theme} />
      </View>
      <CustomText fontFamily="Medium" fontSize={13} style={styles.mapBtnText}>
        Set location on map
      </CustomText>
      <Ionicons name="chevron-forward" size={16} color={T.inkSoft} />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    marginTop: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
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
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingBottom: 4,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: T.border,
  },
  inputColFocused: {
    backgroundColor: "#fff",
    borderColor: Colors.theme,
  },
  inputColFilled: {
    backgroundColor: "#fffef5",
    borderColor: Colors.primary,
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
    borderRadius: 12,
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
    gap: 10,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: T.border,
  },
  mapBtnIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#ffedd5",
    alignItems: "center",
    justifyContent: "center",
  },
  mapBtnText: {
    flex: 1,
    color: T.ink,
  },
});

export default RouteLocationCard;
