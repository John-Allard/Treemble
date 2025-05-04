import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tauri from "vite-plugin-tauri";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [
    react(),
    tauri(),
  ],
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    rollupOptions: {
      input: {
        main: "index.html", 
        tipEditor: "tipEditor.html",
      },
    },
  },
}));