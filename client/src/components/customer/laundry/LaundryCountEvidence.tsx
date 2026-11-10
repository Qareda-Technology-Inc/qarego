import React, { useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import type { FoodOrder } from "@/service/foodService";

/** The shop's photos and note from counting the bag (stains, damage). Tap a photo to enlarge. */
export default function LaundryCountEvidence({ order }: { order: FoodOrder }) {
  const [open, setOpen] = useState<string | null>(null);
  const photos = (order.laundry?.countPhotos ?? []).map((u) => resolveMediaUrl(u)).filter(Boolean) as string[];
  const note = order.laundry?.countNote;
  if (!photos.length && !note) return null;
  return (
    <View style={styles.wrap}>
      {note ? (
        <View style={styles.noteRow}>
          <Ionicons name="alert-circle-outline" size={15} color="#9a3412" />
          <CustomText fontSize={12} color="#9a3412" style={{ marginLeft: 6, flex: 1 }}>
            Shop noted: {note}
          </CustomText>
        </View>
      ) : null}
      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
          {photos.map((uri) => (
            <TouchableOpacity key={uri} onPress={() => setOpen(uri)} accessibilityLabel="Open the shop's photo">
              <Image source={{ uri }} style={styles.thumb} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          {open ? <Image source={{ uri: open }} style={styles.full} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff7ed", borderRadius: 10, padding: 8 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: "#e2e8f0" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center" },
  full: { width: "92%", height: "75%" },
});
