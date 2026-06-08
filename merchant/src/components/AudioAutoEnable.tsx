"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { autoEnableRestaurantAudio } from "@/lib/sound";

/** Primes kitchen alert audio when the merchant app is open (no tap banner). */
export function AudioAutoEnable() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || pathname === "/login" || !user) return;
    void autoEnableRestaurantAudio();
  }, [loading, pathname, user]);

  return null;
}
