import React, { FC, useCallback, useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import CustomText from "./CustomText";
import { MessageType } from "./MessagePopup";

interface TopToastProps {
  visible: boolean;
  title: string;
  message?: string;
  type?: Extract<MessageType, "success" | "info" | "warning" | "error">;
  onDismiss?: () => void;
}

const typeConfig = {
  success: { icon: "checkmark-circle", color: "#16a34a", bg: "#dcfce7" },
  info: { icon: "information-circle", color: "#2563eb", bg: "#dbeafe" },
  warning: { icon: "warning", color: "#ca8a04", bg: "#fef9c3" },
  error: { icon: "close-circle", color: "#dc2626", bg: "#fee2e2" },
} as const;

const TopToast: FC<TopToastProps> = ({
  visible,
  title,
  message,
  type = "info",
  onDismiss,
}) => {
  const cfg = typeConfig[type];
  const swipeX = useSharedValue(0);
  const swipeOpacity = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;
    swipeX.value = 0;
    swipeOpacity.value = 1;
  }, [visible, title, message, swipeX, swipeOpacity]);

  const dismiss = useCallback(() => {
    swipeOpacity.value = withTiming(0, { duration: 180 }, (finished) => {
      if (finished && onDismiss) {
        runOnJS(onDismiss)();
      }
    });
    swipeX.value = withTiming(220, { duration: 180 });
  }, [onDismiss, swipeOpacity, swipeX]);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .onUpdate((event) => {
          swipeX.value = event.translationX;
          const nextOpacity = 1 - Math.min(Math.abs(event.translationX) / 220, 0.8);
          swipeOpacity.value = Math.max(nextOpacity, 0.2);
        })
        .onEnd((event) => {
          const shouldDismiss =
            Math.abs(event.translationX) > 90 || Math.abs(event.velocityX) > 800;
          if (shouldDismiss) {
            runOnJS(dismiss)();
          } else {
            swipeX.value = withTiming(0, { duration: 160 });
            swipeOpacity.value = withTiming(1, { duration: 160 });
          }
        }),
    [dismiss, swipeOpacity, swipeX]
  );

  const animatedToastStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
    opacity: swipeOpacity.value,
  }));

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.root}>
      <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutUp.duration(180)}>
        <GestureDetector gesture={swipeGesture}>
          <Animated.View
            style={[
              styles.toast,
              { backgroundColor: cfg.bg, borderColor: cfg.color },
              animatedToastStyle,
            ]}
            pointerEvents="auto"
          >
            <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
            <View style={styles.content}>
              <CustomText fontFamily="SemiBold" fontSize={13} style={{ color: "#0f172a" }}>
                {title}
              </CustomText>
              {message ? (
                <CustomText fontSize={12} style={styles.message} numberOfLines={2}>
                  {message}
                </CustomText>
              ) : null}
            </View>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 56,
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  toast: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  content: {
    flex: 1,
    marginLeft: 10,
  },
  message: {
    marginTop: 2,
    color: "#334155",
  },
});

export default TopToast;
