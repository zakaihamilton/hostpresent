"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const keepWorkerInDevelopment =
      window.__HOSTPRESENT_ENABLE_SERVICE_WORKER__ === true;
    if (
      process.env.NODE_ENV === "development" &&
      !keepWorkerInDevelopment &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().then((success) => {
            if (success) {
              window.location.reload();
            }
          });
        }
      });
      return;
    }

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  }, []);

  return null;
}
