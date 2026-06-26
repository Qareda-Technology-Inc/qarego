import React, { FC, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { Colors } from "@/utils/Constants";
import CustomText from "@/components/shared/CustomText";
import { RFValue } from "react-native-responsive-fontsize";
import { Ionicons } from "@expo/vector-icons";
import CustomButton from "@/components/shared/CustomButton";
import { rateFoodOrder } from "@/service/foodService";
import { FOOD_THEME } from "@/styles/foodStyles";
import { CenteredFormModal } from "@/components/shared/CenteredFormModal";

const POSITIVE_TAGS = [
  "Great food",
  "Fast preparation",
  "Good portions",
  "Fresh ingredients",
  "Friendly service",
  "Value for money",
];

const NEGATIVE_TAGS = [
  "Cold food",
  "Wrong items",
  "Slow service",
  "Small portions",
  "Poor packaging",
  "Missing items",
];

type Props = {
  visible: boolean;
  orderId: string;
  restaurantName: string;
  onClose: () => void;
  onSuccess: () => void;
};

const RestaurantRatingModal: FC<Props> = ({
  visible,
  orderId,
  restaurantName,
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
    }
  }, [visible]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert("Please select a rating");
      return;
    }
    if (rating < 3 && !review.trim() && selectedTags.length === 0) {
      Alert.alert(
        "Feedback required",
        "Please share what could be improved for ratings below 3 stars."
      );
      return;
    }

    setLoading(true);
    try {
      const finalReview = review.trim() || selectedTags.join(", ");
      await rateFoodOrder(orderId, rating, finalReview);
      onSuccess();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } }; message?: string };
      Alert.alert("Error", err?.response?.data?.msg || err?.message || "Failed to submit rating");
    } finally {
      setLoading(false);
    }
  };

  const requiresFeedback = rating > 0 && rating < 3;
  const tagsToShow = rating >= 3 ? POSITIVE_TAGS : NEGATIVE_TAGS;

  return (
    <CenteredFormModal visible={visible} onRequestClose={onClose}>
      <View style={styles.header}>
        <CustomText fontFamily="Bold" style={styles.title}>
          Rate {restaurantName}
        </CustomText>
        <CustomText fontSize={13} color="#666" style={styles.subtitle}>
          How was your order?
        </CustomText>
      </View>

      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={40}
              color={FOOD_THEME.orange}
              style={styles.star}
            />
          </TouchableOpacity>
        ))}
      </View>

      {rating > 0 ? (
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
                style={[styles.tag, selectedTags.includes(tag) && styles.tagSelected]}
              >
                <CustomText
                  fontSize={11}
                  style={{ color: selectedTags.includes(tag) ? "#fff" : Colors.text }}
                >
                  {tag}
                </CustomText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.reviewContainer}>
        <CustomText fontFamily="Medium" style={styles.label}>
          {requiresFeedback ? "Additional feedback (required)" : "Comments (optional)"}
        </CustomText>
        <TextInput
          style={styles.input}
          placeholder={
            requiresFeedback ? "Tell us what went wrong…" : "Share more about your meal…"
          }
          multiline
          numberOfLines={3}
          value={review}
          onChangeText={setReview}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.buttonContainer}>
        <CustomButton title="Submit rating" onPress={handleSubmit} loading={loading} disabled={loading} />
        {!requiresFeedback ? (
          <TouchableOpacity style={styles.skipButton} onPress={onSuccess} disabled={loading}>
            <CustomText style={styles.skipText}>Skip</CustomText>
          </TouchableOpacity>
        ) : null}
      </View>
    </CenteredFormModal>
  );
};

const styles = StyleSheet.create({
  header: { marginBottom: 16, width: "100%" },
  title: { fontSize: RFValue(18), textAlign: "center" },
  subtitle: { marginTop: 6, textAlign: "center" },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  star: { marginHorizontal: 5 },
  tagsContainer: { width: "100%", marginBottom: 12 },
  tagsScroll: { gap: 8, paddingVertical: 4 },
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
    backgroundColor: FOOD_THEME.orange,
    borderColor: FOOD_THEME.orange,
  },
  reviewContainer: { width: "100%", marginBottom: 16 },
  label: { fontSize: RFValue(12), marginBottom: 8, color: "#666" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 10,
    height: 90,
    backgroundColor: "#f9f9f9",
    width: "100%",
  },
  buttonContainer: { width: "100%", gap: 8 },
  skipButton: { padding: 10, alignItems: "center" },
  skipText: { color: "#666", fontFamily: "Medium", fontSize: RFValue(12) },
});

export default RestaurantRatingModal;
