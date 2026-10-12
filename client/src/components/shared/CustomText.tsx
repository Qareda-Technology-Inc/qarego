import { Text, StyleSheet, type StyleProp, type TextStyle } from "react-native";
import React, { FC } from "react";
import { Colors } from "@/utils/Constants";
import { RFValue } from "react-native-responsive-fontsize";

const fontSizes = {
  h1: 24,
  h2: 22,
  h3: 20,
  h4: 18,
  h5: 16,
  h6: 14,
  h7: 10,
  h8: 9,
};

type CustomTextProps = {
  variant?: keyof typeof fontSizes;
  style?: StyleProp<TextStyle>;
  fontSize?: number;
  children?: React.ReactNode;
  fontFamily?: "SemiBold" | "Regular" | "Bold" | "Medium" | "Light";
  numberOfLines?: number;
  ellipsizeMode?: "head" | "middle" | "tail" | "clip";
  /** Text colour; an explicit `style.color` still wins. */
  color?: string;
};

const CustomText: FC<CustomTextProps> = ({
  variant = "h6",
  style,
  fontFamily = "Regular",
  fontSize,
  numberOfLines,
  children,
  color,
  ellipsizeMode,
}) => {
  return (
    <Text
      style={[
        styles.text,
        {
          fontSize: RFValue(fontSize ? fontSize : fontSizes[variant]),
          fontFamily,
        },
        color ? { color } : null,
        style,
      ]}
      numberOfLines={numberOfLines ? numberOfLines : undefined}
      ellipsizeMode={ellipsizeMode}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    color: Colors.text,
    textAlign: "left",
  },
});

export default CustomText;
