"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { disconnectSocket, getSocket } from "@/lib/socket";
import { fetcher } from "@/lib/api";
import { autoEnableRestaurantAudio } from "@/lib/sound";

export interface MerchantUser {
  userId: string;
  name: string;
  role: "merchant" | "cook";
}

export interface StoreSummary {
  _id: string;
  name: string;
  imageEmoji?: string;
  vertical?: string;
}

interface AuthContextType {
  user: MerchantUser | null;
  restaurants: StoreSummary[];
  activeRestaurantId: string | null;
  activeRestaurant: StoreSummary | null;
  loading: boolean;
  isOwner: boolean;
  login: (token: string, refreshToken: string, userData: MerchantUser, restaurants: StoreSummary[]) => void;
  logout: () => void;
  setActiveRestaurant: (id: string, redirectTo?: string) => void;
  refreshRestaurants: () => Promise<StoreSummary[]>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  restaurants: [],
  activeRestaurantId: null,
  activeRestaurant: null,
  loading: true,
  isOwner: false,
  login: () => {},
  logout: () => {},
  setActiveRestaurant: () => {},
  refreshRestaurants: async () => [],
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MerchantUser | null>(null);
  const [restaurants, setRestaurants] = useState<StoreSummary[]>([]);
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const token = localStorage.getItem("accessToken");
      const userData = localStorage.getItem("merchantUser");
      const storedStores = localStorage.getItem("merchantRestaurants");
      const storedActive = localStorage.getItem("activeRestaurantId");
      if (token && userData) {
        setUser(JSON.parse(userData));
        const list: StoreSummary[] = storedStores ? JSON.parse(storedStores) : [];
        setRestaurants(list);
        const active = storedActive && list.some((r) => r._id === storedActive)
          ? storedActive
          : list[0]?._id || null;
        setActiveRestaurantId(active);
        if (active) localStorage.setItem("activeRestaurantId", active);
      }
    } catch {
      localStorage.removeItem("merchantUser");
      localStorage.removeItem("merchantRestaurants");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    void autoEnableRestaurantAudio();
    getSocket();
  }, [loading, user]);

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.push("/login");
    } else if (user && pathname === "/login") {
      router.push("/");
    } else if (
      user?.role === "merchant" &&
      restaurants.length === 0 &&
      pathname !== "/login" &&
      pathname !== "/stores"
    ) {
      // No stores yet — guide owner to create their first store
      router.push("/stores");
    }
  }, [user, restaurants, loading, pathname, router]);

  const persistStores = (list: StoreSummary[], active?: string | null) => {
    localStorage.setItem("merchantRestaurants", JSON.stringify(list));
    setRestaurants(list);
    const next = active !== undefined ? active : activeRestaurantId;
    const valid = next && list.some((r) => r._id === next) ? next : list[0]?._id || null;
    setActiveRestaurantId(valid);
    if (valid) localStorage.setItem("activeRestaurantId", valid);
    else localStorage.removeItem("activeRestaurantId");
  };

  const login = (
    token: string,
    refreshToken: string,
    userData: MerchantUser,
    list: StoreSummary[]
  ) => {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("merchantUser", JSON.stringify(userData));
    setUser(userData);
    persistStores(list || [], list?.[0]?._id || null);
    disconnectSocket();
    router.push("/");
  };

  const logout = () => {
    disconnectSocket();
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("merchantUser");
    localStorage.removeItem("merchantRestaurants");
    localStorage.removeItem("activeRestaurantId");
    setUser(null);
    setRestaurants([]);
    setActiveRestaurantId(null);
    router.push("/login");
  };

  // Switch active store. Full navigation so all scoped data reloads cleanly.
  const setActiveRestaurant = (id: string, redirectTo = "/") => {
    localStorage.setItem("activeRestaurantId", id);
    window.location.assign(redirectTo);
  };

  const refreshRestaurants = useCallback(async () => {
    const data = await fetcher("/merchant/restaurants");
    const list: StoreSummary[] = (data.restaurants ?? []).map((r: StoreSummary) => ({
      _id: r._id,
      name: r.name,
      imageEmoji: r.imageEmoji,
      vertical: r.vertical,
    }));
    persistStores(list);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRestaurantId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
      </div>
    );
  }

  const activeRestaurant = restaurants.find((r) => r._id === activeRestaurantId) || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        restaurants,
        activeRestaurantId,
        activeRestaurant,
        loading,
        isOwner: user?.role === "merchant",
        login,
        logout,
        setActiveRestaurant,
        refreshRestaurants,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
