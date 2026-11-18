/**
 * Back navigation around the commerce modules (Restaurants, Groceries, Pharmacy, Laundry).
 * The route tree mirrors src/app/customer: the module lists are tabs in (commerce), and the
 * store / cart / order screens live in customer/stores on the main customer stack.
 */
import React from "react";
import { Text } from "react-native";
import { Stack, Tabs, router } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { leaveCommerce, openCommerceModule } from "@/utils/commerceNavigation";

const Page = (name: string) => {
  const Screen = () => <Text>{name}</Text>;
  Screen.displayName = name;
  return Screen;
};
function StackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
function TabsLayout() {
  return <Tabs backBehavior="history" screenOptions={{ headerShown: false }} />;
}

const routes = {
  _layout: StackLayout,
  index: Page("welcome"),
  "customer/_layout": {
    default: StackLayout,
    unstable_settings: { initialRouteName: "index" },
  },
  "customer/index": Page("services"),
  "customer/(commerce)/_layout": {
    default: TabsLayout,
    unstable_settings: { initialRouteName: "hub" },
  },
  "customer/(commerce)/hub": Page("restaurants home"),
  "customer/(commerce)/stores": Page("module list"),
  "customer/(commerce)/orders": Page("orders tab"),
  "customer/stores/_layout": StackLayout,
  "customer/stores/[id]": Page("store page"),
  "customer/stores/laundry-book": Page("book laundry"),
  "customer/stores/order/_layout": StackLayout,
  "customer/stores/order/[id]": Page("order tracking"),
};

const go = (fn: () => void) => act(() => fn());

describe("commerce back navigation", () => {
  it("Laundry from the services screen goes back to services, not the restaurants home", () => {
    renderRouter(routes, { initialUrl: "/customer" });
    go(() => openCommerceModule("LAUNDRY"));
    expect(screen.getByText("module list")).toBeTruthy();
    go(() => router.back());
    expect(screen.getByText("services")).toBeTruthy();
  });

  it.each(["GROCERY", "PHARMACY"] as const)("%s from the services screen goes back to services", (v) => {
    renderRouter(routes, { initialUrl: "/customer" });
    go(() => openCommerceModule(v));
    expect(screen.getByText("module list")).toBeTruthy();
    go(() => router.back());
    expect(screen.getByText("services")).toBeTruthy();
  });

  it("booking from the Laundry list returns to the Laundry list", () => {
    renderRouter(routes, { initialUrl: "/customer" });
    go(() => openCommerceModule("LAUNDRY"));
    go(() => router.push("/customer/stores/laundry-book"));
    expect(screen.getByText("book laundry")).toBeTruthy();
    go(() => router.back());
    expect(screen.getByText("module list")).toBeTruthy();
    go(() => router.back());
    expect(screen.getByText("services")).toBeTruthy();
  });

  it("a restaurant opened from Home returns to Home even after Laundry was visited", () => {
    renderRouter(routes, { initialUrl: "/customer" });
    go(() => openCommerceModule("LAUNDRY"));
    go(() => router.navigate("/customer/hub"));
    expect(screen.getByText("restaurants home")).toBeTruthy();
    go(() => router.push({ pathname: "/customer/stores/[id]", params: { id: "r1" } }));
    expect(screen.getByText("store page")).toBeTruthy();
    go(() => router.back());
    expect(screen.getByText("restaurants home")).toBeTruthy(); // not the Laundry list
  });

  it("Restaurants from the services screen: store → back → Home → back → services", () => {
    renderRouter(routes, { initialUrl: "/customer" });
    go(() => openCommerceModule("FOOD"));
    expect(screen.getByText("restaurants home")).toBeTruthy();
    go(() => router.push({ pathname: "/customer/stores/[id]", params: { id: "r1" } }));
    go(() => router.back());
    expect(screen.getByText("restaurants home")).toBeTruthy();
    go(() => router.back());
    expect(screen.getByText("services")).toBeTruthy();
  });

  it("the All services button returns to the services screen without stacking a copy", () => {
    renderRouter(routes, { initialUrl: "/customer" });
    go(() => openCommerceModule("GROCERY"));
    go(() => router.navigate("/customer/hub"));
    go(() => leaveCommerce());
    expect(screen.getByText("services")).toBeTruthy();
    expect(router.canGoBack()).toBe(false);
  });

  it("closing an order tracking screen lands on the module it came from", () => {
    renderRouter(routes, { initialUrl: "/customer" });
    go(() => openCommerceModule("LAUNDRY"));
    go(() => router.push("/customer/stores/laundry-book"));
    go(() => router.replace("/customer/stores/order/o1"));
    expect(screen.getByText("order tracking")).toBeTruthy();
    go(() => router.dismissTo("/customer/stores?type=LAUNDRY"));
    expect(screen.getByText("module list")).toBeTruthy();
    go(() => router.back());
    expect(screen.getByText("services")).toBeTruthy();
  });
});
