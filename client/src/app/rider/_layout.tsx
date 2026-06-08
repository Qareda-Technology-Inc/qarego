import React from "react";
import { Stack } from "expo-router";
import { RiderDrawerProvider } from "@/context/RiderDrawerContext";

const RiderLayout = () => {
  return (
    <RiderDrawerProvider>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="rides" />
      <Stack.Screen name="account" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="liveride" />
      <Stack.Screen name="otp-verify" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="services" />
      <Stack.Screen name="reliability" />
      <Stack.Screen name="analytics" />
    </Stack>
    </RiderDrawerProvider>
  );
};

export default RiderLayout;

