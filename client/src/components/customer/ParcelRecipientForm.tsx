import React, { FC } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { ParcelTheme as P } from "@/styles/parcelTheme";
import { resolveMediaUrl } from "@/service/mediaUpload";
import { parcelModeLabels, type ParcelMode } from "@/utils/parcelMode";

type Props = {
  mode?: ParcelMode;
  recipientName: string;
  recipientPhone: string;
  parcelDescription: string;
  deliveryNote: string;
  parcelPhotoUri: string | null;
  parcelPhotoUrl: string | null;
  uploadingPhoto: boolean;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onChangeNote: (v: string) => void;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
};

const ParcelRecipientForm: FC<Props> = ({
  mode = "SEND",
  recipientName,
  recipientPhone,
  parcelDescription,
  deliveryNote,
  parcelPhotoUri,
  parcelPhotoUrl,
  uploadingPhoto,
  onChangeName,
  onChangePhone,
  onChangeDescription,
  onChangeNote,
  onPickPhoto,
  onRemovePhoto,
}) => {
  const labels = parcelModeLabels(mode);
  const previewUri =
    parcelPhotoUri || (parcelPhotoUrl ? resolveMediaUrl(parcelPhotoUrl) : null);

  return (
    <View style={styles.card}>
      <View style={styles.sectionHead}>
        <View style={styles.iconWrap}>
          <Ionicons name="camera-outline" size={18} color={P.accent} />
        </View>
        <View style={styles.headText}>
          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.title}>
            Package photo
          </CustomText>
          <CustomText fontSize={12} style={styles.subtitle}>
            {labels.photoHint}
          </CustomText>
        </View>
      </View>

      {previewUri ? (
        <View style={styles.photoPreviewWrap}>
          <Image source={{ uri: previewUri }} style={styles.photoPreview} />
          <TouchableOpacity style={styles.removePhotoBtn} onPress={onRemovePhoto}>
            <Ionicons name="close-circle" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.photoPicker}
          onPress={onPickPhoto}
          disabled={uploadingPhoto}
          activeOpacity={0.85}
        >
          {uploadingPhoto ? (
            <ActivityIndicator color={P.accent} />
          ) : (
            <>
              <Ionicons name="image-outline" size={28} color={P.accent} />
              <CustomText fontFamily="Medium" fontSize={14} style={styles.photoPickerText}>
                Add parcel photo
              </CustomText>
              <CustomText fontSize={12} style={styles.photoPickerHint}>
                Optional · JPG or PNG
              </CustomText>
            </>
          )}
        </TouchableOpacity>
      )}

      {previewUri && !uploadingPhoto ? (
        <TouchableOpacity style={styles.changePhotoBtn} onPress={onPickPhoto}>
          <CustomText fontFamily="Medium" fontSize={13} style={{ color: P.accent }}>
            Change photo
          </CustomText>
        </TouchableOpacity>
      ) : null}

      <View style={[styles.sectionHead, styles.sectionHeadSpaced]}>
        <View style={styles.iconWrap}>
          <Ionicons name="person-outline" size={18} color={P.accent} />
        </View>
        <View style={styles.headText}>
          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.title}>
            {labels.recipientSection}
          </CustomText>
          <CustomText fontSize={12} style={styles.subtitle}>
            {labels.recipientHint}
          </CustomText>
        </View>
      </View>

      <TextInput
        style={styles.input}
        placeholder={labels.recipientNamePlaceholder}
        placeholderTextColor={T.inkSoft}
        value={recipientName}
        onChangeText={onChangeName}
      />
      <TextInput
        style={styles.input}
        placeholder={labels.recipientPhonePlaceholder}
        placeholderTextColor={T.inkSoft}
        value={recipientPhone}
        onChangeText={onChangePhone}
        keyboardType="phone-pad"
      />

      <View style={[styles.sectionHead, styles.sectionHeadSpaced]}>
        <View style={styles.iconWrap}>
          <Ionicons name="cube-outline" size={18} color={P.accent} />
        </View>
        <View style={styles.headText}>
          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.title}>
            Package details
          </CustomText>
          <CustomText fontSize={12} style={styles.subtitle}>
            Optional — helps the courier prepare
          </CustomText>
        </View>
      </View>

      <TextInput
        style={styles.input}
        placeholder="What are you sending? e.g. documents, electronics"
        placeholderTextColor={T.inkSoft}
        value={parcelDescription}
        onChangeText={onChangeDescription}
      />
      <TextInput
        style={[styles.input, styles.inputLast]}
        placeholder="Note for courier (gate code, landmark, etc.)"
        placeholderTextColor={T.inkSoft}
        value={deliveryNote}
        onChangeText={onChangeNote}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: P.accentSoft,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    marginBottom: 24,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  sectionHeadSpaced: {
    marginTop: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { flex: 1 },
  title: { color: T.ink },
  subtitle: { color: T.inkMuted, marginTop: 2 },
  photoPicker: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#DDD6FE",
    borderStyle: "dashed",
    paddingVertical: 24,
    marginBottom: 8,
  },
  photoPickerText: {
    color: P.ink,
    marginTop: 8,
  },
  photoPickerHint: {
    color: T.inkMuted,
    marginTop: 4,
  },
  photoPreviewWrap: {
    position: "relative",
    marginBottom: 8,
  },
  photoPreview: {
    width: "100%",
    height: 160,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
  },
  removePhotoBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(15,23,42,0.55)",
    borderRadius: 20,
  },
  changePhotoBtn: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingVertical: 4,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: T.ink,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.border,
  },
  inputLast: { marginBottom: 0 },
});

export default ParcelRecipientForm;
