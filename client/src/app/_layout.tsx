import "react-native-reanimated";
import React from "react";
import { LogBox, Text, TouchableOpacity, View } from "react-native";
import "@/utils/reanimatedSetup";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WSProvider } from "@/service/WSProvider";
import { MessageProvider } from "@/context/MessageContext";
import { installAlertOverride } from "@/utils/installAlertOverride";
import { PushNotificationBootstrap } from "@/components/shared/PushNotificationBootstrap";
import { DevApiLogger } from "@/components/shared/DevApiLogger";
import { DevToolsBar } from "@/components/shared/DevToolsBar";
import { ApiBootstrap } from "@/components/shared/ApiBootstrap";
import { OfflineBanner } from "@/components/shared/OfflineBanner";

installAlertOverride();

if (__DEV__) {
  LogBox.ignoreLogs([
    "expo-notifications",
    "Push native code is missing",
    "[push]",
    "onAnimatedValueUpdate",
  ]);
}

/**
 * Shown instead of closing the app when a screen throws while drawing. Plain components only:
 * whatever broke may be one of ours.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#F8FAFC" }}>
      <Text style={{ fontSize: 20, fontWeight: "700", color: "#0F172A", textAlign: "center" }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 15, color: "#475569", textAlign: "center", marginTop: 10, lineHeight: 22 }}>
        This screen hit a problem. Try again, and if it keeps happening, contact QareGO support.
      </Text>
      <TouchableOpacity
        onPress={retry}
        accessibilityRole="button"
        style={{ marginTop: 22, backgroundColor: "#EDD228", paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#0F172A" }}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <MessageProvider>
        <ApiBootstrap>
          <WSProvider>
            <DevApiLogger />
            <DevToolsBar />
            <PushNotificationBootstrap />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="role" />
              <Stack.Screen name="customer" />
              <Stack.Screen name="rider" />
              <Stack.Screen name="momo-coming-soon" options={{ presentation: "modal" }} />
            </Stack>
            <OfflineBanner />
          </WSProvider>
        </ApiBootstrap>
      </MessageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
