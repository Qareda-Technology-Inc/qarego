import { Alert, Platform } from "react-native";
import { imageSizeErrorMessage } from "@/utils/mediaLimits";
import { SHRINK_MAX_EDGE, shrinkPickedImage } from "@/utils/shrinkImage";

let ImagePicker: typeof import("expo-image-picker") | null = null;
try {
  ImagePicker = require("expo-image-picker");
} catch {
  /* native rebuild required */
}

export async function pickParcelImage(): Promise<string | null> {
  if (!ImagePicker) {
    Alert.alert(
      "Feature unavailable",
      "Rebuild the app to enable photo upload:\ncd client && npx expo prebuild --clean && npm run android"
    );
    return null;
  }

  if (Platform.OS === "ios") {
    const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!library.granted) {
      Alert.alert("Permission needed", "Allow photo access to attach a parcel photo.");
      return null;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  try {
    return await shrinkPickedImage(result.assets[0], SHRINK_MAX_EDGE.parcel);
  } catch (err) {
    Alert.alert(
      "Image too large",
      err instanceof Error ? err.message : imageSizeErrorMessage()
    );
    return null;
  }
}
