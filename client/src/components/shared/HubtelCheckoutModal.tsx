import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { Colors } from "@/utils/Constants";

type Props = {
  visible: boolean;
  checkoutUrl: string | null;
  /** Fired when Hubtel redirects to the success (returnUrl) page. */
  onSuccess: () => void;
  /** Fired when Hubtel redirects to the cancellation page. */
  onCancel: () => void;
  /** Fired when the user manually dismisses the sheet without a resolved status. */
  onClose: () => void;
};

const isReturnUrl = (url: string) => /\/payments\/return/i.test(url);
const isCancelUrl = (url: string) => /\/payments\/cancel/i.test(url);

export default function HubtelCheckoutModal({
  visible,
  checkoutUrl,
  onSuccess,
  onCancel,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const handledRef = useRef(false);

  useEffect(() => {
    if (visible) {
      handledRef.current = false;
      setLoading(true);
    }
  }, [visible, checkoutUrl]);

  const resolve = (url: string): boolean => {
    if (handledRef.current) return true;
    if (isReturnUrl(url)) {
      handledRef.current = true;
      onSuccess();
      return true;
    }
    if (isCancelUrl(url)) {
      handledRef.current = true;
      onCancel();
      return true;
    }
    return false;
  };

  // Block loading the return/cancel pages (they may 404) and resolve instead.
  const handleShouldStart = (req: { url: string }): boolean => {
    const url = req?.url || "";
    if (isReturnUrl(url) || isCancelUrl(url)) {
      resolve(url);
      return false;
    }
    return true;
  };

  const handleNavState = (navState: WebViewNavigation) => {
    resolve(navState?.url || "");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={26} color={Colors.text} />
          </TouchableOpacity>
          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.title}>
            Secure payment
          </CustomText>
          <View style={styles.headerSpacer} />
        </View>

        {checkoutUrl ? (
          <View style={styles.webWrap}>
            <WebView
              source={{ uri: checkoutUrl }}
              onShouldStartLoadWithRequest={handleShouldStart}
              onNavigationStateChange={handleNavState}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={["*"]}
            />
            {loading ? (
              <View style={styles.loaderOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    color: Colors.text,
  },
  headerSpacer: {
    width: 26,
  },
  webWrap: {
    flex: 1,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
});
