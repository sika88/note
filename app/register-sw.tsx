"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    // Production only: a service worker in dev would cache stale code and confuse you
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((e) => console.error("SW failed", e));
    }
  }, []);
  return null;
}
