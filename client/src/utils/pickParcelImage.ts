import { Alert } from "react-native";
import {
  assertImageBytesUnderLimit,
  imageSizeErrorMessage,
} from "@/utils/mediaLimits";

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

  const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!library.granted) {
    Alert.alert("Permission needed", "Allow photo access to attach a parcel photo.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.5,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  if (asset.fileSize != null) {
    try {
      assertImageBytesUnderLimit(asset.fileSize);
    } catch (err) {
      Alert.alert(
        "Image too large",
        err instanceof Error ? err.message : imageSizeErrorMessage()
      );
      return null;
    }
  }

  return asset.uri;
}
