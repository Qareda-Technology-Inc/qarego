import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";

/** Checkout merged into cart — keep route for old links. */
export default function FoodCheckoutRedirect() {
  const { vertical } = useLocalSearchParams<{ vertical?: string }>();

  useEffect(() => {
    router.replace({
      pathname: "/customer/stores/cart",
      params: vertical ? { vertical } : {},
    });
  }, [vertical]);

  return null;
}
