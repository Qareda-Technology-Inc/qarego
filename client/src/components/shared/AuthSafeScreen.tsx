import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

type Props = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: ViewStyle;
  backgroundColor?: string;
};

/** Login / OTP shells — safe area on iOS + Android (status bar, notch, nav bar). */
export default function AuthSafeScreen({
  children,
  footer,
  style,
  backgroundColor = "#fff",
}: Props) {
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor }, style]}
      edges={["top", "bottom"]}
    >
      <StatusBar style="dark" />
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footerSlot}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  footerSlot: {
    backgroundColor: "transparent",
  },
});
