// Offline must never sign the user out: only a refusal from the server ends the session.
// Run: npx jest --no-watchman src/service/__tests__/refreshTokens.test.ts

const mockStore = new Map<string, string>();
jest.mock("@/store/storage", () => ({
  tokenStorage: {
    getString: (k: string) => mockStore.get(k),
    set: (k: string, v: string) => mockStore.set(k, v),
    clearAll: () => mockStore.clear(),
  },
}));
const mockClearSession = jest.fn(() => mockStore.clear());
jest.mock("@/service/session", () => ({ clearSession: () => mockClearSession() }));
jest.mock("@/service/config", () => ({
  ensureApiBaseUrl: async () => "http://api.test",
  getApiBaseUrl: () => "http://api.test",
}));
const mockPost = jest.fn();
jest.mock("axios", () => {
  const instance = { interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } };
  return { __esModule: true, default: { post: (...a: unknown[]) => mockPost(...a), create: () => instance } };
});

import { refresh_tokens } from "@/service/apiInterceptors";
import { useConnectivity } from "@/service/connectivity";

// The connectivity probe uses fetch; keep it quiet and offline.
global.fetch = jest.fn(() => Promise.reject(new Error("Network request failed"))) as jest.Mock;

beforeEach(() => {
  mockStore.clear();
  mockStore.set("access_token", "old-access");
  mockStore.set("refresh_token", "old-refresh");
  mockClearSession.mockClear();
  mockPost.mockReset();
  useConnectivity.setState({ online: true, noInternet: false, reconnectedAt: 0 });
});

test("no internet: keeps the session, reports offline, rethrows", async () => {
  mockPost.mockRejectedValue(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }));
  await expect(refresh_tokens()).rejects.toThrow("Network Error");
  expect(mockStore.get("refresh_token")).toBe("old-refresh");
  expect(mockClearSession).not.toHaveBeenCalled();
  expect(useConnectivity.getState().online).toBe(false);
});

test("server too slow (timeout): keeps the session", async () => {
  mockPost.mockRejectedValue(Object.assign(new Error("timeout of 15000ms exceeded"), { code: "ECONNABORTED" }));
  await expect(refresh_tokens()).rejects.toThrow();
  expect(mockStore.get("access_token")).toBe("old-access");
  expect(mockClearSession).not.toHaveBeenCalled();
});

test("server rejects the refresh token: signs out", async () => {
  mockPost.mockRejectedValue(Object.assign(new Error("Request failed with status code 401"), { response: { status: 401 } }));
  await expect(refresh_tokens()).resolves.toBeUndefined();
  expect(mockClearSession).toHaveBeenCalledTimes(1);
  expect(mockStore.get("refresh_token")).toBeUndefined();
});

test("success: stores the new tokens and reports online", async () => {
  useConnectivity.setState({ online: false });
  mockPost.mockResolvedValue({ data: { access_token: "new-access", refresh_token: "new-refresh" } });
  await expect(refresh_tokens()).resolves.toBe("new-access");
  expect(mockStore.get("access_token")).toBe("new-access");
  expect(useConnectivity.getState().online).toBe(true);
});
