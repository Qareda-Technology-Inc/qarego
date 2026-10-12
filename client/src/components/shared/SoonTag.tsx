import React from "react";
import { View, StyleSheet } from "react-native";
import CustomText from "./CustomText";

/** Small "SOON" pill for options that aren't available yet (e.g. MoMo). */
export default function SoonTag() {
  return (
    <View style={styles.tag}>
      <CustomText fontFamily="Bold" fontSize={9} color="#0F172A">
        SOON
      </CustomText>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { backgroundColor: "#EDD228", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 4 },
});
