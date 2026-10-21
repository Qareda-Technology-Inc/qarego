import React, { useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";

export type Slide = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
  title: string;
  body: string;
};

export const CUSTOMER_SLIDES: Slide[] = [
  {
    key: "all",
    icon: "apps",
    tint: Colors.theme,
    bg: "#FFEDD5",
    title: "Everything in one app",
    body: "Book a ride, order food, groceries or medicine, send a parcel, or get your gas cylinder refilled.",
  },
  {
    key: "price",
    icon: "pricetag",
    tint: "#15803D",
    bg: "#DCFCE7",
    title: "See the price first",
    body: "The app shows the fare or order total before you confirm. Pay in cash when your trip ends or your order arrives.",
  },
  {
    key: "code",
    icon: "shield-checkmark",
    tint: Colors.tertiary,
    bg: "#DBEAFE",
    title: "Your code keeps you safe",
    body: "You get a 4-digit code for each trip or delivery. Share it only with the rider in front of you, never on the phone.",
  },
  {
    key: "track",
    icon: "navigate",
    tint: "#7C3AED",
    bg: "#EDE9FE",
    title: "Follow every step",
    body: "Watch your rider on the map, and call or chat with them from the trip screen.",
  },
];

/** Intro slides shown once after first sign-in (and from "Show me around"). */
export default function WelcomeSlides({
  visible,
  onDone,
  slides = CUSTOMER_SLIDES,
}: {
  visible: boolean;
  onDone: () => void;
  slides?: Slide[];
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const next = () => {
    if (last) {
      onDone();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    setIndex(index + 1);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onDone}
      statusBarTranslucent
    >
      {/* Insets come from the screen behind: a provider inside the modal reports 0 on Android,
          which put Skip under the status bar. */}
        <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.topBar}>
            {last ? (
              <View />
            ) : (
              <Pressable
                onPress={onDone}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Skip introduction"
              >
                <CustomText
                  fontFamily="SemiBold"
                  fontSize={14}
                  style={styles.skip}
                >
                  Skip
                </CustomText>
              </Pressable>
            )}
          </View>

          <FlatList
            ref={listRef}
            data={slides}
            keyExtractor={(s) => s.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            getItemLayout={(_, i) => ({
              length: width,
              offset: width * i,
              index: i,
            })}
            renderItem={({ item }) => (
              <View style={[styles.slide, { width }]}>
                <View style={styles.slideInner}>
                  <View
                    style={[styles.iconCircle, { backgroundColor: item.bg }]}
                  >
                    <Ionicons name={item.icon} size={56} color={item.tint} />
                  </View>
                  <CustomText
                    fontFamily="Bold"
                    fontSize={24}
                    style={styles.title}
                  >
                    {item.title}
                  </CustomText>
                  <CustomText fontSize={15} style={styles.body}>
                    {item.body}
                  </CustomText>
                </View>
              </View>
            )}
          />

          <View style={styles.footer}>
            <View style={styles.dots}>
              {slides.map((s, i) => (
                <View
                  key={s.key}
                  style={[styles.dot, i === index && styles.dotActive]}
                />
              ))}
            </View>
            <Pressable
              onPress={next}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <CustomText
                fontFamily="SemiBold"
                fontSize={16}
                style={styles.buttonText}
              >
                {last ? "Get started" : "Next"}
              </CustomText>
            </Pressable>
          </View>
        </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F7FB" },
  topBar: {
    height: 44,
    paddingHorizontal: 24,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  skip: { color: DS.color.textMuted },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  slideInner: { width: "100%", maxWidth: 420, alignItems: "center" },
  iconCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  title: { color: Colors.text, textAlign: "center", marginBottom: 12 },
  body: { color: DS.color.textMuted, textAlign: "center", lineHeight: 23 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 20,
    alignItems: "center",
  },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#CBD5E1" },
  dotActive: { width: 24, backgroundColor: Colors.theme },
  button: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: Colors.text },
  pressed: { opacity: 0.9 },
});
