"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production-like env (dev SW can be noisy with HMR).
    const isLocalDev =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (isLocalDev && process.env.NODE_ENV !== "production") {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
