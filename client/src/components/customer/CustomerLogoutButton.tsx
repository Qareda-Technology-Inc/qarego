import React from "react";
import { Alert, TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { RFValue } from "react-native-responsive-fontsize";
import { useWS } from "@/service/WSProvider";
import { logout } from "@/service/authService";
import { Colors } from "@/utils/Constants";

type Props = {
  iconColor?: string;
  style?: ViewStyle;
  size?: number;
};

/** Log out only — no full ride home drawer. */
const CustomerLogoutButton: React.FC<Props> = ({
  iconColor = Colors.text,
  style,
  size = RFValue(22),
}) => {
  const { disconnect } = useWS();

  const handlePress = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => logout(disconnect),
      },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={handlePress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      activeOpacity={0.7}
      accessibilityLabel="Log out"
    >
      <MaterialIcons name="logout" size={size} color={iconColor} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default CustomerLogoutButton;
