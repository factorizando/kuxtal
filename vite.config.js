import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw-notifications.js",
      registerType: "autoUpdate",
      devOptions: { enabled: true },
      injectManifest: { globPatterns: [] },
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "KuXtaL",
        short_name: "KuXtaL",
        description:
          "Registro de glucosa y presión arterial para personas con diabetes y sus familias",
        theme_color: "#059669",
        background_color: "#F4F2ED",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    include: ["recharts", "react-is"],
  },
});
