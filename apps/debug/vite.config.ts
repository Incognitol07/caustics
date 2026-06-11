import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      caustics: resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
});
