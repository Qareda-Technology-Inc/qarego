import { create } from "zustand";
import {
  buildCartLineId,
  buildModifierKey,
  type CartModifier,
} from "@/utils/menuModifiers";

export type { CartModifier };

export type CartLine = {
  cartLineId: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: CartModifier[];
};

type FoodCartState = {
  restaurantId: string | null;
  restaurantName: string | null;
  minOrderAmount: number;
  deliveryFee: number;
  items: CartLine[];
  addItem: (payload: {
    restaurantId: string;
    restaurantName: string;
    minOrderAmount: number;
    deliveryFee: number;
    menuItemId: string;
    name: string;
    price: number;
    modifiers?: CartModifier[];
  }) => void;
  updateQuantity: (cartLineId: string, quantity: number) => void;
  removeItem: (cartLineId: string) => void;
  clearCart: () => void;
  subtotal: () => number;
  itemCount: () => number;
};

export const useFoodCartStore = create<FoodCartState>((set, get) => ({
  restaurantId: null,
  restaurantName: null,
  minOrderAmount: 0,
  deliveryFee: 0,
  items: [],

  addItem: ({
    restaurantId,
    restaurantName,
    minOrderAmount,
    deliveryFee,
    menuItemId,
    name,
    price,
    modifiers = [],
  }) => {
    const modifierKey = buildModifierKey(modifiers);
    const cartLineId = buildCartLineId(menuItemId, modifierKey);
    const state = get();

    const newLine: CartLine = {
      cartLineId,
      menuItemId,
      name,
      price,
      quantity: 1,
      modifiers,
    };

    if (state.restaurantId && state.restaurantId !== restaurantId) {
      set({
        restaurantId,
        restaurantName,
        minOrderAmount,
        deliveryFee,
        items: [newLine],
      });
      return;
    }

    const existing = state.items.find((i) => i.cartLineId === cartLineId);
    if (existing) {
      set({
        restaurantId,
        restaurantName,
        minOrderAmount,
        deliveryFee,
        items: state.items.map((i) =>
          i.cartLineId === cartLineId ? { ...i, quantity: i.quantity + 1 } : i
        ),
      });
    } else {
      set({
        restaurantId,
        restaurantName,
        minOrderAmount,
        deliveryFee,
        items: [...state.items, newLine],
      });
    }
  },

  updateQuantity: (cartLineId, quantity) => {
    if (quantity < 1) {
      get().removeItem(cartLineId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.cartLineId === cartLineId ? { ...i, quantity } : i
      ),
    });
  },

  removeItem: (cartLineId) => {
    const items = get().items.filter((i) => i.cartLineId !== cartLineId);
    if (items.length === 0) {
      set({
        restaurantId: null,
        restaurantName: null,
        minOrderAmount: 0,
        deliveryFee: 0,
        items: [],
      });
    } else {
      set({ items });
    }
  },

  clearCart: () =>
    set({
      restaurantId: null,
      restaurantName: null,
      minOrderAmount: 0,
      deliveryFee: 0,
      items: [],
    }),

  subtotal: () =>
    get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

  itemCount: () =>
    get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
