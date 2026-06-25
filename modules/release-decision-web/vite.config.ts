import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const basePath = env.VITE_BASE_PATH || "/release-decision/";
  const normalizedBasePath = basePath.replace(/\/+$/, "");

  return {
    base: basePath.endsWith("/") ? basePath : `${basePath}/`,
    plugins: [
      {
        name: "release-decision-base-redirect",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === normalizedBasePath) {
              res.statusCode = 308;
              res.setHeader("Location", `${normalizedBasePath}/`);
              res.end();
              return;
            }
            next();
          });
        },
      },
      react(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: Number(env.PORT || 3000),
      strictPort: true,
    },
  };
});
