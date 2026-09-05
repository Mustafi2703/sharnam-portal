import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth";
import { loadSavedTheme } from "./themes";
import "./index.css";

loadSavedTheme();

/** Suppress PerformanceObserver noise from embedded browser previews (startTime on undefined entries). */
if (typeof window !== "undefined") {
  window.addEventListener(
    "error",
    (event) => {
      const msg = String(event.message || "");
      if (msg.includes("startTime") && msg.includes("reportAllChanges")) {
        event.preventDefault();
      }
    },
    true,
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
