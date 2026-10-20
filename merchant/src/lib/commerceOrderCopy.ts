export type StoreVertical = "FOOD" | "GROCERY" | "PHARMACY" | "GAS";

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
  /** Orders board */
  boardSubtitle: string;
  preparingColumn: string;
  preparingEmpty: string;
  readyButton: string;
  /** Menu page */
  itemsHeading: string;
  itemSingular: string;
  staffRole: string;
  categoryExamples: string;
}

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
    boardSubtitle: "Accept new orders, cook, then mark them ready for the rider or the customer.",
    preparingColumn: "Cooking",
    preparingEmpty: "Nothing on the stove",
    readyButton: "Mark ready",
    itemsHeading: "Dishes",
    itemSingular: "dish",
    staffRole: "cook",
    categoryExamples: "Main Dishes, Drinks, Sides",
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
    boardSubtitle: "Accept new orders, pack them, then mark them ready for the rider or the customer.",
    preparingColumn: "Packing",
    preparingEmpty: "Nothing being packed",
    readyButton: "Packed & ready",
    itemsHeading: "Products",
    itemSingular: "product",
    staffRole: "staff member",
    categoryExamples: "Fresh Produce, Drinks, Household",
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
    boardSubtitle: "Accept new orders, check any prescription, prepare them, then mark them ready.",
    preparingColumn: "Preparing",
    preparingEmpty: "Nothing being prepared",
    readyButton: "Ready for pickup",
    itemsHeading: "Products",
    itemSingular: "product",
    staffRole: "staff member",
    categoryExamples: "Pain Relief, Vitamins, Baby Care",
  },
  GAS: {
    ordersTab: "Orders",
    ordersTitle: "Gas orders",
    inProgressStat: "Being filled",
    activeFilter: "In progress",
    menuNav: "Station",
    menuAddLabel: "Add item",
    cooksNav: "Staff",
    cooksDescription:
      "Staff can view and manage the order queue. They cannot change prices or manage staff.",
    cooksEmpty: "No staff yet. Add someone to share the order workload.",
    openOrders: "Open orders",
    staffWorkload: "fill queue",
    productCountLabel: "items",
    backToOrders: "Back to orders",
    dashboardInKitchen: "in progress",
    dashboardTakingYou: "Taking you to orders…",
    menuSubtitle: "Gas prices are set by QareGO.",
    settingsNotFound: "Station not found.",
    settingsOffline: "Your station is currently offline platform-wide. Contact the admin.",
    loginSubtitle: "Manage your gas station's orders",
    enableAlertsTitle: "Enable order alerts",
    enableAlertsBody: "Tap once so new orders play a sound and show notifications.",
    mapPickupTitle: "Gas station",
    boardSubtitle: "Accept new orders, fill or swap the cylinder, then mark it ready for the rider.",
    preparingColumn: "Filling",
    preparingEmpty: "No cylinders being filled",
    readyButton: "Cylinder ready",
    itemsHeading: "Items",
    itemSingular: "item",
    staffRole: "staff member",
    categoryExamples: "Cylinders, Accessories",
  },
};

export function normalizeVertical(value?: string | null): StoreVertical {
  const v = String(value ?? "FOOD").toUpperCase();
  if (v === "GROCERY" || v === "PHARMACY" || v === "GAS") return v;
  return "FOOD";
}

export function getCommerceOrderCopy(vertical?: string | null): CommerceOrderCopy {
  return COPY[normalizeVertical(vertical)];
}
