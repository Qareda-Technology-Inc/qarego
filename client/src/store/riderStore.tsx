import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mmkvStorage } from "./storage";

type CustomLocation = {
  latitude: number;
  longitude: number;
  address: string;
  heading: number;
} | null;

interface RiderStoreProps {
  user: any;
  location: CustomLocation;
  onDuty: boolean;
  setUser: (data: any) => void;
  setOnDuty: (data: boolean) => void;
  setLocation: (data: CustomLocation) => void;
  clearRiderData: () => void;
}

export const useRiderStore = create<RiderStoreProps>()(
  persist(
    (set) => ({
      user: null,
      location: null,
      onDuty: false,
      setUser: (data) => set({ user: data }),
      setLocation: (data) => set({ location: data }),
      setOnDuty: (data) => set({ onDuty: data }),
      clearRiderData: () => set({ user: null, location: null, onDuty: false }),
    }),
    {
      name: "rider-store",
      partialize: (state) => ({
        user: state.user,
        onDuty: state.onDuty,
        location: state.location,
      }),
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
