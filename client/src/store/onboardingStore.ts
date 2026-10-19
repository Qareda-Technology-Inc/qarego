import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mmkvStorage } from "./storage";

/**
 * First-time guidance the customer has already seen, per account, so a second person
 * signing in on the same phone still gets the tour.
 * Keys: "welcome" (intro slides), "tour:home", "tip:ridebooking", "tip:ridecode".
 */
interface OnboardingStore {
  seen: Record<string, Record<string, true>>;
  hasSeen: (userId: string | undefined, key: string) => boolean;
  markSeen: (userId: string | undefined, key: string) => void;
  /** "Show me around" in Account: replay everything for this account. */
  reset: (userId: string | undefined) => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      seen: {},
      hasSeen: (userId, key) => (userId ? !!get().seen[userId]?.[key] : true),
      markSeen: (userId, key) => {
        if (!userId) return;
        set((s) => ({ seen: { ...s.seen, [userId]: { ...s.seen[userId], [key]: true } } }));
      },
      reset: (userId) => {
        if (!userId) return;
        set((s) => {
          const next = { ...s.seen };
          delete next[userId];
          return { seen: next };
        });
      },
    }),
    {
      name: "onboarding-store",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (s) => ({ seen: s.seen }),
    }
  )
);

/** Current customer's id, as stored by the user store. */
export function onboardingUserId(user: { _id?: string; id?: string } | null | undefined) {
  return user?._id || user?.id || undefined;
}
