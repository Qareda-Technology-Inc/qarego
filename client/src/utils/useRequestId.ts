import { useMemo, useRef } from "react";

function randomPart(): string {
  return Math.random().toString(36).slice(2, 12).padEnd(10, "0");
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * An id for "this order/booking attempt", sent as clientRequestId so the server can tell a
 * retry from a new request. Retrying the same thing reuses the id (no duplicates); changing
 * what's being ordered (signature) gives a new one, so an edit isn't mistaken for a retry.
 */
export function useRequestId(signature: string): string {
  const salt = useRef(randomPart()).current;
  return useMemo(() => `${salt}${hash(signature)}`, [salt, signature]);
}
