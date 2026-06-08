import { View, SafeAreaView, StyleSheet, TextInput, Alert, TouchableOpacity, ScrollView, Image } from "react-native";
import React, { useState, useEffect } from "react";
import { commonStyles } from "@/styles/commonStyles";
import CustomText from "@/components/shared/CustomText";
import CustomButton from "@/components/shared/CustomButton";
import { useRiderStore } from "@/store/riderStore";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/utils/Constants";
import { updateDriverProfile } from "@/service/userService";
import { uploadMediaUri, resolveMediaUrl } from "@/service/mediaUpload";
import { pickProfileImage } from "@/utils/pickProfileImage";
import { formatActiveModeLabel, getEffectivePreferencesFromUser } from "@/utils/riderServiceSettings";

const isStoredMedia = (uri: string | null) =>
  !!uri && (uri.startsWith("http") || uri.startsWith("/"));

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
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

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
        setProfileImage(user.driverDetails.profileImage || null);
      }
    }
  }, [user]);

  const pickImage = async (setter: (uri: string) => void) => {
    const uri = await pickProfileImage();
    if (uri) setter(uri);
  };

  const handleSave = async () => {
    if (!user?._id && !user?.id) {
      Alert.alert("Error", "User ID not found");
      return;
    }
    
    if (!name || !email) {
      Alert.alert("Please fill all fields");
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
      ] = await Promise.all([
        uploadIfLocal(profileImage, "drivers/profile"),
        uploadIfLocal(licenseFront, "drivers/license"),
        uploadIfLocal(licenseBack, "drivers/license"),
        uploadIfLocal(nationalId, "drivers/documents"),
      ]);

      const payload: Record<string, string> = {
        name,
        email,
        make: vehicleMake,
        model: vehicleModel,
        year: vehicleYear,
        plateNumber: vehiclePlate,
        color: vehicleColor,
      };
      if (profileImageUrl) payload.profileImageUrl = profileImageUrl;
      if (licenseFrontUrl) payload.licenseFrontUrl = licenseFrontUrl;
      if (licenseBackUrl) payload.licenseBackUrl = licenseBackUrl;
      if (nationalIdUrl) payload.nationalIdUrl = nationalIdUrl;

      const updatedUser = await updateDriverProfile(user._id || user.id, payload);
      // The updateDriverProfile returns the driver object which should be compatible with user store
      // But verify structure. Backend returns { driver: ... }. Service returns res.data.driver.
      // So updatedUser is the driver object.
      // We need to make sure we update the store correctly.
      // useRiderStore 'setUser' expects 'user' object.
      // Driver object has { id, name, phone, driverDetails, ... }
      // It might be missing 'token' etc if we replace the whole user object?
      // No, usually we merge or the store handles it.
      // But useRiderStore.setUser(user) replaces the user.
      // The returned driver object might not have everything (like token).
      // So better merge with existing user.
      setUser({ ...user, ...updatedUser });
      
      Alert.alert("Success", "Profile updated successfully");
      if (router.canGoBack()) router.back();
      else router.replace("/rider/account");
    } catch (error) {
      const msg =
        error instanceof Error && error.message
          ? error.message
          : "Failed to update profile";
      Alert.alert("Error", msg);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isProfileIncomplete = !user?.name || !user?.email;

  return (
    <View style={commonStyles.container}>
      <SafeAreaView style={{ backgroundColor: '#fff' }} />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/rider/account"))}
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
        
        <CustomText fontSize={16} fontFamily="SemiBold" style={{ marginTop: 10, marginBottom: 15 }}>Basic Details</CustomText>
        
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

        <TouchableOpacity
          style={styles.workModeLink}
          onPress={() => router.push("/rider/services")}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <CustomText fontFamily="SemiBold" fontSize={15}>
              Work mode
            </CustomText>
            <CustomText fontSize={12} color="#666" style={{ marginTop: 4 }}>
              {formatActiveModeLabel(getEffectivePreferencesFromUser(user))}
            </CustomText>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <View style={styles.divider} />
        
        <CustomText fontSize={16} fontFamily="SemiBold" style={{ marginTop: 10, marginBottom: 15 }}>Vehicle Details</CustomText>

        <View style={commonStyles.flexRowBetween}>
            <View style={[styles.inputGroup, { width: '48%' }]}>
                <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>Make</CustomText>
                <TextInput 
                    style={styles.input}
                    value={vehicleMake}
                    onChangeText={setVehicleMake}
                    placeholder="Toyota"
                    placeholderTextColor="#999"
                />
            </View>
            <View style={[styles.inputGroup, { width: '48%' }]}>
                <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>Model</CustomText>
                <TextInput 
                    style={styles.input}
                    value={vehicleModel}
                    onChangeText={setVehicleModel}
                    placeholder="Prius"
                    placeholderTextColor="#999"
                />
            </View>
        </View>

        <View style={commonStyles.flexRowBetween}>
            <View style={[styles.inputGroup, { width: '48%' }]}>
                <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>Year</CustomText>
                <TextInput 
                    style={styles.input}
                    value={vehicleYear}
                    onChangeText={setVehicleYear}
                    placeholder="2020"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                />
            </View>
             <View style={[styles.inputGroup, { width: '48%' }]}>
                <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>Color</CustomText>
                <TextInput 
                    style={styles.input}
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                    placeholder="White"
                    placeholderTextColor="#999"
                />
            </View>
        </View>

        <View style={styles.inputGroup}>
            <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>Plate Number</CustomText>
            <TextInput 
                style={styles.input}
                value={vehiclePlate}
                onChangeText={setVehiclePlate}
                placeholder="KBA 123A"
                placeholderTextColor="#999"
                autoCapitalize="characters"
            />
        </View>

        <View style={styles.divider} />
        
        <CustomText fontSize={16} fontFamily="SemiBold" style={{ marginTop: 10, marginBottom: 15 }}>Documents</CustomText>

        <View style={styles.inputGroup}>
            <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>Profile Photo</CustomText>
            <TouchableOpacity onPress={() => pickImage(setProfileImage)} style={styles.uploadButton}>
                {profileImage && !isStoredMedia(profileImage) ? (
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Ionicons name="checkmark-circle" size={20} color="green" />
                        <CustomText style={{marginLeft: 10}}>New photo selected</CustomText>
                    </View>
                ) : resolveMediaUrl(profileImage) ? (
                    <Image source={{ uri: resolveMediaUrl(profileImage)! }} style={styles.previewImage} />
                ) : (
                     <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
                        <CustomText style={{marginLeft: 10}} color={Colors.primary}>Upload Photo</CustomText>
                     </View>
                )}
            </TouchableOpacity>
        </View>

        <View style={commonStyles.flexRowBetween}>
             <View style={[styles.inputGroup, { width: '48%' }]}>
                <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>License Front</CustomText>
                <TouchableOpacity onPress={() => pickImage(setLicenseFront)} style={styles.uploadButton}>
                    <CustomText color={Colors.primary}>{licenseFront && !isStoredMedia(licenseFront) ? "Changed" : (licenseFront ? "Update" : "Upload")}</CustomText>
                </TouchableOpacity>
            </View>
            <View style={[styles.inputGroup, { width: '48%' }]}>
                <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>License Back</CustomText>
                 <TouchableOpacity onPress={() => pickImage(setLicenseBack)} style={styles.uploadButton}>
                    <CustomText color={Colors.primary}>{licenseBack && !isStoredMedia(licenseBack) ? "Changed" : (licenseBack ? "Update" : "Upload")}</CustomText>
                </TouchableOpacity>
            </View>
        </View>
        
        <View style={styles.inputGroup}>
            <CustomText fontSize={14} color="#666" style={{ marginBottom: 5 }}>National ID</CustomText>
             <TouchableOpacity onPress={() => pickImage(setNationalId)} style={styles.uploadButton}>
                 <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Ionicons name="card-outline" size={20} color={Colors.primary} />
                    <CustomText style={{marginLeft: 10}} color={Colors.primary}>{nationalId && !isStoredMedia(nationalId) ? "Image Selected" : (nationalId ? "Change ID" : "Upload ID")}</CustomText>
                 </View>
            </TouchableOpacity>
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
                disabled={loading}
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
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 10,
    },
    workModeLink: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        marginBottom: 8,
        backgroundColor: '#fafafa',
    },
    uploadButton: {
        borderWidth: 1,
        borderColor: Colors.primary,
        borderStyle: 'dashed',
        borderRadius: 8,
        padding: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8faff'
    },
    previewImage: {
        width: 96,
        height: 96,
        borderRadius: 48,
    },
});

export default RiderProfile;
