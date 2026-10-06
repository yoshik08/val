"use client";

import { useCallback, useEffect, useState } from "react";
import { bp } from "./basePath";

export type FetchState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "ok"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: { message: string; code?: string } };

/**
 * Fetch from the local proxy route handlers (which mint the API JWT
 * server-side). `deps` re-triggers the fetch; `intervalMs` polls.
 */
export function useApi<T>(path: string, deps: unknown[] = [], intervalMs?: number) {
  const [state, setState] = useState<FetchState<T>>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(bp(path), { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setState({
          status: "error",
          error: {
            message: (data && data.error) || `request failed: ${res.status}`,
            code: data && data.code,
          },
        });
        return;
      }
      setState({ status: "ok", data: data as T });
    } catch {
      setState({
        status: "error",
        error: { message: "couldn't reach the server — retrying…" },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    load().then(() => {});
    let timer: ReturnType<typeof setInterval> | undefined;
    if (intervalMs) {
      timer = setInterval(() => {
        if (!cancelled) load();
      }, intervalMs);
    }
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: load };
}

export function isExpired(error?: { code?: string }): boolean {
  return error?.code === "SSID_EXPIRED";
}
