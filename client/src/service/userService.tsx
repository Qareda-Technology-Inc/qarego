import { useUserStore } from "@/store/userStore";
import { useRiderStore } from "@/store/riderStore";
import { appAxios } from "./apiInterceptors";

function isSameUserId(
  user: { _id?: string; id?: string } | null | undefined,
  id: string
) {
  if (!user) return false;
  const target = String(id);
  return String(user._id ?? "") === target || String(user.id ?? "") === target;
}

export const updateUserProfile = async (id: string, data: any) => {
  try {
    const res = await appAxios.patch('/auth/update-user', {
      id,
      ...data,
    });
    
    // Update local store based on role (or just update both/check role)
    // We can't easily know the role here without passing it or checking stores
    // But usually the component calling this knows which store to update.
    // However, for convenience, let's update the store if the ID matches.
    
    const { user: customerUser, setUser: setCustomerUser } = useUserStore.getState();
    const { user: riderUser, setUser: setRiderUser } = useRiderStore.getState();

    if (isSameUserId(customerUser, id)) {
        setCustomerUser(res.data.user);
    }
    if (isSameUserId(riderUser, id)) {
        setRiderUser(res.data.user);
    }

    return res.data.user;
  } catch (error: any) {
    console.error("Update user error:", error);
    throw error;
  }
};

export const updateDriverProfile = async (
  id: string,
  data: FormData | Record<string, unknown>
) => {
  try {
    const res =
      data instanceof FormData
        ? await appAxios.patch(`/drivers/${id}`, data, {
            headers: { "Content-Type": "multipart/form-data" },
          })
        : await appAxios.patch(`/drivers/${id}`, data);
    
    // Update rider store
    const { user: riderUser, setUser: setRiderUser } = useRiderStore.getState();
    if (isSameUserId(riderUser, id)) {
        setRiderUser(res.data.driver);
    }

    return res.data.driver;
  } catch (error: any) {
    console.error("Update driver profile error:", error);
    throw error;
  }
};
