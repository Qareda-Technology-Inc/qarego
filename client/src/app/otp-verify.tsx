import React from "react";
import { useLocalSearchParams } from "expo-router";
import { useWS } from "@/service/WSProvider";
import OtpVerifyScreen from "@/components/shared/OtpVerifyScreen";

const OtpVerify = () => {
  const { phone, codeLength, ussdCode } = useLocalSearchParams<{
    phone: string;
    codeLength?: string;
    ussdCode?: string;
  }>();
  const { updateAccessToken } = useWS();

  return (
    <OtpVerifyScreen
      phone={phone || ""}
      updateAccessToken={updateAccessToken}
      codeLength={Number(codeLength) || 4}
      ussdCode={ussdCode || null}
    />
  );
};

export default OtpVerify;
