import {
  View,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect } from "react";
import CustomText from "@/components/shared/CustomText";
import CustomButton from "@/components/shared/CustomButton";
import { useRiderStore } from "@/store/riderStore";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import { updateDriverProfile } from "@/service/userService";
import { uploadMediaUri, resolveMediaUrl } from "@/service/mediaUpload";
import { pickProfileImage } from "@/utils/pickProfileImage";
import { pickDocumentImage } from "@/utils/pickPrescriptionImage";
import { formatActiveModeLabel, getEffectivePreferencesFromUser } from "@/utils/riderServiceSettings";
import {
  canCourierEditDocuments,
  canCourierEditVehicle,
  driverStatusLabel,
  driverStatusColors,
  getDriverAccountStatus,
  isDriverPendingApproval,
  vehicleCategoryLabel,
} from "@/utils/driverProfileAccess";

const isStoredMedia = (uri: string | null) =>
  !!uri && (uri.startsWith("http") || uri.startsWith("/"));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

type FieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  containerStyle?: StyleProp<ViewStyle>;
  icon?: keyof typeof Ionicons.glyphMap;
  hint?: string;
  error?: string | null;
};

/** Labelled input with an icon; highlights while focused. */
const Field = ({ label, icon, hint, error, containerStyle, ...input }: FieldProps) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, containerStyle]}>
      <View style={styles.labelRow}>
        <CustomText fontSize={12} color={DS.color.textMuted}>
          {label}
        </CustomText>
        {hint ? (
          <CustomText fontSize={11} color={DS.color.textSoft}>
            {hint}
          </CustomText>
        ) : null}
      </View>
      <View style={[styles.inputRow, focused && styles.inputRowFocused, !!error && styles.inputRowError]}>
        {icon ? <Ionicons name={icon} size={18} color={DS.color.textSoft} /> : null}
        <TextInput
          {...input}
          style={[styles.input, !icon && { marginLeft: 0 }]}
          placeholderTextColor={DS.color.textSoft}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
        />
      </View>
      {error ? (
        <CustomText fontSize={12} color={DS.color.danger} style={{ marginTop: 6 }}>
          {error}
        </CustomText>
      ) : null}
    </View>
  );
};

/** One line of a read-only list: label on the left, value on the right. */
const InfoRow = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View style={[styles.infoRow, !last && styles.rowDivider]}>
    <CustomText fontSize={14} color={DS.color.textMuted}>
      {label}
    </CustomText>
    <CustomText fontFamily="Medium" fontSize={14} color={value ? Colors.text : DS.color.textSoft}>
      {value || "—"}
    </CustomText>
  </View>
);

type DocState = "new" | "uploaded" | "missing" | "notOnFile";

const DOC_CHIP: Record<DocState, { label: string; bg: string; text: string }> = {
  new: { label: "Ready to send", bg: "#E0F2FE", text: "#0369A1" },
  uploaded: { label: "Uploaded", bg: "#DCFCE7", text: "#15803D" },
  missing: { label: "Needed", bg: "#FEF3C7", text: "#B45309" },
  // Approved riders can't add documents here, so a gap isn't something for them to fix.
  notOnFile: { label: "Not on file", bg: "#F1F5F9", text: "#64748B" },
};

const docState = (uri: string | null, editable: boolean): DocState =>
  uri && !isStoredMedia(uri) ? "new" : resolveMediaUrl(uri) ? "uploaded" : editable ? "missing" : "notOnFile";

