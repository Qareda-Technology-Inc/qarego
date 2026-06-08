import React from "react";
import { Tabs, router, usePathname } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  COMMERCE_TAB_ACTIVE,
  COMMERCE_TAB_INACTIVE,
  commerceTabBarStyle,
  shouldHideCommerceTabBar,
} from "@/utils/commerceTabBar";

export const unstable_settings = {
  initialRouteName: "hub",
};

const ICON_SIZE = 22;

/** Bottom nav for food / grocery / pharmacy only — not shown on ride or parcel flows. */
export default function CustomerCommerceTabsLayout() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const hideTabBar = shouldHideCommerceTabBar(pathname);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COMMERCE_TAB_ACTIVE,
        tabBarInactiveTintColor: COMMERCE_TAB_INACTIVE,
        tabBarHideOnKeyboard: true,
        tabBarAllowFontScaling: false,
        tabBarStyle: commerceTabBarStyle(insets, hideTabBar),
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 0,
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="hub"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stores"
        options={{
          title: "Stores",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "storefront" : "storefront-outline"}
              size={ICON_SIZE}
              color={color}
            />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            const state = navigation.getState();
            const storesRoute = state.routes.find((r) => r.name === "stores");
            const nestedIndex =
              storesRoute?.state && "index" in storesRoute.state
                ? (storesRoute.state.index as number)
                : 0;
            if (nestedIndex > 0) {
              router.replace("/customer/stores");
            }
          },
        })}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "search" : "search-outline"}
              size={ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name="receipt-long"
              size={ICON_SIZE}
              color={focused ? COMMERCE_TAB_ACTIVE : color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen name="restaurants" options={{ href: null }} />
    </Tabs>
  );
}
