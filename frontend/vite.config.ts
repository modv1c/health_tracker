import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  // Куда проксировать запросы /api/... — адрес uvicorn.
  // 127.0.0.1, а не localhost: на Windows localhost может уйти в IPv6 (::1),
  // а uvicorn по умолчанию слушает только IPv4.
  const backend = env.BACKEND_URL || "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: backend,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
