import { tokenStorage } from "@/store/storage";
import { useUserStore } from "@/store/userStore";
import { useRiderStore } from "@/store/riderStore";
import { resetAndNavigate } from "@/utils/Helpers";

/** Clears tokens and user state; navigates to role picker. */
export function clearSession() {
  tokenStorage.clearAll();
  useUserStore.getState().clearData();
  useRiderStore.getState().clearRiderData();
  resetAndNavigate("/role");
}
