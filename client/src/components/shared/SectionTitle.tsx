import React, { FC } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import CustomText from "./CustomText";
import { DS } from "@/theme/designSystem";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}

const SectionTitle: FC<SectionTitleProps> = ({ title, subtitle, style }) => {
  return (
    <View style={style}>
      <CustomText fontFamily="SemiBold" fontSize={15} style={styles.title}>
        {title}
      </CustomText>
      {subtitle ? (
        <CustomText fontSize={12} style={styles.subtitle}>
          {subtitle}
        </CustomText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  title: { color: DS.color.text },
  subtitle: { color: DS.color.textMuted, marginTop: 4 },
});

export default SectionTitle;
