import React from "react";
import { useLocalSearchParams } from "expo-router";
import { useWS } from "@/service/WSProvider";
import OtpVerifyScreen from "@/components/shared/OtpVerifyScreen";

const OtpVerify = () => {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { updateAccessToken } = useWS();

  return (
    <OtpVerifyScreen
      phone={phone || ""}
      updateAccessToken={updateAccessToken}
      autoSubmitOnPaste
    />
  );
};

export default OtpVerify;
