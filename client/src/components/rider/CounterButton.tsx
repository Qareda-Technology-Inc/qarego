import { View, TouchableOpacity, StyleSheet } from "react-native";
import React, { FC, useEffect, useState } from "react";
import CustomText from "../shared/CustomText";
import { CountdownCircleTimer } from "react-native-countdown-circle-timer";
import { Colors } from "@/utils/Constants";

interface CounterButtonProps {
  title: string;
  onPress: () => void;
  initialCount: number;
  onCountdownEnd: () => void;
  /** Stretch across the card with a larger tap target (offer cards). */
  fullWidth?: boolean;
  disabled?: boolean;
}

const CounterButton: FC<CounterButtonProps> = ({
  title,
  onPress,
  initialCount,
  onCountdownEnd,
  fullWidth = false,
  disabled = false,
}) => {
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    setPlaying(true);
    return () => setPlaying(false);
  }, [initialCount]);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.container, fullWidth && styles.fullWidth, disabled && { opacity: 0.55 }]}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <CustomText
        fontFamily={fullWidth ? "SemiBold" : "Medium"}
        fontSize={fullWidth ? 15 : 12}
        style={styles.text}
      >
        {title}
      </CustomText>
      <View style={styles.counter}>
        <CountdownCircleTimer
          onComplete={onCountdownEnd}
          isPlaying={playing}
          duration={initialCount}
          size={fullWidth ? 34 : 30}
          strokeWidth={3}
          colors={["#004777", "#F7B801", "#A30000", "#A30000"]}
          // Turn amber at ~40% left and red near the end, whatever the duration.
          colorsTime={[
            initialCount,
            Math.round(initialCount * 0.4),
            Math.max(1, Math.round(initialCount * 0.15)),
            0,
          ]}
        >
          {({ remainingTime }) => (
            <CustomText fontSize={10} fontFamily="SemiBold">
              {remainingTime}
            </CustomText>
          )}
        </CountdownCircleTimer>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  fullWidth: {
    alignSelf: "stretch",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
  },
  counter: {
    backgroundColor: "white",
    borderRadius: 50,
  },
  text: {
    color: "#000",
    marginRight: 10,
  },
});

export default CounterButton;
