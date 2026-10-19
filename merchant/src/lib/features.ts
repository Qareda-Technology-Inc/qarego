"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";

/**
 * Feature switches set on the server (GET /features). Mobile money is paused while QareGO
 * moves to a new provider; the server's MOMO_ENABLED turns its screens back on everywhere.
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