/** A document line: icon, name, status chip. Tappable when the rider may still change it. */
const DocRow = ({
  label,
  icon,
  uri,
  onPress,
  last,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  uri: string | null;
  onPress?: () => void;
  last?: boolean;
}) => {
  const chip = DOC_CHIP[docState(uri, !!onPress)];
  const body = (
    <View style={[styles.docRow, !last && styles.rowDivider]}>
      <View style={styles.docIcon}>
        <Ionicons name={icon} size={18} color={Colors.primaryText} />
      </View>
      <CustomText fontFamily="Medium" fontSize={14} style={{ flex: 1 }}>
        {label}
      </CustomText>
      <View style={[styles.chip, { backgroundColor: chip.bg }]}>
        <CustomText fontFamily="SemiBold" fontSize={11} color={chip.text}>
          {chip.label}
        </CustomText>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={DS.color.textSoft} style={{ marginLeft: 6 }} /> : null}
    </View>
  );
  return onPress ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${label}: ${chip.label}`}>
      {body}
    </TouchableOpacity>
  ) : (
    body
  );
};

const SectionLabel = ({ children }: { children: string }) => (
  <CustomText fontFamily="SemiBold" fontSize={12} color={DS.color.textMuted} style={styles.sectionLabel}>
    {children}
  </CustomText>
);

const RiderProfile = () => {
  const { user, setUser } = useRiderStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Vehicle State
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");

  // Document State
  const [licenseFront, setLicenseFront] = useState<string | null>(null);
  const [licenseBack, setLicenseBack] = useState<string | null>(null);
  const [nationalId, setNationalId] = useState<string | null>(null);
  const [registrationDoc, setRegistrationDoc] = useState<string | null>(null);
  const [insuranceDoc, setInsuranceDoc] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const driverStatus = getDriverAccountStatus(user);
  const statusColors = driverStatusColors(driverStatus);
  const isOnboarding = isDriverPendingApproval(user);
  const canEditVehicle = canCourierEditVehicle(user);
  const canEditDocuments = canCourierEditDocuments(user);
  const vehicle = user?.driverDetails?.vehicle;
  const vehicleCategory = vehicle?.category;

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");

      if (user.driverDetails?.vehicle) {
        const v = user.driverDetails.vehicle;
        setVehicleMake(v.make || "");
        setVehicleModel(v.model || "");
        setVehicleYear(v.year?.toString() || "");
        setVehiclePlate(v.plateNumber || "");
        setVehicleColor(v.color || "");
      }

      if (user.driverDetails) {
        setLicenseFront(user.driverDetails.licenseFront || null);
        setLicenseBack(user.driverDetails.licenseBack || null);
        setNationalId(user.driverDetails.nationalId || null);
        setRegistrationDoc(user.driverDetails.vehicle?.registrationDoc || null);
        setInsuranceDoc(user.driverDetails.vehicle?.insuranceDoc || null);
        setProfileImage(user.driverDetails.profileImage || null);
      }
    }
  }, [user]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/rider/account"));

  const pickPhoto = async () => {
    const uri = await pickProfileImage();
    if (uri) setProfileImage(uri);
  };

  /** Documents keep their whole shape and stay readable (no square crop). */
  const pickDoc = (label: string, setter: (uri: string) => void) => async () => {
    const uri = await pickDocumentImage({
      title: label,
      message: "Take a clear photo where every word can be read.",
      cameraReason: `photograph your ${label.toLowerCase()}`,
      libraryReason: `attach your ${label.toLowerCase()}`,
    });
    if (uri) setter(uri);
  };

  const localPicked = [profileImage, licenseFront, licenseBack, nationalId, registrationDoc, insuranceDoc].some(
    (u) => !!u && !isStoredMedia(u)
  );
  const vehicleChanged =
    canEditVehicle &&
    (vehicleMake !== (vehicle?.make || "") ||
      vehicleModel !== (vehicle?.model || "") ||
      vehicleYear !== (vehicle?.year?.toString() || "") ||
      vehiclePlate !== (vehicle?.plateNumber || "") ||
      vehicleColor !== (vehicle?.color || ""));
  const dirty =
    localPicked ||
    vehicleChanged ||
    name.trim() !== (user?.name || "").trim() ||
    email.trim() !== (user?.email || "").trim();
  const emailInvalid = email.trim().length > 0 && !EMAIL_RE.test(email.trim());
  // While waiting for approval the rider can always (re)submit; afterwards only real changes are saved.
  const canSave = !!name.trim() && !emailInvalid && !loading && (isOnboarding || dirty);

  const handleSave = async () => {
    if (!canSave) return;
    if (!user?._id && !user?.id) {
      Alert.alert("Error", "User ID not found");
      return;
    }

    setLoading(true);
    try {
      const uploadIfLocal = async (uri: string | null, folder: string) => {
        if (!uri || isStoredMedia(uri)) return undefined;
        const { url } = await uploadMediaUri(uri, folder);
        return url;
      };

      const [
        profileImageUrl,
        licenseFrontUrl,
        licenseBackUrl,
        nationalIdUrl,
        registrationDocUrl,
        insuranceDocUrl,
      ] = await Promise.all([
        uploadIfLocal(profileImage, "drivers/profile"),
        canEditDocuments ? uploadIfLocal(licenseFront, "drivers/license") : Promise.resolve(undefined),
        canEditDocuments ? uploadIfLocal(licenseBack, "drivers/license") : Promise.resolve(undefined),
        canEditDocuments ? uploadIfLocal(nationalId, "drivers/documents") : Promise.resolve(undefined),
        canEditDocuments ? uploadIfLocal(registrationDoc, "drivers/vehicle") : Promise.resolve(undefined),
        canEditDocuments ? uploadIfLocal(insuranceDoc, "drivers/vehicle") : Promise.resolve(undefined),
      ]);

      const payload: Record<string, string> = { name: name.trim(), email: email.trim() };
      if (canEditVehicle) {
        payload.make = vehicleMake;
        payload.model = vehicleModel;
        payload.year = vehicleYear;
        payload.plateNumber = vehiclePlate;
        payload.color = vehicleColor;
      }
      if (profileImageUrl) payload.profileImageUrl = profileImageUrl;
      if (licenseFrontUrl) payload.licenseFrontUrl = licenseFrontUrl;
      if (licenseBackUrl) payload.licenseBackUrl = licenseBackUrl;
      if (nationalIdUrl) payload.nationalIdUrl = nationalIdUrl;
      if (registrationDocUrl) payload.registrationDocUrl = registrationDocUrl;
      if (insuranceDocUrl) payload.insuranceDocUrl = insuranceDocUrl;

      const updatedUser = await updateDriverProfile(user._id || user.id, payload);
      // The response is the driver record without the session token, so merge rather than replace.
      setUser({ ...user, ...updatedUser });

      Alert.alert(
        isOnboarding ? "Sent for review" : "Saved",
        isOnboarding ? "We'll check your details and let you know." : "Your profile is up to date."
      );
      goBack();
    } catch (error) {
      const msg = error instanceof Error && error.message ? error.message : "Failed to update profile";
      Alert.alert("Error", msg);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const photoChanged = !!profileImage && !isStoredMedia(profileImage);
  const avatarUri = photoChanged ? profileImage : resolveMediaUrl(profileImage);
  const initials = initialsOf(name || user?.name || "");
  const ratingCount = user?.totalRatings || 0;
  const vehicleSummary = [vehicleCategoryLabel(vehicleCategory), vehiclePlate].filter(Boolean).join(" · ");

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.topSafe} />

      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <CustomText fontFamily="SemiBold" fontSize={17}>
          {isOnboarding ? "Complete your profile" : "Profile"}
        </CustomText>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Who you are */}
          <View style={styles.hero}>
            <TouchableOpacity
              onPress={pickPhoto}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={avatarUri ? "Change profile photo" : "Add profile photo"}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  {initials ? (
                    <CustomText fontFamily="Bold" fontSize={34} color={Colors.primaryText}>
                      {initials}
                    </CustomText>
                  ) : (
                    <Ionicons name="person" size={44} color={Colors.primaryText} />
                  )}
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={16} color={Colors.text} />
              </View>
            </TouchableOpacity>
            <CustomText fontFamily="Medium" fontSize={12} color={DS.color.textMuted} style={{ marginTop: 8 }}>
              {photoChanged ? "New photo · saved when you tap the button below" : "Customers see this photo"}
            </CustomText>

            <CustomText fontFamily="Bold" fontSize={20} style={{ marginTop: 12 }} numberOfLines={1}>
              {name.trim() || "Your name"}
            </CustomText>
            {vehicleSummary ? (
              <CustomText fontSize={13} color={DS.color.textMuted} style={{ marginTop: 2 }}>
                {vehicleSummary}
              </CustomText>
            ) : null}

            <View style={styles.pillRow}>
              <View style={[styles.pill, { backgroundColor: statusColors.bg, borderColor: statusColors.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColors.text }]} />
                <CustomText fontFamily="SemiBold" fontSize={12} color={statusColors.text}>
                  {driverStatusLabel(driverStatus)}
                </CustomText>
              </View>
              {ratingCount > 0 && user?.averageRating ? (
                <View style={styles.pill}>
                  <Ionicons name="star" size={13} color="#F5B301" />
                  <CustomText fontFamily="SemiBold" fontSize={12} style={{ marginLeft: 4 }}>
                    {user.averageRating.toFixed(1)}
                  </CustomText>
                  <CustomText fontSize={12} color={DS.color.textMuted} style={{ marginLeft: 4 }}>
                    · {ratingCount} {ratingCount === 1 ? "trip rated" : "trips rated"}
                  </CustomText>
                </View>
              ) : null}
            </View>
          </View>

          {isOnboarding ? (
            <View style={styles.notice}>
              <Ionicons name="time-outline" size={18} color={Colors.primaryText} />
              <CustomText fontSize={13} color="#5c4a00" style={{ flex: 1, marginLeft: 10 }}>
                Add your vehicle and documents, then send them for review. An admin checks them and sets your vehicle
                type before you can go on duty.
              </CustomText>
            </View>
          ) : null}

          <SectionLabel>YOUR DETAILS</SectionLabel>
          <View style={styles.card}>
            <Field
              label="Full name"
              icon="person-outline"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Kwame Asante"
              autoCapitalize="words"
              textContentType="name"
            />
            <View style={styles.divider} />
            <Field
              label="Email"
              icon="mail-outline"
              hint="Optional · for receipts"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              error={emailInvalid ? "That email doesn't look right." : null}
            />
            <View style={styles.divider} />
            <View style={styles.field}>
              <CustomText fontSize={12} color={DS.color.textMuted} style={{ marginBottom: 6 }}>
                Phone number
              </CustomText>
              <View style={[styles.inputRow, styles.inputRowLocked]}>
                <Ionicons name="call-outline" size={18} color={DS.color.textSoft} />
                <CustomText fontSize={15} color={DS.color.textMuted} style={{ flex: 1, marginLeft: 10 }}>
                  {user?.phone}
                </CustomText>
                <Ionicons name="lock-closed" size={14} color={DS.color.textSoft} />
              </View>
              <CustomText fontSize={12} color={DS.color.textSoft} style={{ marginTop: 6 }}>
                You sign in with this number, so it can&apos;t be changed here.
              </CustomText>
            </View>
          </View>

          <TouchableOpacity style={[styles.card, styles.linkCard]} onPress={() => router.push("/rider/services")} activeOpacity={0.8}>
            <View style={styles.docIcon}>
              <Ionicons name="options-outline" size={18} color={Colors.primaryText} />
            </View>
            <View style={{ flex: 1 }}>
              <CustomText fontFamily="SemiBold" fontSize={14}>
                Work mode
              </CustomText>
              <CustomText fontSize={12} color={DS.color.textMuted} style={{ marginTop: 2 }}>
                {formatActiveModeLabel(getEffectivePreferencesFromUser(user))}
              </CustomText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={DS.color.textSoft} />
          </TouchableOpacity>

          <SectionLabel>VEHICLE</SectionLabel>
          {canEditVehicle ? (
            <View style={styles.card}>
              <View style={styles.twoCol}>
                <Field label="Make" value={vehicleMake} onChangeText={setVehicleMake} placeholder="Toyota" containerStyle={styles.col} />
                <Field label="Model" value={vehicleModel} onChangeText={setVehicleModel} placeholder="Vitz" containerStyle={styles.col} />
              </View>
              <View style={styles.twoCol}>
                <Field
                  label="Year"
                  value={vehicleYear}
                  onChangeText={(t) => setVehicleYear(t.replace(/\D/g, "").slice(0, 4))}
                  placeholder="2020"
                  keyboardType="number-pad"
                  containerStyle={styles.col}
                />
                <Field label="Colour" value={vehicleColor} onChangeText={setVehicleColor} placeholder="White" containerStyle={styles.col} />
              </View>
              <Field
                label="Plate number"
                icon="car-outline"
                value={vehiclePlate}
                onChangeText={setVehiclePlate}
                placeholder="GR 1234-24"
                autoCapitalize="characters"
              />
            </View>
          ) : (
            <View style={styles.card}>
              <InfoRow label="Vehicle type" value={vehicleCategoryLabel(vehicleCategory)} />
              <InfoRow label="Make & model" value={[vehicleMake, vehicleModel].filter(Boolean).join(" ")} />
              <InfoRow label="Year" value={vehicleYear} />
              <InfoRow label="Colour" value={vehicleColor} />
              <InfoRow label="Plate" value={vehiclePlate} last />
            </View>
          )}

          <SectionLabel>DOCUMENTS</SectionLabel>
          <View style={styles.card}>
            <DocRow
              label="Driver's licence (front)"
              icon="card-outline"
              uri={licenseFront}
              onPress={canEditDocuments ? pickDoc("Driver's licence (front)", setLicenseFront) : undefined}
            />
            <DocRow
              label="Driver's licence (back)"
              icon="card-outline"
              uri={licenseBack}
              onPress={canEditDocuments ? pickDoc("Driver's licence (back)", setLicenseBack) : undefined}
            />
            <DocRow
              label="Ghana Card"
              icon="id-card-outline"
              uri={nationalId}
              onPress={canEditDocuments ? pickDoc("Ghana Card", setNationalId) : undefined}
            />
            <DocRow
              label="Vehicle registration"
              icon="document-text-outline"
              uri={registrationDoc}
              onPress={canEditDocuments ? pickDoc("Vehicle registration", setRegistrationDoc) : undefined}
            />
            <DocRow
              label="Insurance"
              icon="shield-checkmark-outline"
              uri={insuranceDoc}
              onPress={canEditDocuments ? pickDoc("Insurance", setInsuranceDoc) : undefined}
              last={canEditDocuments}
            />
            {!canEditDocuments ? (
              <DocRow label="Police clearance" icon="ribbon-outline" uri={user?.driverDetails?.policeClearance ?? null} last />
            ) : null}
          </View>
          <View style={styles.footNote}>
            <Ionicons
              name={canEditDocuments ? "information-circle-outline" : "lock-closed-outline"}
              size={14}
              color={DS.color.textSoft}
            />
            <CustomText fontSize={12} color={DS.color.textSoft} style={{ flex: 1, marginLeft: 6 }}>
              {canEditDocuments
                ? "Tap a document to add or replace its photo. Police clearance is checked and added by QareGO."
                : "Your account is approved. Contact support if your vehicle or documents need to change."}
            </CustomText>
          </View>
        </ScrollView>

        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <CustomButton
            title={isOnboarding ? "Send for review" : dirty ? "Save changes" : "No changes"}
            onPress={handleSave}
            loading={loading}
            disabled={!canSave}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: DS.color.bg },
  topSafe: { backgroundColor: DS.color.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: DS.spacing.md,
    paddingVertical: DS.spacing.sm,
    backgroundColor: DS.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.border,
  },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  content: { padding: DS.spacing.lg, paddingBottom: 32 },
  hero: { alignItems: "center", marginBottom: DS.spacing.lg },
  avatar: { width: 108, height: 108, borderRadius: 54, backgroundColor: DS.color.border },
  avatarEmpty: {
    backgroundColor: "#FDF6C8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F6E88A",
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: DS.color.bg,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 12 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: DS.radius.pill,
    backgroundColor: DS.color.surface,
    borderWidth: 1,
    borderColor: DS.color.border,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEA",
    borderColor: "#F6E88A",
    borderWidth: 1,
    borderRadius: DS.radius.md,
    padding: DS.spacing.sm,
    marginBottom: DS.spacing.md,
  },
  sectionLabel: { letterSpacing: 0.6, marginBottom: 8, marginLeft: 4, marginTop: 6 },
  card: {
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.border,
    paddingHorizontal: DS.spacing.md,
    marginBottom: DS.spacing.md,
    ...DS.shadow.card,
  },
  linkCard: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  field: { paddingVertical: 12 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: DS.color.border,
    borderRadius: DS.radius.md,
    paddingHorizontal: 12,
    minHeight: 48,
    backgroundColor: DS.color.surface,
  },
  inputRowFocused: { borderColor: Colors.primaryText },
  inputRowError: { borderColor: DS.color.danger },
  inputRowLocked: { backgroundColor: DS.color.bg },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontFamily: "Regular",
    color: Colors.text,
    paddingVertical: 12,
  },
  twoCol: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: DS.color.border },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DS.color.border },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  docRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  docIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FDF6C8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: DS.radius.pill },
  footNote: { flexDirection: "row", alignItems: "flex-start", marginTop: -4, marginHorizontal: 4 },
  footer: {
    backgroundColor: DS.color.surface,
    paddingHorizontal: DS.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DS.color.border,
  },
});

export default RiderProfile;
