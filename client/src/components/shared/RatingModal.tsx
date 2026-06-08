import React, { FC, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Colors } from "@/utils/Constants";
import CustomText from "./CustomText";
import { RFValue } from "react-native-responsive-fontsize";
import { Ionicons } from "@expo/vector-icons";
import CustomButton from "./CustomButton";
import { appAxios } from "@/service/apiInterceptors";
import { router } from "expo-router";

interface RatingModalProps {
  visible: boolean;
  rideId: string;
  role: "customer" | "rider";
  onClose: () => void;
  onSuccess: () => void;
}

// Pre-defined tags for quick selection
const RATING_TAGS = {
  customer: [
    "Clean car",
    "Safe driver",
    "Great conversation",
    "On time",
    "Professional",
    "Friendly",
  ],
  rider: [
    "Punctual",
    "Polite",
    "Easy to find",
    "Respectful",
    "Clear instructions",
    "Good communication",
  ],
};

const NEGATIVE_TAGS = {
  customer: [
    "Rude behavior",
    "Unsafe driving",
    "Late arrival",
    "Dirty vehicle",
    "Poor navigation",
  ],
  rider: [
    "Late pickup",
    "Unclear location",
    "Rude behavior",
    "No show",
    "Poor communication",
  ],
};

const RatingModal: FC<RatingModalProps> = ({
  visible,
  rideId,
  role,
  onClose,
  onSuccess,
}) => {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setRating(0);
      setReview("");
      setSelectedTags([]);
    }
  }, [visible]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleRating = async () => {
    if (rating === 0) {
      Alert.alert("Please select a rating");
      return;
    }

    // Mandatory feedback for low ratings (< 3 stars)
    if (rating < 3 && !review.trim() && selectedTags.length === 0) {
      Alert.alert(
        "Feedback Required",
        "Please provide feedback or select tags to help improve the service."
      );
      return;
    }

    setLoading(true);
    try {
      // Combine tags into review if no review text is provided
      const finalReview = review.trim() || selectedTags.join(", ");
      
      await appAxios.post(`/ride/${rideId}/rate`, {
        rating,
        review: finalReview,
      });
      onSuccess();
    } catch (error: any) {
      console.log("Error submitting rating:", error);
      Alert.alert("Error", error?.response?.data?.msg || "Failed to submit rating");
    } finally {
      setLoading(false);
    }
  };

  const requiresFeedback = rating > 0 && rating < 3;
  const tagsToShow = rating >= 3 ? RATING_TAGS[role] : NEGATIVE_TAGS[role];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <CustomText fontFamily="Bold" style={styles.title}>
                Rate your driver
              </CustomText>
            </View>

            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={40}
                    color={Colors.primary}
                    style={styles.star}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Pre-defined Tags */}
            {rating > 0 && tagsToShow && (
              <View style={styles.tagsContainer}>
                <CustomText fontFamily="Medium" style={styles.label}>
                  {rating >= 3 ? "What went well?" : "What could be improved?"}
                </CustomText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tagsScroll}
                >
                  {tagsToShow.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      style={[
                        styles.tag,
                        selectedTags.includes(tag) && styles.tagSelected,
                      ]}
                    >
                      <CustomText
                        fontSize={11}
                        style={{
                          color: selectedTags.includes(tag) ? "#fff" : Colors.text,
                        }}
                      >
                        {tag}
                      </CustomText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.reviewContainer}>
              <CustomText fontFamily="Medium" style={styles.label}>
                {requiresFeedback ? "Additional feedback (required)" : "How was your ride?"}
              </CustomText>
              <TextInput
                style={styles.input}
                placeholder={
                  requiresFeedback
                    ? "Please provide feedback..."
                    : "Write a review (optional)"
                }
                multiline
                numberOfLines={3}
                value={review}
                onChangeText={setReview}
                textAlignVertical="top"
              />
              {requiresFeedback && (
                <CustomText fontSize={10} color="#ff6b6b" style={{ marginTop: 4 }}>
                  * Feedback is required for ratings below 3 stars
                </CustomText>
              )}
            </View>

            <View style={styles.buttonContainer}>
              <CustomButton
                title="Submit Rating"
                onPress={handleRating}
                loading={loading}
                disabled={loading}
              />
              {!requiresFeedback && (
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={onSuccess}
                  disabled={loading}
                >
                  <CustomText style={styles.skipText}>Skip</CustomText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardView: {
    width: "100%",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: RFValue(18),
    textAlign: "center",
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  star: {
    marginHorizontal: 5,
  },
  reviewContainer: {
    width: "100%",
    marginBottom: 20,
  },
  label: {
    fontSize: RFValue(12),
    marginBottom: 8,
    color: "#666",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 10,
    height: 100,
    backgroundColor: "#f9f9f9",
    fontFamily: "Regular",
  },
  buttonContainer: {
    width: "100%",
    gap: 10,
  },
  skipButton: {
    padding: 10,
    alignItems: "center",
  },
  skipText: {
    color: "#666",
    fontFamily: "Medium",
    fontSize: RFValue(12),
  },
  tagsContainer: {
    width: "100%",
    marginBottom: 15,
  },
  tagsScroll: {
    gap: 8,
    paddingVertical: 5,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  tagSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
});

export default RatingModal;
