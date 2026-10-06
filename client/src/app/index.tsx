import { View, Image } from "react-native";
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
const FONT_WAIT_MS = 4000;
const SESSION_WAIT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

const Main = () => {
  const [loaded, fontError] = useFonts({
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
  const [fontsTimedOut, setFontsTimedOut] = useState(false);

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

  useEffect(() => {
    if (loaded || fontError) return;
    const id = setTimeout(() => setFontsTimedOut(true), FONT_WAIT_MS);
    return () => clearTimeout(id);
  }, [loaded, fontError]);

  const goToLogin = () => {
    resetAndNavigate("/role");
  };

  const tokenCheck = async () => {
    const access_token = tokenStorage.getString("access_token") as string;
    const refresh_token = tokenStorage.getString("refresh_token") as string;

    if (!access_token || !refresh_token) {
      goToLogin();
      return;
    }

    try {
      let decodedAccessToken = jwtDecode<DecodedToken>(access_token);
      const decodedRefreshToken = jwtDecode<DecodedToken>(refresh_token);
      const currentTime = Date.now() / 1000;

      if (decodedRefreshToken?.exp < currentTime) {
        logout();
        goToLogin();
        return;
      }

      if (decodedAccessToken?.exp < currentTime) {
        try {
          await withTimeout(refresh_tokens(), SESSION_WAIT_MS);
          const newAccessToken = tokenStorage.getString("access_token") as string;
          if (newAccessToken) {
            decodedAccessToken = jwtDecode<DecodedToken>(newAccessToken);
          } else {
            logout();
            goToLogin();
            return;
          }
        } catch (err) {
          console.log(err);
          logout();
          goToLogin();
          return;
        }
      }

      const userRole = decodedAccessToken?.role;

      if (userRole === "customer" && riderUser) {
        useRiderStore.getState().clearRiderData();
      } else if (userRole === "rider" && user) {
        useUserStore.getState().clearData();
      }

      if (userRole === "customer" || (user && user.role === "customer")) {
        const resumed = await withTimeout(
          resumeCustomerSession({ useReset: true }),
          SESSION_WAIT_MS
        ).catch(() => false);
        if (!resumed) {
          resetAndNavigate("/customer");
        }
        return;
      }

      if (userRole === "rider" || (riderUser && riderUser.role === "rider")) {
        resetAndNavigate("/rider/home");
        return;
      }

      goToLogin();
    } catch (error) {
      console.log("Token decode error:", error);
      tokenStorage.clearAll();
      goToLogin();
    }
  };

  const fontsReady = loaded || !!fontError || fontsTimedOut;

  useEffect(() => {
    if (fontsReady && storesHydrated && !hasNavigated) {
      const timeoutId = setTimeout(() => {
        setHasNavigated(true);
        void tokenCheck().catch(() => goToLogin());
      }, 900);
      return () => clearTimeout(timeoutId);
    }
  }, [fontsReady, storesHydrated, hasNavigated]);

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
