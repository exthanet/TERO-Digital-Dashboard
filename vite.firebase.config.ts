import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const base = "/";

export default defineConfig({
  root: `${projectRoot}github-pages`,
  base,
  publicDir: `${projectRoot}public`,
  envDir: false,
  plugins: [react()],
  resolve: { alias: { "@": projectRoot } },
  define: {
    "process.env.NEXT_PUBLIC_STATIC_HOST": JSON.stringify("true"),
    "process.env.NEXT_PUBLIC_ASSET_BASE": JSON.stringify(base),
  },
  build: { outDir: `${projectRoot}dist/firebase`, emptyOutDir: true },
});
