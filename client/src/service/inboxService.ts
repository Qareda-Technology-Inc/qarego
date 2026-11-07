import { appAxios } from "./apiInterceptors";

/** A store (and maybe one item) an admin message promotes; tapping opens it. */
export type InboxPromo = {
  restaurantId: string;
  restaurantName: string;
  vertical: string;
  menuItemId: string | null;
  menuItemName: string | null;
  price: number | null;
};

export type InboxMessage = {
  _id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  unread: boolean;
  promo: InboxPromo | null;
};

export const fetchInbox = async (): Promise<{ unread: number; messages: InboxMessage[] }> => {
  const res = await appAxios.get("/notifications/inbox");
  return res.data;
};

export const fetchInboxUnread = async (): Promise<number> => {
  const res = await appAxios.get("/notifications/inbox/unread");
  return Number(res.data?.unread) || 0;
};

export const markInboxSeen = async (): Promise<void> => {
  await appAxios.post("/notifications/inbox/seen");
};

/** Path that opens a promoted store, landing on the item when there is one. */
export function promoPath(promo: { restaurantId: string; menuItemId?: string | null }): string {
  const base = `/customer/stores/${promo.restaurantId}`;
  return promo.menuItemId ? `${base}?item=${promo.menuItemId}` : base;
}
