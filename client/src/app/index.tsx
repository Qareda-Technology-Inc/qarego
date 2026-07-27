import { View, Image, Alert } from "react-native";
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
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
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

/** Boot splash — brand-first while fonts hydrate and session resolves. */
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

  const loaderX = useSharedValue(-40);

  useEffect(() => {
    loaderX.value = withRepeat(
      withTiming(80, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [loaderX]);

  const loaderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: loaderX.value }],
  }));

  useEffect(() => {
    const checkHydration = () => {
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

        const userRole = decodedAccessToken?.role;

        if (userRole === "customer" && riderUser) {
          useRiderStore.getState().clearRiderData();
        } else if (userRole === "rider" && user) {
          useUserStore.getState().clearData();
        }

        if (userRole === "customer") {
          const resumed = await resumeCustomerSession({ useReset: true });
          if (!resumed) {
            resetAndNavigate("/customer");
          }
        } else if (userRole === "rider") {
          resetAndNavigate("/rider/home");
        } else if (user && user.role === "customer") {
          const resumed = await resumeCustomerSession({ useReset: true });
          if (!resumed) {
            resetAndNavigate("/customer");
          }
        } else if (riderUser && riderUser.role === "rider") {
          resetAndNavigate("/rider/home");
        } else {
          resetAndNavigate("/role");
        }
      } catch (error) {
        console.log("Token decode error:", error);
        tokenStorage.clearAll();
        resetAndNavigate("/role");
      }
      return;
    }

    resetAndNavigate("/role");
  };

  useEffect(() => {
    if (loaded && storesHydrated && !hasNavigated) {
      // Slightly longer so the brand moment lands before route change.
      const timeoutId = setTimeout(() => {
        void tokenCheck();
        setHasNavigated(true);
      }, 900);
      return () => clearTimeout(timeoutId);
    }
  }, [loaded, storesHydrated, hasNavigated]);

  return (
    <View style={splashStyles.root}>
      <StatusBar style="dark" />
      <View pointerEvents="none" style={splashStyles.atmosphere}>
        <View style={splashStyles.orbTop} />
        <View style={splashStyles.orbSide} />
        <View style={splashStyles.orbBottom} />
      </View>

      <Animated.View
        entering={FadeInDown.duration(520).springify().damping(16)}
        style={splashStyles.content}
      >
        <View style={splashStyles.logoBadge}>
          <Image
            source={require("@/assets/images/logo_t.png")}
            style={splashStyles.logo}
          />
        </View>
        <CustomText fontFamily="Bold" fontSize={40} style={splashStyles.brandName}>
          QareGO
        </CustomText>
        <CustomText fontFamily="Medium" fontSize={15} style={splashStyles.tagline}>
          Rides, food & parcels across Ghana
        </CustomText>
        <View style={splashStyles.loaderWrap}>
          <Animated.View style={[splashStyles.loaderBar, loaderStyle]} />
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(180).duration(400)}
        style={splashStyles.footer}
      >
        <CustomText fontSize={12} style={splashStyles.footerText}>
          Sponsored by Qaretech
        </CustomText>
      </Animated.View>
    </View>
  );
};

export default Main;
