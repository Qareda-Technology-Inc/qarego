"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";

/**
 * Feature switches set on the server (GET /features). The server's MOMO_ENABLED turns mobile
 * money and card payments (Paystack) on or off everywhere.
 */
export type Features = { momoEnabled: boolean };

const DEFAULTS: Features = { momoEnabled: false };
let cached: Promise<Features> | null = null;

function loadFeatures(): Promise<Features> {
  if (!cached) {
    cached = fetcher("/features")
      .then((d: Partial<Features>) => ({ ...DEFAULTS, ...d }))
      .catch(() => {
        cached = null;
        return DEFAULTS;
      });
  }
  return cached;
}

/** Defaults to everything off until the server answers, so paused features never flash on. */
export function useFeatures(): Features {
  const [features, setFeatures] = useState<Features>(DEFAULTS);
  useEffect(() => {
    let alive = true;
    loadFeatures().then((f) => alive && setFeatures(f));
    return () => {
      alive = false;
    };
  }, []);
  return features;
}
