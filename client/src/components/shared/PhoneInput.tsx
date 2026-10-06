import { View, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import React, { FC, useState, useEffect } from "react";
import { RFValue } from "react-native-responsive-fontsize";
import CustomText from "./CustomText";
import CountryCodePicker from "./CountryCodePicker";
import { Colors } from "@/utils/Constants";
import { getCountryFromLocale, Country } from "@/utils/phoneUtils";

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

  useEffect(() => {
    if (!autoDetect) return;
    const detectedCountry = getCountryFromLocale();
    setSelectedCountry(detectedCountry);
    onCountryChange?.(detectedCountry);
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
  // Review accounts keep 22222222 / 11111111 as typed.
  const handlePhoneChange = (text: string) => {
    let cleaned = text.replace(/\D/g, "");
    const isReviewNumber = /^2{1,10}$/.test(cleaned) || /^1{1,10}$/.test(cleaned);

    if (!isReviewNumber && cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }

    const maxLength = isReviewNumber ? 10 : 9;
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength);
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
        maxLength={10}
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
