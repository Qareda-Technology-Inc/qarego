import { useEffect, useRef } from "react";
import { useConnectivity } from "@/service/connectivity";

/** Re-run a screen's loader when the app comes back online after being offline. */
export function useRefetchOnReconnect(refetch: () => unknown) {
  const reconnectedAt = useConnectivity((s) => s.reconnectedAt);
  const latest = useRef(refetch);
  latest.current = refetch;
  useEffect(() => {
    if (reconnectedAt) void latest.current();
  }, [reconnectedAt]);
}
