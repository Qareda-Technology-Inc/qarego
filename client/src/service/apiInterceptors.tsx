import axios from "axios";
import { ensureApiBaseUrl, getApiBaseUrl } from "./config";
import { tokenStorage } from "@/store/storage";
import { clearSession } from "./session";

export const refresh_tokens = async () => {
  try {
    const refreshToken = tokenStorage.getString("refresh_token");
    const base = await ensureApiBaseUrl();
    const response = await axios.post(`${base}/auth/refresh-token`, {
      refresh_token: refreshToken,
    });

    const new_access_token = response.data.access_token;
    const new_refresh_token = response.data.refresh_token;

    tokenStorage.set("access_token", new_access_token);
    tokenStorage.set("refresh_token", new_refresh_token);
    return new_access_token;
  } catch (error) {
    console.log("REFRESH TOKEN ERROR");
    tokenStorage.clearAll();
    clearSession();
  }
};

export const appAxios = axios.create();

appAxios.interceptors.request.use(async (config) => {
  config.baseURL = await ensureApiBaseUrl();
  const accessToken = tokenStorage.getString("access_token");
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

appAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      try {
        const newAccessToken = await refresh_tokens();
        if (newAccessToken) {
          error.config.headers.Authorization = `Bearer ${newAccessToken}`;
          return appAxios.request(error.config);
        }
      } catch (err) {
        console.log("Error refreshing token");
      }
    }

    return Promise.reject(error);
  }
);
