import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    tanstackStart({
      server: { entry: "server" },
      serverFns: { disableCsrfMiddlewareWarning: true },
    }),
    nitro(),
    react(),
  ],
  server: {
    port: 8080,
  },
  // Pre-declare Node.js built-ins as SSR externals so Nitro's dev worker
  // never needs to call getBuiltins() over IPC (which times out on Windows).
  ssr: {
    external: [
      "node:process",
      "node:buffer",
      "node:path",
      "node:fs",
      "node:fs/promises",
      "node:url",
      "node:util",
      "node:stream",
      "node:events",
      "node:crypto",
      "node:os",
      "node:http",
      "node:https",
      "node:net",
      "node:tls",
      "node:child_process",
      "node:worker_threads",
    ],
  },
});
// Reload Vite dev server config
