import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registrar service worker de notificaciones
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw-notifications.js")
    .then((reg) => console.log("SW notificaciones registrado:", reg.scope))
    .catch((err) => console.error("SW notificaciones error:", err));
}
