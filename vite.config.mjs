import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function resolveBase(publicUrl) {
  const trimmed = String(publicUrl ?? "").trim();
  if (!trimmed) return "/";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.PORT) || 3001;

  return {
    base: resolveBase(env.PUBLIC_URL),
    // REACT_APP_* is kept so existing deployment env vars keep working after the CRA migration.
    envPrefix: ["VITE_", "REACT_APP_"],
    plugins: [react()],
    server: { port },
    preview: { port },
    build: {
      outDir: "build",
      sourcemap: false,
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/setupTests.js",
    },
  };
});
