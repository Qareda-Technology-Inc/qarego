export type StoreVertical = "FOOD" | "GROCERY" | "PHARMACY";

export type CommerceOrderCopy = {
  ordersTab: string;
  ordersTitle: string;
  inProgressStat: string;
  activeFilter: string;
  menuNav: string;
  menuAddLabel: string;
  cooksNav: string;
  cooksDescription: string;
  cooksEmpty: string;
  openOrders: string;
  staffWorkload: string;
  productCountLabel: string;
  backToOrders: string;
  dashboardInKitchen: string;
  dashboardTakingYou: string;
  menuSubtitle: string;
  settingsNotFound: string;
  settingsOffline: string;
  loginSubtitle: string;
  enableAlertsTitle: string;
  enableAlertsBody: string;
  mapPickupTitle: string;
};

const COPY: Record<StoreVertical, CommerceOrderCopy> = {
  FOOD: {
    ordersTab: "Kitchen",
    ordersTitle: "Kitchen orders",
    inProgressStat: "In kitchen",
    activeFilter: "In kitchen",
    menuNav: "Menu Builder",
    menuAddLabel: "Add dish",
    cooksNav: "Cooks",
    cooksDescription:
      "Cooks can view and manage the kitchen order queue and mark items sold out. They cannot edit prices or manage staff.",
    cooksEmpty: "No cooks yet. Add one to share the kitchen workload.",
    openOrders: "Open kitchen",
    staffWorkload: "kitchen order queue",
    productCountLabel: "menu items",
    backToOrders: "Back to kitchen",
    dashboardInKitchen: "in kitchen",
    dashboardTakingYou: "Taking you to the kitchen…",
    menuSubtitle: "Categories, dishes, and add-ons for your restaurant menu.",
    settingsNotFound: "Restaurant not found.",
    settingsOffline: "Your restaurant is currently offline platform-wide. Contact the admin.",
    loginSubtitle: "Manage your restaurant's orders and menu",
    enableAlertsTitle: "Enable kitchen alerts",
    enableAlertsBody: "Tap once so new orders play a sound and show notifications.",
    mapPickupTitle: "Restaurant (pickup)",
  },
  GROCERY: {
    ordersTab: "Orders",
    ordersTitle: "Store orders",
    inProgressStat: "Being prepared",
    activeFilter: "In progress",
    menuNav: "Product catalog",
    menuAddLabel: "Add product",
    cooksNav: "Staff",
    cooksDescription:
      "Staff can view and manage the order queue and mark items sold out. They cannot edit prices or manage staff.",
    cooksEmpty: "No staff yet. Add someone to share the order workload.",
    openOrders: "Open orders",
    staffWorkload: "order queue",
    productCountLabel: "products",
    backToOrders: "Back to orders",
    dashboardInKitchen: "in progress",
    dashboardTakingYou: "Taking you to orders…",
    menuSubtitle: "Categories and products for your grocery store.",
    settingsNotFound: "Store not found.",
    settingsOffline: "Your store is currently offline platform-wide. Contact the admin.",
    loginSubtitle: "Manage your store's orders and products",
    enableAlertsTitle: "Enable order alerts",
    enableAlertsBody: "Tap once so new orders play a sound and show notifications.",
    mapPickupTitle: "Store (pickup)",
  },
  PHARMACY: {
    ordersTab: "Orders",
    ordersTitle: "Pharmacy orders",
    inProgressStat: "Being prepared",
    activeFilter: "In progress",
    menuNav: "Product catalog",
    menuAddLabel: "Add product",
    cooksNav: "Staff",
    cooksDescription:
      "Staff can view and manage the order queue and mark items sold out. They cannot edit prices or manage staff.",
    cooksEmpty: "No staff yet. Add someone to share the order workload.",
    openOrders: "Open orders",
    staffWorkload: "order queue",
    productCountLabel: "products",
    backToOrders: "Back to orders",
    dashboardInKitchen: "in progress",
    dashboardTakingYou: "Taking you to orders…",
    menuSubtitle: "Categories and products for your pharmacy.",
    settingsNotFound: "Pharmacy not found.",
    settingsOffline: "Your pharmacy is currently offline platform-wide. Contact the admin.",
    loginSubtitle: "Manage your pharmacy's orders and products",
    enableAlertsTitle: "Enable order alerts",
    enableAlertsBody: "Tap once so new orders play a sound and show notifications.",
    mapPickupTitle: "Pharmacy (pickup)",
  },
};

export function normalizeVertical(value?: string | null): StoreVertical {
  const v = String(value ?? "FOOD").toUpperCase();
  if (v === "GROCERY" || v === "PHARMACY") return v;
  return "FOOD";
}

export function getCommerceOrderCopy(vertical?: string | null): CommerceOrderCopy {
  return COPY[normalizeVertical(vertical)];
}
