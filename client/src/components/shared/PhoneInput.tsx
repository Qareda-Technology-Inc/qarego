import { View, StyleSheet, TextInput, TouchableOpacity, Platform } from "react-native";
import React, { FC, useState, useEffect } from "react";
import { RFValue } from "react-native-responsive-fontsize";
import CustomText from "./CustomText";
import CountryCodePicker from "./CountryCodePicker";
import { Colors } from "@/utils/Constants";
import {
  getCountryFromLocale,
  getPhoneNumberFromDevice,
  extractPhoneNumber,
  Country,
} from "@/utils/phoneUtils";

interface PhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  countryCode?: string;
  onCountryChange?: (country: Country) => void;
  autoDetect?: boolean;
}

const PhoneInput: FC<PhoneInputProps> = ({
  value,
  onChangeText,
  onBlur,
  onFocus,
  countryCode,
  onCountryChange,
  autoDetect = true,
}) => {
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    getCountryFromLocale()
  );
  const [isFocused, setIsFocused] = useState(false);

  // Auto-detect country and phone number on mount
  useEffect(() => {
    if (autoDetect) {
      // Auto-detect country from locale
      const detectedCountry = getCountryFromLocale();
      setSelectedCountry(detectedCountry);
      if (onCountryChange) {
        onCountryChange(detectedCountry);
      }

      // Auto-detect phone number
      // Android: Will attempt to read from device (requires permission)
      // iOS: Not supported (Apple restriction) - user must enter manually
      getPhoneNumberFromDevice()
        .then((phoneNumber) => {
          if (phoneNumber) {
            // Extract phone number without country code
            const extracted = extractPhoneNumber(phoneNumber, detectedCountry.dialCode);
            if (extracted) {
              // Remove leading 0 if present and limit to 9 digits
              let cleaned = extracted.startsWith("0") ? extracted.substring(1) : extracted;
              if (cleaned.length === 9) {
                if (__DEV__) {
                  console.log(
                    `✅ ${Platform.OS === "android" ? "Android" : "iOS"}: Auto-detected phone number (${cleaned.length} digits)`
                  );
                }
                onChangeText(cleaned);
              } else if (cleaned.length === 10 && cleaned.startsWith("0")) {
                // Handle 10-digit numbers starting with 0
                cleaned = cleaned.substring(1);
                if (cleaned.length === 9) {
                  if (__DEV__) {
                    console.log(
                      `✅ ${Platform.OS === "android" ? "Android" : "iOS"}: Auto-detected phone number (${cleaned.length} digits)`
                    );
                  }
                  onChangeText(cleaned);
                }
              } else if (__DEV__) {
                console.log("⚠️ Phone number detected but format invalid (check country code)");
              }
            }
          }
          // Silent fail for iOS or permission denied - user can still enter manually
        })
        .catch((error) => {
          console.log("⚠️ Error detecting phone number:", error);
          // Silent fail - user can still enter manually
        });
    }
  }, [autoDetect]);

  const handleCountryChange = (country: Country) => {
    setSelectedCountry(country);
    if (onCountryChange) {
      onCountryChange(country);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (onFocus) onFocus();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (onBlur) onBlur();
  };

  // Handle phone number input: max 9 digits, auto-remove leading 0
  const handlePhoneChange = (text: string) => {
    // Remove all non-digit characters
    let cleaned = text.replace(/\D/g, "");
    
    // Auto-remove leading 0 if user types it
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }
    
    // Limit to 9 digits (after country code)
    if (cleaned.length > 9) {
      cleaned = cleaned.substring(0, 9);
    }
    
    onChangeText(cleaned);
  };

  return (
    <View style={[styles.container, isFocused && styles.containerFocused]}>
      <CountryCodePicker
        selectedCountry={selectedCountry}
        onSelectCountry={handleCountryChange}
      />
      
      <View style={styles.divider} />
      
      <TextInput
        placeholder="0XXXXXXXX"
        keyboardType="phone-pad"
        value={value}
        maxLength={9}
        onChangeText={handlePhoneChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholderTextColor="#999"
        style={styles.input}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  containerFocused: {
    borderColor: Colors.primary,
    backgroundColor: "#fff",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 8,
  },
  input: {
    flex: 1,
    fontSize: RFValue(16),
    fontFamily: "Medium",
    height: 50,
    color: Colors.text,
    paddingHorizontal: 12,
  },
});

export default PhoneInput;
