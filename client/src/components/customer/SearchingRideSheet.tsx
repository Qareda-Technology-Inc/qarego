import { View, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import React, { FC } from "react";
import { useWS } from "@/service/WSProvider";
import { rideStyles } from "@/styles/rideStyles";
import { commonStyles } from "@/styles/commonStyles";
import { Image } from "react-native";
import CustomText from "../shared/CustomText";
import { getVehicleIconSource, getVehicleLabel } from "@/utils/mapUtils";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { formatCurrency } from "@/utils/Constants";
import { parseRideParcelMode, parcelModeLabels } from "@/utils/parcelMode";
import { getCustomerParcelPhase, getCustomerRouteLabels } from "@/utils/customerCourierUi";

interface RideItem {
  serviceType?: "RIDE" | "DELIVERY" | "FOOD";
  parcelMode?: "SEND" | "RECEIVE";
  vehicle?: string;
  _id: string;
  pickup?: { address: string };
  drop?: { address: string };
  fare?: number;
  recipientName?: string;
}

const SearchingRideSheet: FC<{ item: RideItem }> = ({ item }) => {
  const { emit } = useWS();
  const isParcel = item?.serviceType === "DELIVERY";
  const parcelMode = parseRideParcelMode(item);
  const parcelLabels = parcelModeLabels(parcelMode);
  const routeLabels = getCustomerRouteLabels(item);
  const parcelPhase = getCustomerParcelPhase(parcelMode, "START", item?.recipientName);

  return (
    <View>
      <View style={rideStyles?.headerContainer}>
        <View style={commonStyles.flexRowBetween}>
          <Image
            source={getVehicleIconSource(item?.vehicle ?? "motorcycle")}
            style={rideStyles?.rideIcon}
          />
          <View style={{ marginLeft: 10 }}>
            {isParcel ? (
              <View style={[styles.phaseChip, { backgroundColor: `${parcelPhase.color}1a` }]}>
                <CustomText fontSize={10} fontFamily="SemiBold" style={{ color: parcelPhase.color }}>
                  Step {parcelPhase.step} of {parcelPhase.totalSteps}
                </CustomText>
              </View>
            ) : null}
            <CustomText fontSize={10}>
              {isParcel ? "Finding a courier" : "Looking for your"}
            </CustomText>
            <CustomText fontFamily="Medium" fontSize={12}>
              {isParcel
                ? `${getVehicleLabel(item?.vehicle ?? "motorcycle")} delivery`
                : `${getVehicleLabel(item?.vehicle ?? "motorcycle")} ride`}
            </CustomText>
          </View>
        </View>

        <ActivityIndicator color="black" size="small" />
      </View>

      <View style={{ padding: 10 }}>
        <CustomText fontFamily="SemiBold" fontSize={12}>
          {isParcel ? "Parcel route" : "Location details"}
        </CustomText>

        {isParcel && item?.recipientName ? (
          <CustomText fontSize={10} color="#666" style={{ marginTop: 6 }}>
            {parcelLabels.searchingHint}: {item.recipientName}
          </CustomText>
        ) : null}

        <View style={[commonStyles?.flexRowGap, styles.routeRow]}>
          <Image
            source={require("@/assets/icons/marker.png")}
            style={rideStyles?.pinIcon}
          />
          <View style={{ flex: 1 }}>
            {isParcel ? (
              <CustomText fontSize={9} fontFamily="SemiBold" style={{ color: "#888", marginBottom: 2 }}>
                {routeLabels.pickupLabel}
              </CustomText>
            ) : null}
            <CustomText fontSize={10} numberOfLines={2}>
              {item?.pickup?.address}
            </CustomText>
          </View>
        </View>

        <View style={[commonStyles.flexRowGap, styles.routeRow]}>
          <Image
            source={require("@/assets/icons/drop_marker.png")}
            style={rideStyles.pinIcon}
          />
          <View style={{ flex: 1 }}>
            {isParcel ? (
              <CustomText fontSize={9} fontFamily="SemiBold" style={{ color: "#888", marginBottom: 2 }}>
                {routeLabels.dropLabel}
              </CustomText>
            ) : null}
            <CustomText fontSize={10} numberOfLines={2}>
              {item?.drop?.address}
            </CustomText>
          </View>
        </View>

        <View style={{ marginVertical: 20 }}>
          <View style={[commonStyles.flexRowBetween]}>
            <View style={[commonStyles.flexRow]}>
              <MaterialCommunityIcons
                name="credit-card"
                size={24}
                color="black"
              />
              <CustomText
                style={{ marginLeft: 10 }}
                fontFamily="SemiBold"
                fontSize={12}
              >
                Payment
              </CustomText>
            </View>

            <CustomText fontFamily="SemiBold" fontSize={14}>
              {formatCurrency(item?.fare)}
            </CustomText>
          </View>

          <CustomText fontSize={10}>Payment via cash</CustomText>
        </View>
      </View>

      <View style={rideStyles?.bottomButtonContainer}>
        <TouchableOpacity
          style={rideStyles.cancelButton}
          onPress={() => {
            emit("cancelRide", item?._id);
          }}
        >
          <CustomText style={rideStyles?.cancelButtonText}>Cancel</CustomText>
        </TouchableOpacity>

        <TouchableOpacity
          style={rideStyles.backButton2}
          onPress={() => router.back()}
        >
          <CustomText style={rideStyles?.backButtonText}>Back</CustomText>
        </TouchableOpacity>
      </View>

    </View>
  );
};

export default SearchingRideSheet;

const styles = StyleSheet.create({
  phaseChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 6,
  },
  routeRow: {
    marginTop: 14,
    width: "90%",
  },
});
