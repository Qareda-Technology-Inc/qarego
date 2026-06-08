import { View, Text } from "react-native";
import React, { FC } from "react";
import { Colors } from "@/utils/Constants";
import { Ionicons } from "@expo/vector-icons";
import SwipeButton from "rn-swipe-button";
import { rideStyles } from "@/styles/rideStyles";
import { commonStyles } from "@/styles/commonStyles";
import CustomText from "../shared/CustomText";
import { orderStyles } from "@/styles/riderStyles";
import { RFValue } from "react-native-responsive-fontsize";

const RiderActionButton: FC<{
  ride: any;
  color?: string;
  title: string;
  meetLabel?: string;
  contactPhone?: string;
  pickupLabel?: string;
  dropLabel?: string;
  onPress: () => void;
}> = ({
  ride,
  color = Colors.iosColor,
  title,
  meetLabel = "Meet the Customer",
  contactPhone,
  pickupLabel = "Pickup",
  dropLabel = "Drop",
  onPress,
}) => {
  const formatPhone = (value?: string) => {
    if (!value) return null;
    return value.length > 5 ? `${value.slice(0, 5)} ${value.slice(5)}` : value;
  };
  const phone = formatPhone(contactPhone ?? ride?.customer?.phone);
  const CheckoutButton = () => (
    <Ionicons
      name="arrow-forward-sharp"
      style={{ bottom: 2 }}
      size={32}
      color="#fff"
    />
  );

  return (
    <View style={rideStyles?.swipeableContaninerRider}>
      <View style={commonStyles?.flexRowBetween}>
        <CustomText
          fontSize={11}
          style={{ marginTop: 10, marginBottom: 3 }}
          numberOfLines={1}
          fontFamily="Medium"
        >
          {meetLabel}
        </CustomText>
        <CustomText
          fontSize={11}
          style={{ marginTop: 10, marginBottom: 3 }}
          numberOfLines={1}
          fontFamily="Medium"
        >
          {phone || "—"}
        </CustomText>
      </View>

      <View style={orderStyles.locationsContainer}>
        <View style={orderStyles.flexRowBase}>
          <View>
            <View style={orderStyles.pickupHollowCircle} />
            <View style={orderStyles.continuousLine} />
          </View>
          <View style={orderStyles.infoText}>
            <CustomText fontSize={9} fontFamily="SemiBold" style={orderStyles.label}>
              {pickupLabel}
            </CustomText>
            <CustomText fontSize={11} numberOfLines={1} fontFamily="SemiBold">
              {ride?.pickup?.address?.slice(0, 10)}
            </CustomText>
            <CustomText
              numberOfLines={2}
              fontSize={9.5}
              fontFamily="Medium"
              style={orderStyles.label}
            >
              {ride?.pickup?.address}
            </CustomText>
          </View>
        </View>

        <View style={orderStyles.flexRowBase}>
          <View style={orderStyles.dropHollowCircle} />
          <View style={orderStyles.infoText}>
            <CustomText fontSize={9} fontFamily="SemiBold" style={orderStyles.label}>
              {dropLabel}
            </CustomText>
            <CustomText fontSize={11} numberOfLines={1} fontFamily="SemiBold">
              {ride?.drop?.address?.slice(0, 10)}
            </CustomText>
            <CustomText
              numberOfLines={2}
              fontSize={9.5}
              fontFamily="Medium"
              style={orderStyles.label}
            >
              {ride?.drop?.address}
            </CustomText>
          </View>
        </View>
      </View>

      <SwipeButton
        containerStyles={rideStyles.swipeButtonContainer}
        height={30}
        shouldResetAfterSuccess={true}
        resetAfterSuccessAnimDelay={200}
        onSwipeSuccess={onPress}
        railBackgroundColor={color}
        railStyles={rideStyles.railStyles}
        railBorderColor="transparent"
        railFillBackgroundColor="rgba(255,255,255,0.6)"
        railFillBorderColor="rgba(255,255,255,0.6)"
        titleColor="#fff"
        titleFontSize={RFValue(13)}
        titleStyles={rideStyles.titleStyles}
        thumbIconComponent={CheckoutButton}
        thumbIconStyles={rideStyles.thumbIconStyles}
        title={title.toUpperCase()}
        thumbIconBackgroundColor="transparent"
        thumbIconBorderColor="transparent"
        thumbIconHeight={50}
        thumbIconWidth={60}
      />
    </View>
  );
};

export default RiderActionButton;
