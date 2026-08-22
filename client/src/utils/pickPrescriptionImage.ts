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

async function takeFromAsset(
  asset: { uri: string; fileSize?: number | null }
): Promise<string | null> {
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

export async function pickPrescriptionImage(): Promise<string | null> {
  if (!ImagePicker) {
    Alert.alert(
      "Feature unavailable",
      "Rebuild the app to enable photo upload:\ncd client && npx expo prebuild --clean && npm run android"
    );
    return null;
  }

  return new Promise((resolve) => {
    Alert.alert("Prescription photo", "Choose how to add your prescription.", [
      {
        text: "Take photo",
        onPress: async () => {
          const cam = await ImagePicker!.requestCameraPermissionsAsync();
          if (!cam.granted) {
            Alert.alert("Permission needed", "Allow camera access to photograph your prescription.");
            resolve(null);
            return;
          }
          const result = await ImagePicker!.launchCameraAsync({
            mediaTypes: ImagePicker!.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
          });
          if (result.canceled || !result.assets?.[0]) {
            resolve(null);
            return;
          }
          resolve(await takeFromAsset(result.assets[0]));
        },
      },
      {
        text: "Photo library",
        onPress: async () => {
          const library = await ImagePicker!.requestMediaLibraryPermissionsAsync();
          if (!library.granted) {
            Alert.alert("Permission needed", "Allow photo access to attach your prescription.");
            resolve(null);
            return;
          }
          const result = await ImagePicker!.launchImageLibraryAsync({
            mediaTypes: ImagePicker!.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
          });
          if (result.canceled || !result.assets?.[0]) {
            resolve(null);
            return;
          }
          resolve(await takeFromAsset(result.assets[0]));
        },
      },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}
