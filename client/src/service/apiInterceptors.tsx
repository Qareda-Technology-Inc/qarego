import axios from "axios";
import { ensureApiBaseUrl, getApiBaseUrl } from "./config";
import { tokenStorage } from "@/store/storage";
import { clearSession } from "./session";
import { isNoResponseError, markOffline, markOnline } from "./connectivity";

/**
 * Get new tokens. Only a refusal from the server ends the session; if the server can't be
 * reached (no internet, server asleep) the stored session is kept and the error rethrown,
 * so a weak signal never signs anyone out.
 */
export const refresh_tokens = async () => {
  try {
    const refreshToken = tokenStorage.getString("refresh_token");
    const base = await ensureApiBaseUrl();
    const response = await axios.post(
      `${base}/auth/refresh-token`,
      { refresh_token: refreshToken },
      { timeout: 15000 }
    );
    markOnline();

    const new_access_token = response.data.access_token;
    const new_refresh_token = response.data.refresh_token;

    tokenStorage.set("access_token", new_access_token);
    tokenStorage.set("refresh_token", new_refresh_token);
    return new_access_token;
  } catch (error) {
    if (isNoResponseError(error)) {
      markOffline();
      throw error;
    }
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
  (response) => {
    markOnline();
    return response;
  },
  async (error) => {
    if (isNoResponseError(error)) markOffline();
    else if (error.response) markOnline();
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
