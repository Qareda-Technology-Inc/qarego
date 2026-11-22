import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import CustomText from "@/components/shared/CustomText";
import { goToSignIn, isSignedIn } from "@/utils/guest";

type Copy = { title: string; body: string; icon?: keyof typeof Ionicons.glyphMap; showBack?: boolean };

/** Shown on account-only screens (orders, account, notifications, profile) while browsing as a guest. */
export default function SignInPrompt({ title, body, icon = "person-circle-outline", showBack = false }: Copy) {
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {showBack ? (
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/customer"))}
          style={styles.back}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
      ) : null}
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={40} color="#1e88e5" />
        </View>
        <CustomText fontFamily="SemiBold" fontSize={20} style={styles.title}>
          {title}
        </CustomText>
        <CustomText fontSize={14} style={styles.text}>
          {body}
        </CustomText>
        <TouchableOpacity style={styles.button} onPress={goToSignIn} accessibilityRole="button">
          <CustomText fontFamily="SemiBold" fontSize={15} color="#fff">
            Sign in
          </CustomText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/** Wrap an account-only screen: guests see the sign-in prompt instead (hooks stay inside Screen). */
export function withAccount<P extends object>(Screen: React.ComponentType<P>, copy: Copy) {
  const Guarded = (props: P) => (isSignedIn() ? <Screen {...props} /> : <SignInPrompt {...copy} />);
  Guarded.displayName = `withAccount(${Screen.displayName || Screen.name || "Screen"})`;
  return Guarded;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  back: { padding: 16 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#e8f4ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { color: "#0f172a", textAlign: "center" },
  text: { color: "#475569", textAlign: "center", marginTop: 8, lineHeight: 20 },
  button: {
    marginTop: 22,
    backgroundColor: "#1e88e5",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
});
