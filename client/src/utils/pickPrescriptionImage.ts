import { Alert, Platform } from "react-native";
import { imageSizeErrorMessage } from "@/utils/mediaLimits";
import { SHRINK_MAX_EDGE, shrinkPickedImage } from "@/utils/shrinkImage";

let ImagePicker: typeof import("expo-image-picker") | null = null;
try {
  ImagePicker = require("expo-image-picker");
} catch {
  /* native rebuild required */
}

async function takeFromAsset(asset: {
  uri: string;
  width?: number;
  height?: number;
  fileSize?: number | null;
}): Promise<string | null> {
  try {
    return await shrinkPickedImage(asset, SHRINK_MAX_EDGE.document);
  } catch (err) {
    Alert.alert(
      "Image too large",
      err instanceof Error ? err.message : imageSizeErrorMessage()
    );
    return null;
  }
}

type DocumentPickCopy = {
  title: string;
  message: string;
  /** e.g. "photograph your prescription" */
  cameraReason: string;
  /** e.g. "attach your prescription" */
  libraryReason: string;
};

/**
 * Photo of a document (prescription, licence, ID…): camera or library, any shape, kept readable.
 */
export async function pickDocumentImage(copy: DocumentPickCopy): Promise<string | null> {
  if (!ImagePicker) {
    Alert.alert(
      "Feature unavailable",
      "Rebuild the app to enable photo upload:\ncd client && npx expo prebuild --clean && npm run android"
    );
    return null;
  }

  return new Promise((resolve) => {
    Alert.alert(copy.title, copy.message, [
      {
        text: "Take photo",
        onPress: async () => {
          const cam = await ImagePicker!.requestCameraPermissionsAsync();
          if (!cam.granted) {
            Alert.alert("Permission needed", `Allow camera access to ${copy.cameraReason}.`);
            resolve(null);
            return;
          }
          const result = await ImagePicker!.launchCameraAsync({
            mediaTypes: ImagePicker!.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
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
          if (Platform.OS === "ios") {
            const library = await ImagePicker!.requestMediaLibraryPermissionsAsync();
            if (!library.granted) {
              Alert.alert("Permission needed", `Allow photo access to ${copy.libraryReason}.`);
              resolve(null);
              return;
            }
          }
          const result = await ImagePicker!.launchImageLibraryAsync({
            mediaTypes: ImagePicker!.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
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

export function pickPrescriptionImage(): Promise<string | null> {
  return pickDocumentImage({
    title: "Prescription photo",
    message: "Choose how to add your prescription.",
    cameraReason: "photograph your prescription",
    libraryReason: "attach your prescription",
  });
}
