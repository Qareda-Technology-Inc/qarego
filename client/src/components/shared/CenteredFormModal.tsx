import React, { FC, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  maxHeightRatio?: number;
};

/**
 * Android-safe centered modal:
 * - Card sits above a separate dimmer (higher elevation) so taps reach controls
 * - Outer flex center (not ScrollView justifyContent) for reliable vertical centering
 */
export const CenteredFormModal: FC<Props> = ({
  visible,
  onRequestClose,
  children,
  maxHeightRatio = 0.86,
}) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const topPad = Math.max(insets.top, Platform.OS === "android" ? 28 : 16);
  const bottomPad = Math.max(insets.bottom, 16);
  const maxCardHeight = Math.max(
    300,
    Math.round(windowHeight * maxHeightRatio - topPad - bottomPad)
  );
  const cardWidth = Math.min(windowWidth - 32, 400);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={onRequestClose}
    >
      <View style={styles.root}>
        <TouchableWithoutFeedback onPress={onRequestClose} accessible={false}>
          <View style={styles.dimmer} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.foreground}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.centerWrap,
              { paddingTop: topPad, paddingBottom: bottomPad },
            ]}
            pointerEvents="box-none"
          >
            <View
              style={[
                styles.card,
                {
                  width: cardWidth,
                  maxHeight: maxCardHeight,
                },
              ]}
            >
              <ScrollView
                bounces={false}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.cardScroll}
              >
                {children}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  foreground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    elevation: 20,
  },
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    zIndex: 3,
    elevation: 24,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  cardScroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    alignItems: "stretch",
  },
});
