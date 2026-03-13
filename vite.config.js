import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react") || id.includes("scheduler")) return "react-vendor";
          if (id.includes("@supabase")) return "supabase-vendor";
          if (id.includes("three") || id.includes("@react-three")) return "three-vendor";
          return "vendor";
        },
      },
    },
  },
});
