import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mmkvStorage } from "./storage";
import type { ServiceCoverage, ServiceZoneType } from "@/service/serviceZoneService";

type CustomLocation = {
  latitude: number;
  longitude: number;
  address: string;
} | null;

interface UserStoreProps {
  user: any;
  location: CustomLocation;
  outOfRange: boolean;
  /** Last service-area coverage result for the customer's location. */
  serviceCoverage: ServiceCoverage | null;
  /**
   * A place the customer chose by hand (outside the area, or ordering for somewhere else).
   * While set, coverage is checked here instead of at the phone's GPS position. Not persisted:
   * a fresh app start goes back to the real location.
   */
  coveragePoint: CustomLocation;
  setCoveragePoint: (data: CustomLocation) => void;
  setUser: (data: any) => void;
  setOutOfRange: (data: boolean) => void;
  setLocation: (data: CustomLocation) => void;
  setServiceCoverage: (data: ServiceCoverage | null) => void;
  isServiceAllowed: (type: ServiceZoneType) => boolean;
  clearData: () => void;
}

export const useUserStore = create<UserStoreProps>()(
  persist(
    (set, get) => ({
      user: null,
      location: null,
      outOfRange: false,
      serviceCoverage: null,
      coveragePoint: null,
      setCoveragePoint: (data) => set({ coveragePoint: data }),
      setUser: (data) => set({ user: data }),
      setLocation: (data) => set({ location: data }),
      setOutOfRange: (data) => set({ outOfRange: data }),
      setServiceCoverage: (data) =>
        set({
          serviceCoverage: data,
          outOfRange: data ? !data.inServiceArea : false,
        }),
      isServiceAllowed: (type) => {
        const coverage = get().serviceCoverage;
        if (!coverage) return true;
        if (coverage.openMode) return true;
        if (!coverage.inServiceArea) return false;
        return coverage.allowedServices.includes(type);
      },
      clearData: () =>
        set({
          user: null,
          location: null,
          outOfRange: false,
          serviceCoverage: null,
          coveragePoint: null,
        }),
    }),
    {
      name: "user-store",
      partialize: (state) => ({
        user: state.user,
        location: state.location,
      }),
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
