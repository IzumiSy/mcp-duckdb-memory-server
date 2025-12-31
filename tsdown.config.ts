/// <reference types="node" />
import { defineConfig } from "tsdown";

export default defineConfig({
  format: "esm",
  outExtensions: () => ({ js: ".mjs" }),
});
