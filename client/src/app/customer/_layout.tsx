import React from "react";
import { Stack } from "expo-router";

/**
 * Ride/parcel screens sit on this stack (no bottom tabs).
 * Food / grocery / pharmacy / laundry use the (commerce) tab group; their store, cart, checkout
 * and order screens are in stores/ on this stack.
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
      {/* Store, cart, checkout and order screens: above the tabs so Back returns to whoever opened them. */}
      <Stack.Screen name="stores" options={{ headerShown: false }} />
      <Stack.Screen name="parcel" />
      <Stack.Screen name="gas" />
      <Stack.Screen name="selectlocations" />
      <Stack.Screen name="ridebooking" />
      <Stack.Screen name="liveride" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
};

export default CustomerLayout;
