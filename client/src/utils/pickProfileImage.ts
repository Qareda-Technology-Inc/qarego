import { Alert, Platform } from "react-native";
import { imageSizeErrorMessage } from "@/utils/mediaLimits";
import { SHRINK_MAX_EDGE, shrinkPickedImage } from "@/utils/shrinkImage";

let ImagePicker: typeof import("expo-image-picker") | null = null;
try {
  ImagePicker = require("expo-image-picker");
} catch {
  /* native rebuild required */
}

export async function pickProfileImage(): Promise<string | null> {
  if (!ImagePicker) {
    Alert.alert(
      "Feature unavailable",
      "Rebuild the app to enable photo upload:\ncd client && npx expo prebuild --clean && npm run android"
    );
    return null;
  }

  // Android 13+ uses the system photo picker; broad gallery permission is not allowed.
  if (Platform.OS === "ios") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to choose a profile picture."
      );
      return null;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  try {
    return await shrinkPickedImage(result.assets[0], SHRINK_MAX_EDGE.profile);
  } catch (err) {
    Alert.alert(
      "Image too large",
      err instanceof Error ? err.message : imageSizeErrorMessage()
    );
    return null;
  }
}
