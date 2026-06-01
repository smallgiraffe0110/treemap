"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isLocalDev =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";

    // Dev: nuke any SW left over from a prior `next start` session — it caches the
    // app shell and can serve stale chunks that break the map. Clear all caches too.
    if (isLocalDev && process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      }).catch(() => undefined);
      if (typeof caches !== "undefined") {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => undefined);
      }
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
