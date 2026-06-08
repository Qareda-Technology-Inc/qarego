import {
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { formatCurrency } from "@/utils/Constants";
import type { MenuItem } from "@/service/foodService";
import { getMenuItemPricing } from "@/utils/menuItemPricing";
import {
  initModifierSelection,
  isModifierSelectionReady,
  resolveModifierSelections,
  type ModifierSelection,
} from "@/utils/menuModifiers";

type Props = {
  visible: boolean;
  item: MenuItem | null;
  accent: string;
  onClose: () => void;
  onConfirm: (result: { modifiers: ReturnType<typeof resolveModifierSelections>["modifiers"]; unitPrice: number }) => void;
};

export default function MenuItemCustomizeModal({
  visible,
  item,
  accent,
  onClose,
  onConfirm,
}: Props) {
  const [selection, setSelection] = useState<ModifierSelection>({});

  useEffect(() => {
    if (item && visible) {
      setSelection(initModifierSelection(item));
    }
  }, [item, visible]);

  const resolved = useMemo(() => {
    if (!item) return null;
    return resolveModifierSelections(item, selection);
  }, [item, selection]);

  const ready = item ? isModifierSelectionReady(item, selection) : false;
  const basePricing = item ? getMenuItemPricing(item) : null;

  const toggleAddOn = (groupId: string, optionId: string) => {
    setSelection((prev) => {
      const current = prev[groupId] || [];
      const has = current.includes(optionId);
      return {
        ...prev,
        [groupId]: has ? current.filter((id) => id !== optionId) : [...current, optionId],
      };
    });
  };

  const pickOne = (groupId: string, optionId: string) => {
    setSelection((prev) => ({ ...prev, [groupId]: [optionId] }));
  };

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <CustomText fontFamily="SemiBold" fontSize={18}>
                {item.name}
              </CustomText>
              {item.description ? (
                <CustomText fontSize={13} color="#6b7280" style={{ marginTop: 4 }}>
                  {item.description}
                </CustomText>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {(item.modifierGroups || []).map((group) => (
              <View key={group._id} style={styles.group}>
                <View style={styles.groupHeader}>
                  <CustomText fontFamily="SemiBold" fontSize={15}>
                    {group.name}
                  </CustomText>
                  <CustomText fontSize={11} color="#6b7280">
                    {group.kind === "choose_one"
                      ? group.required
                        ? "Choose one · Required"
                        : "Choose one"
                      : "Optional add-ons"}
                  </CustomText>
                </View>

                {group.options
                  .filter((o) => o.isAvailable !== false)
                  .map((opt) => {
                    const selected = (selection[group._id] || []).includes(opt._id);
                    const priceLabel =
                      opt.priceDelta > 0 ? `+${formatCurrency(opt.priceDelta)}` : null;

                    if (group.kind === "add_ons") {
                      return (
                        <TouchableOpacity
                          key={opt._id}
                          style={[styles.optionRow, selected && styles.optionRowSelected]}
                          onPress={() => toggleAddOn(group._id, opt._id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={selected ? "checkbox" : "square-outline"}
                            size={22}
                            color={selected ? accent : "#9ca3af"}
                          />
                          <CustomText fontSize={15} style={styles.optionLabel}>
                            {opt.name}
                          </CustomText>
                          {priceLabel ? (
                            <CustomText fontSize={13} color="#6b7280">
                              {priceLabel}
                            </CustomText>
                          ) : null}
                        </TouchableOpacity>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={opt._id}
                        style={[styles.optionRow, selected && styles.optionRowSelected]}
                        onPress={() => pickOne(group._id, opt._id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={selected ? "radio-button-on" : "radio-button-off"}
                          size={22}
                          color={selected ? accent : "#9ca3af"}
                        />
                        <CustomText fontSize={15} style={styles.optionLabel}>
                          {opt.name}
                        </CustomText>
                        {priceLabel ? (
                          <CustomText fontSize={13} color="#6b7280">
                            {priceLabel}
                          </CustomText>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            {resolved?.error ? (
              <CustomText fontSize={12} color="#b45309" style={styles.error}>
                {resolved.error}
              </CustomText>
            ) : null}
            <View style={styles.priceRow}>
              <View>
                <CustomText fontSize={12} color="#6b7280">
                  Item total
                </CustomText>
                <CustomText fontFamily="SemiBold" fontSize={18}>
                  {formatCurrency(resolved?.unitPrice ?? basePricing?.salePrice ?? item.price)}
                </CustomText>
              </View>
              <TouchableOpacity
                style={[
                  styles.addBtn,
                  { backgroundColor: accent },
                  !ready && styles.addBtnDisabled,
                ]}
                disabled={!ready}
                onPress={() => {
                  if (!resolved || resolved.error) return;
                  onConfirm({ modifiers: resolved.modifiers, unitPrice: resolved.unitPrice });
                  onClose();
                }}
              >
                <CustomText fontFamily="SemiBold" fontSize={15} style={{ color: "#fff" }}>
                  Add to cart
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
    paddingBottom: 24,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e5e7eb",
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  group: {
    marginBottom: 18,
  },
  groupHeader: {
    marginBottom: 8,
    gap: 2,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    marginBottom: 8,
  },
  optionRowSelected: {
    borderColor: "#fdba74",
    backgroundColor: "#fff7ed",
  },
  optionLabel: {
    flex: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  error: {
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  addBtn: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addBtnDisabled: {
    opacity: 0.45,
  },
});
