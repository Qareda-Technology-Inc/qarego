import { View, Text, Image, Alert } from "react-native";
import React, { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_600SemiBold,
} from "@expo-google-fonts/playfair-display";
import {
  Fraunces_600SemiBold,
  Fraunces_300Light,
} from "@expo-google-fonts/fraunces";
import {
  Lora_400Regular,
  Lora_500Medium,
} from "@expo-google-fonts/lora";
import { commonStyles } from "@/styles/commonStyles";
import { splashStyles } from "@/styles/splashStyles";
import CustomText from "@/components/shared/CustomText";
import { useUserStore } from "@/store/userStore";
import { useRiderStore } from "@/store/riderStore";
import { tokenStorage } from "@/store/storage";
import { jwtDecode } from "jwt-decode";
import { resetAndNavigate } from "@/utils/Helpers";
import { refresh_tokens } from "@/service/apiInterceptors";
import { logout } from "@/service/authService";
import { resumeCustomerSession } from "@/service/rideService";

interface DecodedToken {
  exp: number;
  phone?: string;
  id?: string;
  role?: string;
}

/** Project fonts: Playfair Display (headings), Fraunces (emphasis), Lora (body) */
const Main = () => {
  const [loaded] = useFonts({
    Bold: PlayfairDisplay_700Bold,
    SemiBold: Fraunces_600SemiBold,
    Medium: Lora_500Medium,
    Regular: Lora_400Regular,
    Light: Fraunces_300Light,
  });

  const { user } = useUserStore();
  const { user: riderUser } = useRiderStore();

  const [hasNavigated, setHasNavigated] = useState(false);
  const [storesHydrated, setStoresHydrated] = useState(false);

  // Wait for stores to hydrate
  useEffect(() => {
    // Check if stores are hydrated by checking if they've been loaded from storage
    const checkHydration = () => {
      // Zustand persist hydrates synchronously, but we'll give it a moment
      setTimeout(() => {
        setStoresHydrated(true);
      }, 100);
    };
    checkHydration();
  }, []);

  const tokenCheck = async () => {
    const access_token = tokenStorage.getString("access_token") as string;
    const refresh_token = tokenStorage.getString("refresh_token") as string;

    if (access_token && refresh_token) {
      try {
        let decodedAccessToken = jwtDecode<DecodedToken>(access_token);
        const decodedRefreshToken = jwtDecode<DecodedToken>(refresh_token);

        const currentTime = Date.now() / 1000;

        if (decodedRefreshToken?.exp < currentTime) {
          logout();
          Alert.alert("Session Expired, please login again");
          return;
        }

        if (decodedAccessToken?.exp < currentTime) {
          try {
            await refresh_tokens();
            // After refreshing, re-decode the new token
            const newAccessToken = tokenStorage.getString("access_token") as string;
            if (newAccessToken) {
              decodedAccessToken = jwtDecode<DecodedToken>(newAccessToken);
            }
          } catch (err) {
            console.log(err);
            Alert.alert("Refresh Token Error");
            logout();
            return;
          }
        }

        // Determine user role - prioritize token role, then check stores
        const userRole = decodedAccessToken?.role;
        
        console.log("Navigation check:", {
          tokenRole: userRole,
          customerStore: !!user,
          riderStore: !!riderUser,
          customerUserRole: user?.role,
          riderUserRole: riderUser?.role,
        });

        // Clear opposite store if there's a mismatch
        if (userRole === "customer" && riderUser) {
          const { clearRiderData } = useRiderStore.getState();
          clearRiderData();
          console.log("Cleared rider store - user is customer");
        } else if (userRole === "rider" && user) {
          const { clearData } = useUserStore.getState();
          clearData();
          console.log("Cleared customer store - user is rider");
        }

        // Prioritize role from token, but also check stores for consistency
        if (userRole === "customer") {
          console.log("Navigating to customer");
          const resumed = await resumeCustomerSession({ useReset: true });
          if (!resumed) {
            resetAndNavigate("/customer");
          }
        } else if (userRole === "rider") {
          console.log("Navigating to rider home");
          resetAndNavigate("/rider/home");
        } else if (user && user.role === "customer") {
          console.log("Using customer store (old token), navigating to customer");
          const resumed = await resumeCustomerSession({ useReset: true });
          if (!resumed) {
            resetAndNavigate("/customer");
          }
        } else if (riderUser && riderUser.role === "rider") {
          // Fallback to store if token doesn't have role (old tokens)
          console.log("Using rider store (old token), navigating to rider home");
          resetAndNavigate("/rider/home");
        } else {
          // If no role found, navigate to role selection
          console.log("No role found, navigating to role selection");
          resetAndNavigate("/role");
        }
      } catch (error) {
        console.log("Token decode error:", error);
        // If token is invalid, clear and redirect to role selection
        tokenStorage.clearAll();
        resetAndNavigate("/role");
      }
      return;
    }

    resetAndNavigate("/role");
  };

  useEffect(() => {
    if (loaded && storesHydrated && !hasNavigated) {
      const timeoutId = setTimeout(() => {
        tokenCheck();
        setHasNavigated(true);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [loaded, storesHydrated, hasNavigated]);

  return (
    <View style={commonStyles.container}>
      <Image
        source={require("@/assets/images/logo_t.png")}
        style={splashStyles.img}
      />
      <CustomText variant="h5" fontFamily="Medium" style={splashStyles.text}>
        Sponsored by Qaretech
      </CustomText>
    </View>
  );
};

export default Main;
