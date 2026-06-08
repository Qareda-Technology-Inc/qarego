import React, { FC } from "react";
import { StyleSheet, View } from "react-native";
import CustomText from "./CustomText";
import SurfaceCard from "./SurfaceCard";
import { DS } from "@/theme/designSystem";

interface EmptyStateCardProps {
  icon?: string;
  title: string;
  description: string;
}

const EmptyStateCard: FC<EmptyStateCardProps> = ({
  icon = "ℹ️",
  title,
  description,
}) => {
  return (
    <SurfaceCard style={styles.wrap}>
      <CustomText fontSize={34}>{icon}</CustomText>
      <CustomText fontFamily="SemiBold" fontSize={16} style={styles.title}>
        {title}
      </CustomText>
      <CustomText fontSize={13} style={styles.desc}>
        {description}
      </CustomText>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    marginHorizontal: DS.spacing.md,
  },
  title: {
    marginTop: DS.spacing.sm,
    textAlign: "center",
  },
  desc: {
    marginTop: DS.spacing.xs,
    color: DS.color.textMuted,
    textAlign: "center",
  },
});

export default EmptyStateCard;
