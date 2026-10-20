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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect } from "react";
import CustomText from "@/components/shared/CustomText";
import CustomButton from "@/components/shared/CustomButton";
import { useUserStore } from "@/store/userStore";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import { updateUserProfile } from "@/service/userService";
import { uploadMediaUri, resolveMediaUrl } from "@/service/mediaUpload";
import { pickProfileImage } from "@/utils/pickProfileImage";

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

const CustomerProfile = () => {
  const { user, setUser } = useUserStore();
  const savedImage = (user as { profileImage?: string } | null)?.profileImage || null;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<"name" | "email" | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setProfileImage(savedImage);
    }
  }, [user, savedImage]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/customer/account"));

  const pickImage = async () => {
    const uri = await pickProfileImage();
    if (uri) setProfileImage(uri);
  };

  const photoChanged = !!profileImage && !isStoredMedia(profileImage);
  const dirty =
    photoChanged || name.trim() !== (user?.name || "").trim() || email.trim() !== (user?.email || "").trim();
  const emailInvalid = email.trim().length > 0 && !EMAIL_RE.test(email.trim());
  const canSave = dirty && !!name.trim() && !emailInvalid && !loading;

  const handleSave = async () => {
    if (!canSave) return;
    if (!user?._id && !user?.id) {
      Alert.alert("Error", "User ID not found");
      return;
    }

    setLoading(true);
    try {
      let profileImageUrl: string | undefined;
      if (photoChanged) {
        profileImageUrl = (await uploadMediaUri(profileImage!, "customers/profile")).url;
      }
      const payload: Record<string, string | undefined> = {
        name: name.trim(),
        email: email.trim() ? email.trim() : undefined,
      };
      if (profileImageUrl) payload.profileImageUrl = profileImageUrl;
      const updatedUser = await updateUserProfile(user._id || user.id, payload);
      setUser(updatedUser);
      Alert.alert("Saved", "Your details are up to date.");
      goBack();
    } catch (error: unknown) {
      const axiosMsg = (error as { response?: { data?: { msg?: string; message?: string } } })
        ?.response?.data;
      const msg =
        axiosMsg?.msg ||
        axiosMsg?.message ||
        (error instanceof Error ? error.message : null) ||
        "Failed to update profile";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  // A freshly picked photo is a local file; a saved one needs the server URL.
  const avatarUri = photoChanged ? profileImage : resolveMediaUrl(profileImage);
  const initials = initialsOf(name || user?.name || "");
  const ratingCount = user?.totalRatings || 0;

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.topSafe} />

      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <CustomText fontFamily="SemiBold" fontSize={17}>
          Personal info
        </CustomText>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <TouchableOpacity
              onPress={pickImage}
              activeOpacity={0.85}
              style={styles.avatarWrap}
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
            <TouchableOpacity onPress={pickImage} hitSlop={8}>
              <CustomText fontFamily="Medium" fontSize={13} color={Colors.primaryText} style={{ marginTop: 10 }}>
                {photoChanged ? "New photo · tap to change" : avatarUri ? "Change photo" : "Add a photo"}
              </CustomText>
            </TouchableOpacity>

            <CustomText fontFamily="Bold" fontSize={20} style={{ marginTop: 14 }} numberOfLines={1}>
              {name.trim() || "Your name"}
            </CustomText>
            {ratingCount > 0 && user?.averageRating ? (
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={13} color="#F5B301" />
                <CustomText fontFamily="SemiBold" fontSize={12} style={{ marginLeft: 4 }}>
                  {user.averageRating.toFixed(1)}
                </CustomText>
                <CustomText fontSize={12} color={DS.color.textMuted} style={{ marginLeft: 4 }}>
                  · {ratingCount} {ratingCount === 1 ? "rating" : "ratings"} from riders
                </CustomText>
              </View>
            ) : null}
          </View>

          {!user?.name ? (
            <View style={styles.notice}>
              <Ionicons name="sparkles-outline" size={18} color={Colors.primaryText} />
              <CustomText fontSize={13} color="#5c4a00" style={{ flex: 1, marginLeft: 10 }}>
                Add your name so riders and stores know who they&apos;re serving.
              </CustomText>
            </View>
          ) : null}

          <CustomText fontFamily="SemiBold" fontSize={12} color={DS.color.textMuted} style={styles.sectionLabel}>
            YOUR DETAILS
          </CustomText>
          <View style={styles.card}>
            <View style={styles.field}>
              <CustomText fontSize={12} color={DS.color.textMuted} style={styles.fieldLabel}>
                Full name
              </CustomText>
              <View style={[styles.inputRow, focused === "name" && styles.inputRowFocused]}>
                <Ionicons name="person-outline" size={18} color={DS.color.textSoft} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocused("name")}
                  onBlur={() => setFocused(null)}
                  placeholder="e.g. Akosua Mensah"
                  placeholderTextColor={DS.color.textSoft}
                  autoCapitalize="words"
                  textContentType="name"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.field}>
              <View style={styles.labelRow}>
                <CustomText fontSize={12} color={DS.color.textMuted} style={styles.fieldLabel}>
                  Email
                </CustomText>
                <CustomText fontSize={11} color={DS.color.textSoft}>
                  Optional · for receipts
                </CustomText>
              </View>
              <View
                style={[
                  styles.inputRow,
                  focused === "email" && styles.inputRowFocused,
                  emailInvalid && styles.inputRowError,
                ]}
              >
                <Ionicons name="mail-outline" size={18} color={DS.color.textSoft} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  placeholder="you@example.com"
                  placeholderTextColor={DS.color.textSoft}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>
              {emailInvalid ? (
                <CustomText fontSize={12} color={DS.color.danger} style={{ marginTop: 6 }}>
                  That email doesn&apos;t look right.
                </CustomText>
              ) : null}
            </View>

            <View style={styles.divider} />

            <View style={styles.field}>
              <CustomText fontSize={12} color={DS.color.textMuted} style={styles.fieldLabel}>
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
        </ScrollView>

        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          <CustomButton
            title={dirty ? "Save changes" : "No changes"}
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
  avatarWrap: { position: "relative" },
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
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: DS.radius.pill,
    backgroundColor: DS.color.surface,
    borderWidth: 1,
    borderColor: DS.color.border,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEA",
    borderColor: "#F6E88A",
    borderWidth: 1,
    borderRadius: DS.radius.md,
    padding: DS.spacing.sm,
    marginBottom: DS.spacing.md,
  },
  sectionLabel: { letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  card: {
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.border,
    paddingHorizontal: DS.spacing.md,
    ...DS.shadow.card,
  },
  field: { paddingVertical: 14 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldLabel: { marginBottom: 6 },
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
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: DS.color.border },
  footer: {
    backgroundColor: DS.color.surface,
    paddingHorizontal: DS.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DS.color.border,
  },
});

export default CustomerProfile;
