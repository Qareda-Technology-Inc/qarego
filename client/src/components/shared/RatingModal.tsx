import React, { FC, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { Colors } from "@/utils/Constants";
import CustomText from "./CustomText";
import { RFValue } from "react-native-responsive-fontsize";
import { Ionicons } from "@expo/vector-icons";
import CustomButton from "./CustomButton";
import { appAxios } from "@/service/apiInterceptors";
import { CenteredFormModal } from "./CenteredFormModal";

interface RatingModalProps {
  visible: boolean;
  rideId: string;
  role: "customer" | "rider";
  onClose: () => void;
  onSuccess: () => void;
}

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

  useEffect(() => {
    if (!visible) {
      setRating(0);
      setReview("");
      setSelectedTags([]);
      setLoading(false);
    }
  }, [visible]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleRating = async () => {
    if (!rideId) {
      Alert.alert("Error", "Missing ride. Please go back and try again.");
      return;
    }
    if (rating === 0) {
      Alert.alert("Please select a rating");
      return;
    }

    if (rating < 3 && !review.trim() && selectedTags.length === 0) {
      Alert.alert(
        "Feedback Required",
        "Please provide feedback or select tags to help improve the service."
      );
      return;
    }

    setLoading(true);
    try {
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
    <CenteredFormModal visible={visible} onRequestClose={onClose}>
      <CustomText fontFamily="SemiBold" fontSize={11} style={styles.brandText}>
        QareGO
      </CustomText>

      <CustomText fontFamily="Bold" style={styles.title}>
        {role === "customer" ? "Rate your driver" : "Rate your passenger"}
      </CustomText>
      <CustomText fontSize={13} style={styles.subtitle}>
        Tap a star to rate this trip
      </CustomText>

      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={styles.starBtn}
          >
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={Platform.OS === "android" ? 38 : 40}
              color={star <= rating ? Colors.primary : "#CBD5E1"}
            />
          </TouchableOpacity>
        ))}
      </View>

      {rating > 0 && tagsToShow ? (
        <View style={styles.tagsContainer}>
          <CustomText fontFamily="Medium" style={styles.label}>
            {rating >= 3 ? "What went well?" : "What could be improved?"}
          </CustomText>
          <View style={styles.tagsWrap}>
            {tagsToShow.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={[styles.tag, selected && styles.tagSelected]}
                  activeOpacity={0.85}
                >
                  <CustomText
                    fontSize={12}
                    style={{ color: selected ? "#fff" : Colors.text }}
                  >
                    {tag}
                  </CustomText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

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
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={3}
          value={review}
          onChangeText={setReview}
          textAlignVertical="top"
        />
        {requiresFeedback ? (
          <CustomText fontSize={11} style={styles.requiredHint}>
            Feedback is required for ratings below 3 stars
          </CustomText>
        ) : null}
      </View>

      <View style={styles.buttonContainer}>
        <CustomButton
          title={loading ? "Submitting…" : "Submit Rating"}
          onPress={handleRating}
          loading={loading}
          disabled={loading || rating === 0}
        />
        {!requiresFeedback ? (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSuccess}
            disabled={loading}
            activeOpacity={0.7}
          >
            <CustomText style={styles.skipText}>Skip</CustomText>
          </TouchableOpacity>
        ) : null}
      </View>
    </CenteredFormModal>
  );
};

const styles = StyleSheet.create({
  brandText: {
    color: Colors.text,
    letterSpacing: 1.1,
    opacity: 0.75,
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: RFValue(18),
    textAlign: "center",
    color: Colors.text,
  },
  subtitle: {
    textAlign: "center",
    color: "#64748B",
    marginTop: 6,
    marginBottom: 18,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  starBtn: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  reviewContainer: {
    width: "100%",
    marginBottom: 16,
  },
  label: {
    fontSize: RFValue(12),
    marginBottom: 8,
    color: "#64748B",
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    minHeight: 96,
    backgroundColor: "#F8FAFC",
    fontFamily: "Regular",
    width: "100%",
    color: Colors.text,
    fontSize: 15,
  },
  requiredHint: {
    marginTop: 6,
    color: "#EF4444",
  },
  buttonContainer: {
    width: "100%",
    gap: 8,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  skipText: {
    color: "#64748B",
    fontFamily: "Medium",
    fontSize: RFValue(12),
  },
  tagsContainer: {
    width: "100%",
    marginBottom: 14,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tagSelected: {
    backgroundColor: Colors.theme,
    borderColor: Colors.theme,
  },
});

export default RatingModal;
