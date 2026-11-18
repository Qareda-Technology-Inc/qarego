import React from "react";
import { Stack } from "expo-router";

/**
 * Store, cart, checkout and order screens. They sit on the customer stack above the commerce
 * tabs (not inside the Stores tab), so Back from a store always returns to the screen that
 * opened it (Home, a module list, search, orders) and never to a module page visited earlier.
 * The module lists themselves (Groceries, Pharmacy, Laundry) are the Stores tab: (commerce)/stores.tsx.
 */
const StoreScreensLayout = () => (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="[id]" options={{ title: "Store" }} />
    <Stack.Screen name="cart" options={{ title: "Cart" }} />
    <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
    <Stack.Screen name="prescription" options={{ title: "Send a prescription" }} />
    <Stack.Screen name="laundry-book" options={{ title: "Book a pickup" }} />
    <Stack.Screen name="order" options={{ headerShown: false }} />
  </Stack>
);

export default StoreScreensLayout;
