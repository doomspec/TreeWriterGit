import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const FAVICON_PATH = /^\/(favicon[^/?]*|apple-touch-icon[^/?]*|safari-pinned-tab[^/?]*)(\?.*)?$/;

export default defineConfig({
  plugins: [
    react(),
    {
      name: "favicon-no-cache",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split("#")[0] ?? "";
          if (FAVICON_PATH.test(url)) {
            res.setHeader("Cache-Control", "no-store, must-revalidate");
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@xterm")) return "xterm";
          if (id.includes("node_modules/d3-")) return "d3";
          if (id.includes("node_modules/katex")) return "katex";
          if (id.includes("node_modules/mermaid")) return "mermaid";
        },
      },
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});

