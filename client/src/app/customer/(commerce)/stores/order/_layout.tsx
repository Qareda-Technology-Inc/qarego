import React from "react";
import { Stack } from "expo-router";

const FoodOrderLayout = () => (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="[id]" options={{ title: "Order tracking" }} />
  </Stack>
);

export default FoodOrderLayout;
