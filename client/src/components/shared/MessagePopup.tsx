import React, { FC } from "react";
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeIn, FadeOut, FadeInDown } from "react-native-reanimated";
import { Colors } from "@/utils/Constants";
import CustomText from "./CustomText";
import { Ionicons } from "@expo/vector-icons";

export type MessageType = "success" | "error" | "warning" | "info" | "confirm";

export interface MessageButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

export interface MessagePopupProps {
  visible: boolean;
  title: string;
  message?: string;
  type?: MessageType;
  buttons?: MessageButton[];
  onBackdropPress?: () => void;
  dismissOnBackdrop?: boolean;
}

const TYPE_CONFIG: Record<
  MessageType,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  success: {
    icon: "checkmark-circle",
    color: "#16a34a",
    bg: "#dcfce7",
  },
  error: {
    icon: "close-circle",
    color: "#dc2626",
    bg: "#fee2e2",
  },
  warning: {
    icon: "warning",
    color: "#ca8a04",
    bg: "#fef9c3",
  },
  info: {
    icon: "information-circle",
    color: Colors.tertiary,
    bg: "#dbeafe",
  },
  confirm: {
    icon: "help-circle",
    color: Colors.theme,
    bg: "#ffedd5",
  },
};

const CARD_MAX_WIDTH = 320;
const HORIZONTAL_PADDING = 24;

const MessagePopup: FC<MessagePopupProps> = ({
  visible,
  title,
  message,
  type = "confirm",
  buttons = [],
  onBackdropPress,
  dismissOnBackdrop = true,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const cardWidth = Math.min(windowWidth - HORIZONTAL_PADDING * 2, CARD_MAX_WIDTH);

  const config = TYPE_CONFIG[type];
  const effectiveButtons =
    buttons.length > 0
      ? buttons
      : [{ text: "OK", onPress: onBackdropPress, style: "default" as const }];

  const handleBackdrop = () => {
    if (dismissOnBackdrop) {
      onBackdropPress?.();
    }
  };

  const handleButtonPress = (btn: MessageButton) => {
    btn.onPress?.();
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onBackdropPress}
    >
      <View style={[styles.modalRoot, { width: windowWidth, height: windowHeight }]}>
        <Pressable style={styles.backdropPressable} onPress={handleBackdrop}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.backdrop}
          >
            <View style={styles.centered} pointerEvents="box-none">
              <Animated.View
                entering={FadeInDown.duration(280).springify().damping(14)}
                exiting={FadeOut.duration(150)}
                style={[styles.card, { width: cardWidth }]}
              >
                <View style={[styles.iconWrap, { backgroundColor: config.bg }]}>
                <Ionicons
                  name={config.icon}
                  size={44}
                  color={config.color}
                />
              </View>
              <CustomText
                fontFamily="SemiBold"
                fontSize={18}
                style={styles.title}
              >
                {title}
              </CustomText>
              {message ? (
                <CustomText
                  fontFamily="Regular"
                  fontSize={14}
                  style={styles.message}
                  numberOfLines={6}
                >
                  {message}
                </CustomText>
              ) : null}
              <View style={styles.buttons}>
                {effectiveButtons.map((btn, i) => {
                  const isDestructive = btn.style === "destructive";
                  const isCancel = btn.style === "cancel";
                  return (
                    <Pressable
                      key={i}
                      onPress={() => handleButtonPress(btn)}
                      style={({ pressed }) => [
                        styles.btn,
                        isDestructive && styles.btnDestructive,
                        isCancel && styles.btnCancel,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <CustomText
                        fontFamily="SemiBold"
                        fontSize={14}
                        style={[
                          styles.btnText,
                          isDestructive && styles.btnTextDestructive,
                          isCancel && styles.btnTextCancel,
                        ]}
                      >
                        {btn.text}
                      </CustomText>
                    </Pressable>
                  );
                })}
                </View>
              </Animated.View>
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  backdropPressable: {
    flex: 1,
    width: "100%",
  },
  backdrop: {
    flex: 1,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: HORIZONTAL_PADDING,
  },
  centered: {
    flex: 1,
    width: "100%",
    maxWidth: CARD_MAX_WIDTH + HORIZONTAL_PADDING * 2,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    color: Colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    color: Colors.text,
    textAlign: "center",
    opacity: 0.9,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    justifyContent: "center",
  },
  btn: {
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  btnCancel: {
    backgroundColor: Colors.secondary,
  },
  btnDestructive: {
    backgroundColor: "#fee2e2",
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    color: Colors.text,
  },
  btnTextCancel: {
    color: Colors.text,
  },
  btnTextDestructive: {
    color: "#dc2626",
  },
});

export default MessagePopup;
