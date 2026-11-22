import { Alert } from "react-native";
import { router } from "expo-router";

const mockStore = new Map<string, string>();
jest.mock("@/store/storage", () => ({
  tokenStorage: {
    getString: (k: string) => mockStore.get(k),
    set: (k: string, v: string) => mockStore.set(k, v),
    delete: (k: string) => mockStore.delete(k),
  },
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

import {
  consumeReturnAfterSignIn,
  endGuestBrowsing,
  isGuestBrowsing,
  requireAccount,
  startGuestBrowsing,
} from "@/utils/guest";

describe("browsing without an account", () => {
  beforeEach(() => {
    mockStore.clear();
    jest.restoreAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (router.push as jest.Mock).mockClear();
  });

  it("a guest is asked to sign in before ordering, and comes back after", () => {
    startGuestBrowsing();
    expect(isGuestBrowsing()).toBe(true);
    expect(requireAccount("place your order")).toBe(false);
    const [title, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe("Sign in to place your order");
    buttons.find((b: { text: string }) => b.text === "Sign in").onPress();
    expect(router.push).toHaveBeenCalledWith("/role");
    expect(consumeReturnAfterSignIn()).toBe(true);
    expect(consumeReturnAfterSignIn()).toBe(false); // only once
  });

  it("a signed-in customer goes straight through", () => {
    mockStore.set("access_token", "t");
    expect(requireAccount()).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(isGuestBrowsing()).toBe(false);
  });

  it("signing in ends guest mode", () => {
    startGuestBrowsing();
    endGuestBrowsing();
    expect(isGuestBrowsing()).toBe(false);
  });
});
