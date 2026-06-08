import { View, SafeAreaView, StyleSheet, TextInput, Alert, TouchableOpacity, ScrollView, Image } from "react-native";
import React, { useState, useEffect } from "react";
import { commonStyles } from "@/styles/commonStyles";
import CustomText from "@/components/shared/CustomText";
import CustomButton from "@/components/shared/CustomButton";
import { useUserStore } from "@/store/userStore";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/utils/Constants";
import { updateUserProfile } from "@/service/userService";
import { uploadMediaUri, resolveMediaUrl } from "@/service/mediaUpload";
import { pickProfileImage } from "@/utils/pickProfileImage";

const isStoredMedia = (uri: string | null) =>
  !!uri && (uri.startsWith("http") || uri.startsWith("/"));

const CustomerProfile = () => {
  const { user, setUser } = useUserStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setProfileImage((user as { profileImage?: string }).profileImage || null);
    }
  }, [user]);

  const pickImage = async () => {
    const uri = await pickProfileImage();
    if (uri) setProfileImage(uri);
  };

  const handleSave = async () => {
    if (!user?._id && !user?.id) {
      Alert.alert("Error", "User ID not found");
      return;
    }
    
    if (!name.trim()) {
      Alert.alert("Please enter your full name");
      return;
    }
    
    setLoading(true);
    try {
      let profileImageUrl: string | undefined;
      if (profileImage && !isStoredMedia(profileImage)) {
        profileImageUrl = (await uploadMediaUri(profileImage, "customers/profile")).url;
      }
      const payload: Record<string, string | undefined> = {
        name: name.trim(),
        email: email.trim() ? email.trim() : undefined,
      };
      if (profileImageUrl) payload.profileImageUrl = profileImageUrl;
      const updatedUser = await updateUserProfile(user._id || user.id, payload);
      setUser(updatedUser);
      Alert.alert("Success", "Profile updated successfully");
      if (router.canGoBack()) router.back();
      else router.replace("/customer/account");
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

  const isProfileIncomplete = !user?.name;

  return (
    <View style={commonStyles.container}>
      <SafeAreaView style={{ backgroundColor: '#fff' }} />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/customer/account"))}
          style={styles.backButton}
        >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <CustomText variant="h5" fontFamily="SemiBold">Personal Info</CustomText>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Incomplete Profile Notice */}
        {isProfileIncomplete && (
          <View style={styles.noticeContainer}>
            <Ionicons name="alert-circle" size={20} color={Colors.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <CustomText fontFamily="SemiBold" fontSize={14} style={{ marginBottom: 2 }}>
                Complete Your Profile
              </CustomText>
              <CustomText fontSize={12} color="#666">
                Please fill in your name and email below
              </CustomText>
            </View>
          </View>
        )}
        <View style={styles.inputGroup}>
            <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>Profile Photo</CustomText>
            <TouchableOpacity onPress={pickImage} style={styles.uploadButton}>
              {profileImage && !isStoredMedia(profileImage) ? (
                <CustomText color={Colors.primary}>New photo selected</CustomText>
              ) : resolveMediaUrl(profileImage) ? (
                <Image source={{ uri: resolveMediaUrl(profileImage)! }} style={styles.previewImage} />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
                  <CustomText style={{ marginLeft: 10 }} color={Colors.primary}>Upload Photo</CustomText>
                </View>
              )}
            </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
            <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>Full Name</CustomText>
            <TextInput 
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="#999"
            />
        </View>

        <View style={styles.inputGroup}>
            <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>Email Address</CustomText>
            <TextInput 
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
            />
        </View>

        <View style={styles.inputGroup}>
            <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>Phone Number</CustomText>
            <View style={[styles.input, { backgroundColor: '#f5f5f5' }]}>
                <CustomText color="#888">{user?.phone}</CustomText>
            </View>
            <CustomText fontSize={12} color="#999" style={{ marginTop: 5 }}>Phone number cannot be changed</CustomText>
        </View>

        {/* Rating Display */}
        {user?.averageRating && (
          <View style={styles.ratingContainer}>
            <CustomText fontSize={14} color="#666" style={{ marginBottom: 10 }}>Your Rating</CustomText>
            <View style={styles.ratingCard}>
              <View style={styles.ratingStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= Math.round(user.averageRating) ? "star" : "star-outline"}
                    size={24}
                    color="#FFD700"
                  />
                ))}
              </View>
              <CustomText fontFamily="Bold" fontSize={20} style={{ marginTop: 8 }}>
                {user.averageRating.toFixed(1)}
              </CustomText>
              <CustomText fontSize={12} color="#666" style={{ marginTop: 4 }}>
                {user.totalRatings || 0} {user.totalRatings === 1 ? 'rating' : 'ratings'}
              </CustomText>
            </View>
          </View>
        )}

        <View style={{ marginTop: 40 }}>
            <CustomButton 
                title="Save Changes"
                onPress={handleSave}
                loading={loading}
                disabled={loading || !name.trim()}
            />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0'
    },
    backButton: {
        marginRight: 15
    },
    content: {
        padding: 20
    },
    inputGroup: {
        marginBottom: 20
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        fontFamily: 'Regular',
        color: Colors.text,
        backgroundColor: '#fff'
    },
    noticeContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff9e6',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ffe082',
        alignItems: 'center',
        marginBottom: 20
    },
    ratingContainer: {
        marginBottom: 20
    },
    ratingCard: {
        backgroundColor: '#f9f9f9',
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee'
    },
    ratingStars: {
        flexDirection: 'row',
        gap: 4
    },
    uploadButton: {
        borderWidth: 1,
        borderColor: Colors.primary,
        borderStyle: "dashed",
        borderRadius: 8,
        padding: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8faff",
    },
    previewImage: {
        width: 96,
        height: 96,
        borderRadius: 48,
    },
});

export default CustomerProfile;
