import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import SideDrawer from "@/components/shared/SideDrawer";

interface RiderDrawerContextValue {
  openDrawer: () => void;
  closeDrawer: () => void;
}

const RiderDrawerContext = createContext<RiderDrawerContextValue | null>(null);

export function RiderDrawerProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  const openDrawer = useCallback(() => setVisible(true), []);
  const closeDrawer = useCallback(() => setVisible(false), []);

  const value = useMemo(
    () => ({ openDrawer, closeDrawer }),
    [openDrawer, closeDrawer]
  );

  return (
    <RiderDrawerContext.Provider value={value}>
      {children}
      <SideDrawer visible={visible} onClose={closeDrawer} role="rider" />
    </RiderDrawerContext.Provider>
  );
}

export function useRiderDrawer(): RiderDrawerContextValue {
  const ctx = useContext(RiderDrawerContext);
  if (!ctx) {
    throw new Error("useRiderDrawer must be used within RiderDrawerProvider");
  }
  return ctx;
}
