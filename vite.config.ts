import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Clean URLs (e.g. /admin, not /#/admin) need the router's basename to
// match wherever the app is actually served from. Local dev (npm run dev)
// is always served at the domain root, so that stays "/"; update this if
// the production deployment folder ever changes.
const PROD_BASE = "/neu/";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? PROD_BASE : "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "production" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
