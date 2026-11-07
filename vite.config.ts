import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

function contentScriptPlugin(): Plugin {
  return {
    name: "content-script-builder",
    apply: "build",
    async closeBundle() {
      await esbuild({
        entryPoints: [resolve(projectRoot, "src/content/index.ts")],
        bundle: true,
        outfile: resolve(projectRoot, "dist/content.js"),
        format: "iife",
        minify: false,
        target: "es2022"
      });
    }
  };
}

export default defineConfig({
  plugins: [svelte(), contentScriptPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(projectRoot, "index.html"),
        background: resolve(projectRoot, "src/background/index.ts"),
        options: resolve(projectRoot, "options.html")
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
