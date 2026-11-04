import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { securityHeaders } from "./security.ts";

// The browser must never hold an API key, so the page calls /api/ocr on its own origin and this dev server
// forwards the call to the public API with MUNITO_API_KEY. Your own server does the same in production.
const MUNITO = "https://api.munito.ai";

export default defineConfig(({ command }) => {
  const key = process.env.MUNITO_API_KEY;
  if (command === "serve" && !key) {
    throw new Error("Set MUNITO_API_KEY to your Munito API key, then start the server again.");
  }
  return {
    plugins: [react()],
    publicDir: false,
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      headers: securityHeaders(true),
      fs: {
        strict: true,
        deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/data/**"],
      },
      proxy: {
        // /api/ocr -> POST /inference/v1/ocr, and /api/ocr/<id> -> GET /inference/v1/ocr/<id> for a long document.
        "/api/ocr": {
          target: MUNITO,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "/inference/v1"),
          headers: { Authorization: `Bearer ${key}` },
        },
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
      headers: securityHeaders(),
    },
  };
});
