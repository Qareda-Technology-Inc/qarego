import { ensureApiBaseUrl } from "./config";

export type ApiError = Error & { status?: number; data?: unknown };

function toNetworkError(cause: unknown): Error {
  const err = new Error("Network Error") as ApiError;
  if (cause instanceof Error && cause.message) {
    err.message = cause.message.includes("Network request failed")
      ? "Network Error"
      : cause.message;
  }
  return err;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const base = await ensureApiBaseUrl();
  const url = `${base}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const err = toNetworkError(new Error("Request failed")) as ApiError;
      err.status = res.status;
      err.data = data;
      const msg =
        typeof data === "object" && data !== null && "msg" in data
          ? String((data as { msg: unknown }).msg)
          : `HTTP ${res.status}`;
      err.message = msg;
      throw err;
    }

    return data as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out");
    }
    if (e instanceof Error && e.message !== "Network Error" && "status" in e) {
      throw e;
    }
    throw toNetworkError(e);
  } finally {
    clearTimeout(timer);
  }
}
