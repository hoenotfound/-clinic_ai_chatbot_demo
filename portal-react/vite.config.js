import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const demoIndustry = String(process.env.DEMO_INDUSTRY || "clinic").trim().toLowerCase();

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  define: {
    __DEMO_INDUSTRY__: JSON.stringify(demoIndustry),
  },
  build: {
    // Keep imported fonts as same-origin files instead of data: URLs so the
    // dashboard continues to work under the demo's strict default-src policy.
    assetsInlineLimit: 0,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
