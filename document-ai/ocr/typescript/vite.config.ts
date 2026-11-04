import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { securityHeaders } from "./security.ts";

export default defineConfig({
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
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    headers: securityHeaders(),
  },
});
