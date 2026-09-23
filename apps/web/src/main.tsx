import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth";
import { loadSavedTheme } from "./themes";
import "./index.css";

loadSavedTheme();

/** Suppress PerformanceObserver noise from embedded previews (undefined entry.startTime). */
if (typeof window !== "undefined") {
  const isPerfObserverNoise = (raw: unknown) => {
    const msg = String(raw instanceof Error ? raw.message : raw ?? "");
    return (
      msg.includes("startTime") &&
      (msg.includes("reportAllChanges") || msg.includes("Cannot read properties of undefined"))
    );
  };
  window.addEventListener(
    "error",
    (event) => {
      if (isPerfObserverNoise(event.message) || isPerfObserverNoise(event.error)) {
        event.preventDefault();
      }
    },
    true,
  );
  window.addEventListener("unhandledrejection", (event) => {
    if (isPerfObserverNoise(event.reason)) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
