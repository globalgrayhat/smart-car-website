import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// We proxy REST to Nest (http://localhost:3000) and ALSO
// proxy Socket.IO websocket path "/socket.io" to the same backend.
// Namespace "/mediasoup" still uses socket.io's default path under the hood.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      // IMPORTANT: point mediasoup to Nest (not to 56211 anymore)
      "/mediasoup": {
        target: "http://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
