import React from "react";
import { Stack } from "expo-router";

const FoodLayout = () => (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" options={{ title: "Shops" }} />
    <Stack.Screen name="[id]" options={{ title: "Store" }} />
    <Stack.Screen name="cart" options={{ title: "Cart" }} />
    <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
    <Stack.Screen name="order" options={{ headerShown: false }} />
  </Stack>
);

export default FoodLayout;
