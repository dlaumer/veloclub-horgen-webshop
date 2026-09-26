import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// This has to match wherever the production build actually gets deployed -
// it's baked into every asset URL (<script src>, <link href>, assetUrl())
// at BUILD time, so changing this always requires a rebuild + redeploy, it
// can't be fixed by just moving files around on the server afterwards.
// Deployed at the site root (not a subfolder) as of 2026-09 - was "/neu/"
// while this rebuild lived alongside the old frontend at /neu/ for testing.
const PROD_BASE = "/";

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
