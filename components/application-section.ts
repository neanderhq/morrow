"use client";

import { useCallback, useEffect, useState } from "react";

export const fieldStyle = "w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary";

export function useApplicationSection<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (body?: object, success = "") => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const response = await fetch(url, body ? {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      } : { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The request could not be completed.");
      setData(result as T);
      setNotice(success);
      return result as T;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [url]);

  useEffect(() => { void request(); }, [request]);
  return { data, error, notice, busy, request };
}
