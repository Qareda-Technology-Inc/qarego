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

/**
 * RFValue scales fonts with screen height (about 2x on a 13" iPad), but callers often pass a
 * fixed lineHeight tuned on a phone, which then clips the scaled glyphs. Never let a line be
 * shorter than the font needs; phones already meet this, so only large screens change.
 */
const MIN_LINE_HEIGHT_RATIO = 1.15;

function fitLineHeight(style: StyleProp<TextStyle>, fallbackSize: number): TextStyle | null {
  const flat = StyleSheet.flatten(style);
  if (!flat || typeof flat.lineHeight !== "number") return null;
  const size = typeof flat.fontSize === "number" ? flat.fontSize : fallbackSize;
  const min = Math.ceil(size * MIN_LINE_HEIGHT_RATIO);
  return flat.lineHeight < min ? { lineHeight: min } : null;
}

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
  const scaledSize = RFValue(fontSize ? fontSize : fontSizes[variant]);
  return (
    <Text
      style={[
        styles.text,
        {
          fontSize: scaledSize,
          fontFamily,
        },
        color ? { color } : null,
        style,
        fitLineHeight(style, scaledSize),
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
