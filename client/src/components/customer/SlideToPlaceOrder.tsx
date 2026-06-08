import React, { FC, useCallback } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";

const THUMB = 52;
const PADDING = 4;

type Props = {
  label: string;
  disabled?: boolean;
  accent?: string;
  onConfirm: () => void;
};

const SlideToPlaceOrder: FC<Props> = ({
  label,
  disabled = false,
  accent = "#f97316",
  onConfirm,
}) => {
  const trackWidth = useSharedValue(0);
  const translateX = useSharedValue(0);
  const confirmed = useSharedValue(false);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      trackWidth.value = e.nativeEvent.layout.width - THUMB - PADDING * 2;
    },
    [trackWidth]
  );

  const finish = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((e) => {
      if (confirmed.value) return;
      const max = Math.max(0, trackWidth.value);
      translateX.value = Math.min(Math.max(0, e.translationX), max);
    })
    .onEnd(() => {
      if (confirmed.value) return;
      const max = Math.max(0, trackWidth.value);
      if (max > 0 && translateX.value >= max * 0.88) {
        translateX.value = max;
        confirmed.value = true;
        runOnJS(finish)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[styles.track, { backgroundColor: disabled ? "#e5e7eb" : accent }]}
      onLayout={onLayout}
    >
      <CustomText
        fontFamily="SemiBold"
        fontSize={15}
        style={[styles.label, { opacity: disabled ? 0.6 : 1 }]}
      >
        {label}
      </CustomText>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <Ionicons name="chevron-forward" size={24} color={accent} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: THUMB + PADDING * 2,
    borderRadius: 14,
    justifyContent: "center",
    overflow: "hidden",
  },
  label: {
    color: "#fff",
    textAlign: "center",
    paddingHorizontal: THUMB + 12,
  },
  thumb: {
    position: "absolute",
    left: PADDING,
    top: PADDING,
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default SlideToPlaceOrder;
