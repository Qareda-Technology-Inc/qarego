import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import React, { FC } from "react";
import { Colors } from "@/utils/Constants";
import CustomText from "./CustomText";
import { RFValue } from "react-native-responsive-fontsize";
import { DS } from "@/theme/designSystem";

const CustomButton: FC<CustomButtonProps> = ({
  onPress,
  title,
  disabled,
  loading,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.container,
        {
          backgroundColor: disabled ? DS.color.border : Colors.primary,
          opacity: disabled ? 0.8 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.text} size="small" />
      ) : (
        <CustomText
          fontFamily="SemiBold"
          style={{
            fontSize: RFValue(12),
            color: disabled ? "#fff" : Colors.text,
          }}
        >
          {title}
        </CustomText>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: DS.radius.md,
    marginVertical: 10,
    paddingHorizontal: 14,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
});

export default CustomButton;
