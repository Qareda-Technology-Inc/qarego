import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mmkvStorage } from "./storage";

export type RecentPlace = { address: string; latitude: number; longitude: number; at: number };

const MAX = 8;
// Two picks this close together are the same place (about 50 m).
const samePlace = (a: RecentPlace, b: { latitude: number; longitude: number; address: string }) =>
  a.address === b.address ||
  (Math.abs(a.latitude - b.latitude) < 0.0005 && Math.abs(a.longitude - b.longitude) < 0.0005);

/** Places the customer picked for rides and parcels on this phone, newest first. */
interface RecentPlacesStore {
  places: RecentPlace[];
  add: (place: { address?: string | null; latitude?: number; longitude?: number }) => void;
  remove: (at: number) => void;
}

export const useRecentPlacesStore = create<RecentPlacesStore>()(
  persist(
    (set) => ({
      places: [],
      add: (p) => {
        if (!p.address?.trim() || typeof p.latitude !== "number" || typeof p.longitude !== "number") return;
        const next = { address: p.address.trim(), latitude: p.latitude, longitude: p.longitude, at: Date.now() };
        set((s) => ({ places: [next, ...s.places.filter((x) => !samePlace(x, next))].slice(0, MAX) }));
      },
      remove: (at) => set((s) => ({ places: s.places.filter((x) => x.at !== at) })),
    }),
    { name: "recent-places", storage: createJSONStorage(() => mmkvStorage) }
  )
);
