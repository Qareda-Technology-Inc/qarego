import React, { FC, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
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

/** Centered modal shell with safe-area padding and keyboard avoidance. */
export const CenteredFormModal: FC<Props> = ({
  visible,
  onRequestClose,
  children,
  maxHeightRatio = 0.88,
}) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxCardHeight = Math.round(windowHeight * maxHeightRatio - insets.top - insets.bottom - 32);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: insets.top + 16,
                paddingBottom: insets.bottom + 16,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.card, { maxHeight: Math.max(280, maxCardHeight) }]}>
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
});
