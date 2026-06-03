import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Frontend-only SPA. The backend is hosted separately and reached over HTTP
// via VITE_API_BASE_URL (see src/lib/api-client.ts).
export default defineConfig({
  plugins: [
    tsConfigPaths(),
    // Must run before the React plugin so generated routes are transformed.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 8080,
  },
});
