import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  base: '/veloclub-horgen-webshop/', // <-- repo name with leading & trailing slashes
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
