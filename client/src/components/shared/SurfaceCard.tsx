import React, { FC, ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { DS } from "@/theme/designSystem";

interface SurfaceCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const SurfaceCard: FC<SurfaceCardProps> = ({ children, style }) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: DS.color.border,
    padding: DS.spacing.md,
    ...DS.shadow.card,
  },
});

export default SurfaceCard;
