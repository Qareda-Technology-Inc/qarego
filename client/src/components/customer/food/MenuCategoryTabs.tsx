import { ScrollView, TouchableOpacity, StyleSheet, View } from "react-native";
import CustomText from "@/components/shared/CustomText";
import { MenuCategoryMeta } from "@/service/foodService";

type Props = {
  categories: MenuCategoryMeta[];
  selected: string;
  onSelect: (key: string) => void;
  accent: string;
  /** Tighter row under pinned restaurant name */
  compact?: boolean;
};

export default function MenuCategoryTabs({
  categories,
  selected,
  onSelect,
  accent,
  compact = false,
}: Props) {
  const chips: { key: string; label: string }[] = [
    { key: "all", label: "View all" },
    ...categories.map((c) => ({ key: c.name, label: c.name })),
  ];

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]}
        style={styles.bar}
      >
        {chips.map((chip) => {
          const active = selected === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              onPress={() => onSelect(chip.key)}
              style={[
                styles.chip,
                compact && styles.chipCompact,
                active && { backgroundColor: accent, borderColor: accent },
              ]}
              activeOpacity={0.85}
            >
              <CustomText
                fontFamily="SemiBold"
                fontSize={compact ? 12 : 13}
                style={{ color: active ? "#fff" : "#374151" }}
                numberOfLines={1}
              >
                {chip.label}
              </CustomText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
  },
  wrapCompact: {
    borderBottomWidth: 0,
  },
  bar: {
    flexGrow: 0,
  },
  scroll: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    flexDirection: "row",
  },
  scrollCompact: {
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f3f4f6",
    marginRight: 8,
    minHeight: 38,
    justifyContent: "center",
  },
  chipCompact: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    minHeight: 34,
    borderRadius: 18,
  },
});
