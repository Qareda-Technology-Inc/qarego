import {
  View,
  TextInputProps,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import React, { FC } from "react";
import { Ionicons } from "@expo/vector-icons";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";

interface LocationInputProps extends TextInputProps {
  placeholder: string;
  type: "pickup" | "drop";
  value: string;
  onChangeText: (text: string) => void;
  /** Hide side dot — used inside RouteLocationCard */
  compact?: boolean;
}

const LocationInput: FC<LocationInputProps> = ({
  placeholder,
  type,
  value,
  onChangeText,
  compact = false,
  ...props
}) => {
  const dotColor = type === "pickup" ? T.success : T.danger;

  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
      {!compact ? (
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      ) : null}
      <TextInput
        style={[styles.input, compact && styles.inputCompact]}
        placeholder={placeholder}
        placeholderTextColor={T.inkSoft}
        value={value}
        onChangeText={onChangeText}
        {...props}
      />
      {value.length > 0 ? (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.clearBtn}
        >
          <Ionicons name="close-circle" size={20} color={T.inkSoft} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingRight: 4,
  },
  wrapperCompact: {
    paddingVertical: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: T.ink,
    padding: 0,
    fontFamily: "Regular",
  },
  inputCompact: {
    fontSize: 15,
    fontFamily: "Medium",
  },
  clearBtn: {
    padding: 4,
  },
});

export default LocationInput;
