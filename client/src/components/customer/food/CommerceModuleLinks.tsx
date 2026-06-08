import React, { FC } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import CustomText from "@/components/shared/CustomText";
import { FOOD_THEME } from "@/styles/foodStyles";
import { STORE_VERTICAL_CONFIG, StoreVertical } from "@/utils/storeVertical";

type ActiveModule = "FOOD_HOME" | StoreVertical | "NONE";

type Props = {
  active: ActiveModule;
};

const MODULES: {
  key: ActiveModule;
  vertical: StoreVertical;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  home?: boolean;
}[] = [
  { key: "FOOD_HOME", vertical: "FOOD", label: "Restaurants", icon: "restaurant-outline", home: true },
  { key: "GROCERY", vertical: "GROCERY", label: "Groceries", icon: "basket-outline" },
  { key: "PHARMACY", vertical: "PHARMACY", label: "Pharmacy", icon: "medkit-outline" },
];

const CommerceModuleLinks: FC<Props> = ({ active }) => {
  const go = (mod: (typeof MODULES)[number]) => {
    if (mod.home) {
      router.navigate("/customer/hub");
      return;
    }
    router.navigate({
      pathname: "/customer/stores",
      params: { type: mod.vertical },
    });
  };

  return (
    <View style={styles.row}>
      {MODULES.map((mod) => {
        const isActive =
          active !== "NONE" && (mod.home ? active === "FOOD_HOME" : active === mod.vertical);
        const accent = STORE_VERTICAL_CONFIG[mod.vertical].accent;
        return (
          <TouchableOpacity
            key={mod.key}
            style={[
              styles.chip,
              isActive && { borderColor: accent, backgroundColor: `${accent}12` },
            ]}
            onPress={() => go(mod)}
            activeOpacity={0.85}
          >
            <Ionicons name={mod.icon} size={14} color={accent} />
            <CustomText
              fontSize={10}
              fontFamily={isActive ? "SemiBold" : "Medium"}
              style={[styles.chipText, { color: accent }]}
              numberOfLines={1}
            >
              {mod.label}
            </CustomText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: FOOD_THEME.divider,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 0,
  },
  chipText: {
    flexShrink: 1,
    textAlign: "center",
  },
});

export default CommerceModuleLinks;
