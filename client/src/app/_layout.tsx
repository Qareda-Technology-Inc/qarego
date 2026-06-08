import "react-native-reanimated";
import React from "react";
import { LogBox } from "react-native";
import "@/utils/reanimatedSetup";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WSProvider } from "@/service/WSProvider";
import { MessageProvider } from "@/context/MessageContext";
import { installAlertOverride } from "@/utils/installAlertOverride";
import { PushNotificationBootstrap } from "@/components/shared/PushNotificationBootstrap";
import { DevApiLogger } from "@/components/shared/DevApiLogger";
import { ApiBootstrap } from "@/components/shared/ApiBootstrap";

installAlertOverride();

if (__DEV__) {
  LogBox.ignoreLogs([
    "expo-notifications",
    "Push native code is missing",
    "[push]",
    "onAnimatedValueUpdate",
  ]);
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <MessageProvider>
        <ApiBootstrap>
          <WSProvider>
            <DevApiLogger />
            <PushNotificationBootstrap />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="role" />
              <Stack.Screen name="customer" />
              <Stack.Screen name="rider" />
            </Stack>
          </WSProvider>
        </ApiBootstrap>
      </MessageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
