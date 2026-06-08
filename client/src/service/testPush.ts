import { appAxios } from "./apiInterceptors";

export async function sendTestPushNotification() {
  const { data } = await appAxios.post<{
    message: string;
    firebaseConfigured?: boolean;
    results?: { provider: string; result: { ok: boolean } }[];
  }>("/notifications/test");
  return data;
}
