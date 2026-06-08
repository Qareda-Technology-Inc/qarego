import React from "react";
import { Stack } from "expo-router";

/**
 * Ride/parcel screens sit on this stack (no bottom tabs).
 * Food / grocery / pharmacy use the (commerce) tab group.
 */
export const unstable_settings = {
  initialRouteName: "index",
};

const CustomerLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="home" />
      <Stack.Screen name="(commerce)" options={{ headerShown: false }} />
      <Stack.Screen name="parcel" />
      <Stack.Screen name="selectlocations" />
      <Stack.Screen name="ridebooking" />
      <Stack.Screen name="liveride" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="family" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="otp-verify" />
    </Stack>
  );
};

export default CustomerLayout;
