// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Deployed on Vercel at compat.ocramer.com, with site/ as the project's root directory.
export default defineConfig({
  site: "https://compat.ocramer.com",
  trailingSlash: "ignore",
  vite: {
    plugins: [tailwindcss()],
    // The engine files live one level up, in the repository root.
    server: { fs: { allow: [".."] } },
  },
});
