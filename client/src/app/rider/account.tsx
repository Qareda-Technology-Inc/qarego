import { View, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import React, { useState } from "react";
import { commonStyles } from "@/styles/commonStyles";
import CustomText from "@/components/shared/CustomText";
import { useRiderStore } from "@/store/riderStore";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/utils/Constants";
import { logout } from "@/service/authService";
import { useWS } from "@/service/WSProvider";
import { router } from "expo-router";
import {
  refreshPushRegistration,
  isNativePushModuleAvailable,
  getPushRebuildInstructions,
} from "@/service/pushNotifications";
import { sendTestPushNotification } from "@/service/testPush";

const RiderAccount = () => {
  const { user } = useRiderStore();
  const { disconnect } = useWS();
  const [pushBusy, setPushBusy] = useState(false);

  const handleTestPush = async () => {
    if (!isNativePushModuleAvailable()) {
      Alert.alert("Rebuild app for push", getPushRebuildInstructions());
      return;
    }
    setPushBusy(true);
    try {
      await refreshPushRegistration();
      const data = await sendTestPushNotification();
      Alert.alert("Push test", data.message || "Sent");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { msg?: string } } })?.response?.data?.msg ||
        (e instanceof Error ? e.message : "Test failed");
      Alert.alert("Push test failed", msg);
    } finally {
      setPushBusy(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => logout(disconnect) },
    ]);
  };

  const menuItems = [
    { icon: "person-outline", label: "Personal Info", library: Ionicons, onPress: () => router.push('/rider/profile') },
    { icon: "car-sport-outline", label: "Vehicle Info", library: Ionicons, onPress: () => router.push('/rider/profile') },
    { icon: "document-text-outline", label: "Documents", library: Ionicons, onPress: () => router.push('/rider/profile') },
    { icon: "wallet-outline", label: "Earnings & Payment", library: Ionicons, onPress: () => router.push('/rider/earnings') },
    { icon: "options-outline", label: "Work mode", library: Ionicons, onPress: () => router.push('/rider/services') },
    { icon: "shield-outline", label: "Reliability", library: Ionicons, onPress: () => router.push('/rider/reliability') },
    { icon: "stats-chart-outline", label: "Performance", library: Ionicons, onPress: () => router.push('/rider/analytics') },
    { icon: "shield-checkmark-outline", label: "Safety", library: Ionicons, onPress: () => {} },
    {
      icon: "notifications-outline",
      label: pushBusy ? "Sending test push…" : "Test push notification",
      library: Ionicons,
      onPress: handleTestPush,
    },
  ];

  return (
    <View style={commonStyles.container}>
      <SafeAreaView style={{ backgroundColor: '#fff' }} />
      
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Incomplete Profile Notice */}
        {user && (!user.name || !user.email) && (
          <View style={styles.noticeContainer}>
            <Ionicons name="information-circle" size={20} color={Colors.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <CustomText fontFamily="SemiBold" fontSize={14} style={{ marginBottom: 2 }}>
                Complete Your Profile
              </CustomText>
              <CustomText fontSize={12} color="#666">
                Please update your name and email in Personal Info
              </CustomText>
            </View>
          </View>
        )}

        {/* Header Profile Section */}
        <View style={styles.header}>
            <View style={styles.profileContainer}>
                <View style={styles.avatarContainer}>
                    <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={55} color={Colors.text} />
                    </View>
                    <TouchableOpacity style={styles.editIcon} onPress={() => router.push('/rider/profile')}>
                        <Ionicons name="pencil" size={14} color="#fff" />
                    </TouchableOpacity>
                </View>
                
                <View style={styles.userInfo}>
                    <CustomText variant="h5" fontFamily="Bold">{user?.name || "Rider Name"}</CustomText>
                    <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={14} color="#FFD700" />
                        <CustomText fontFamily="Medium" fontSize={14} style={{ marginLeft: 4 }}>
                            {user?.averageRating?.toFixed(1) || "5.0"}
                        </CustomText>
                    </View>
                    <CustomText fontSize={12} color="#666">{user?.phone || "+1234567890"}</CustomText>
                </View>
            </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
            {menuItems.map((item, index) => (
                <TouchableOpacity 
                    key={index} 
                    style={styles.menuItem} 
                    onPress={item.onPress}
                    activeOpacity={0.7}
                >
                    <View style={styles.menuItemLeft}>
                        <View style={[styles.iconContainer, { backgroundColor: item.color ? '#ffecec' : '#f5f5f5' }]}>
                            <item.library name={item.icon as any} size={20} color={item.color || "#333"} />
                        </View>
                        <CustomText fontFamily="Medium" fontSize={16} style={{ marginLeft: 15, color: item.color || Colors.text }}>
                            {item.label}
                        </CustomText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
            ))}

             <TouchableOpacity 
                style={[styles.menuItem, { marginTop: 20 }]} 
                onPress={handleLogout}
                activeOpacity={0.7}
            >
                <View style={styles.menuItemLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: '#ffecec' }]}>
                        <Ionicons name="log-out-outline" size={20} color="red" />
                    </View>
                    <CustomText fontFamily="Medium" fontSize={16} style={{ marginLeft: 15, color: "red" }}>
                        Logout
                    </CustomText>
                </View>
            </TouchableOpacity>
        </View>

        <View style={styles.footer}>
            <CustomText fontSize={12} color="#999">QareGo App v1.0.0</CustomText>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        alignItems: 'center'
    },
    profileContainer: {
        alignItems: 'center',
        marginTop: 10
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 15
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#eee',
        justifyContent: 'center',
        alignItems: 'center'
    },
    editIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: Colors.primary, 
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff'
    },
    userInfo: {
        alignItems: 'center'
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff9c4',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginTop: 5,
        marginBottom: 5
    },
    menuContainer: {
        padding: 20,
        width: '100%'
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
        width: '100%'
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },
    footer: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 20
    },
    noticeContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff9e6',
        margin: 20,
        marginBottom: 10,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ffe082',
        alignItems: 'center'
    }
});

export default RiderAccount;

