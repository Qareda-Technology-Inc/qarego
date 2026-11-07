import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { Colors, formatCurrency } from "@/utils/Constants";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import { useRefetchOnReconnect } from "@/utils/useRefetchOnReconnect";
import { fetchInbox, markInboxSeen, promoPath, type InboxMessage } from "@/service/inboxService";

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Messages and promotions from QareGO. Opening the list clears the unread badge. */
const CustomerNotifications = () => {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchInbox();
      setMessages(data.messages || []);
      if (data.unread > 0) void markInboxSeen().catch(() => {});
    } catch {
      /* keep what we have */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useRefetchOnReconnect(load);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: InboxMessage }) => {
    const image = resolveMediaUrl(item.imageUrl);
    const promo = item.promo;
    const content = (
      <>
        {image ? <Image source={{ uri: image }} style={styles.image} resizeMode="cover" /> : null}
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            {item.unread ? <View style={styles.dot} /> : null}
            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.title}>
              {item.title}
            </CustomText>
          </View>
          <CustomText fontSize={13} style={styles.body}>
            {item.body}
          </CustomText>
          <View style={styles.metaRow}>
            <CustomText fontSize={11} style={styles.time}>
              {timeAgo(item.createdAt)}
            </CustomText>
            {promo ? (
              <View style={styles.cta}>
                <CustomText fontFamily="SemiBold" fontSize={12} style={styles.ctaText}>
                  {promo.menuItemName
                    ? `Order ${promo.price != null ? `· ${formatCurrency(promo.price)}` : "now"}`
                    : "See menu"}
                </CustomText>
                <MaterialIcons name="chevron-right" size={16} color={Colors.primary} />
              </View>
            ) : null}
          </View>
        </View>
      </>
    );
    if (!promo) return <View style={styles.card}>{content}</View>;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() => router.push(promoPath(promo) as never)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. Open ${promo.menuItemName || promo.restaurantName}`}
      >
        {content}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/customer"))}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="arrow-back-ios" size={20} color={T.ink} />
          </TouchableOpacity>
          <CustomText fontFamily="SemiBold" fontSize={18} style={styles.headerTitle}>
            Notifications
          </CustomText>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={Colors.primary} />
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => m._id}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.list,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
              />
            }
            ListEmptyComponent={
              <EmptyStateCard
                icon="🔔"
                title="No messages yet"
                description="Offers and news from QareGO will show up here."
              />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.surfaceMuted },
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.sheetBg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: { width: 40, height: 40 },
  headerTitle: { flex: 1, textAlign: "center", color: T.ink },
  loader: { marginTop: 40 },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  card: {
    backgroundColor: T.sheetBg,
    borderRadius: T.radius.card,
    overflow: "hidden",
  },
  image: { width: "100%", aspectRatio: 2 },
  cardBody: { padding: 14, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  title: { flex: 1, color: T.ink },
  body: { color: T.inkMuted, lineHeight: 19 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  time: { color: T.inkSoft },
  cta: { flexDirection: "row", alignItems: "center" },
  ctaText: { color: Colors.primary },
});

export default CustomerNotifications;
