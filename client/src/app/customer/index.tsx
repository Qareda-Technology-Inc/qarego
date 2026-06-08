import { View, ScrollView, SafeAreaView } from "react-native";
import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/utils/Constants";
import { homeStyles } from "@/styles/homeStyles";
import ServiceSelectScreen from "@/components/customer/ServiceSelectScreen";
import { getMyRides } from "@/service/rideService";
import { useUserStore } from "@/store/userStore";
import AccountRegistrationModal from "@/components/shared/AccountRegistrationModal";

/**
 * First customer screen: "What do you need?" only.
 * No bottom nav, no top nav (minimal header).
 * Ride/parcel → /customer/home (map + side nav, no bottom tabs).
 * Food/grocery/pharmacy → /customer/hub (bottom nav: Home, Stores, Search, Orders, Account).
 */
const CustomerServiceSelect = () => {
  const { user } = useUserStore();

  useEffect(() => {
    const t = setTimeout(() => getMyRides(), 100);
    return () => clearTimeout(t);
  }, []);

  const shouldPrompt = !!user && !user.name;
  const userId = user?._id || user?.id;

  return (
    <SafeAreaView style={homeStyles.container}>
      <StatusBar style="dark" backgroundColor={Colors.primary} translucent={false} />
      <ScrollView
        style={homeStyles.scroll}
        contentContainerStyle={homeStyles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ServiceSelectScreen />
      </ScrollView>

      {shouldPrompt && userId ? (
        <AccountRegistrationModal
          visible={shouldPrompt}
          userId={userId}
          initialName={user?.name}
          initialEmail={user?.email}
        />
      ) : null}
    </SafeAreaView>
  );
};

export default CustomerServiceSelect;
