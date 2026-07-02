import path from "node:path";
import { fileURLToPath } from "node:url";
import { chmod, rm } from "node:fs/promises";
import { build as esbuild } from "esbuild";

const dir = path.dirname(fileURLToPath(import.meta.url));

const distDir = path.resolve(dir, "dist");
await rm(distDir, { recursive: true, force: true });

await esbuild({
  entryPoints: [path.resolve(dir, "src/pentai.ts")],
  platform: "node",
  target: "node20",
  bundle: true,
  format: "esm",
  outfile: path.resolve(distDir, "pentai.mjs"),
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "info",
  // Native/optional modules some transitive deps reference lazily.
  external: ["*.node", "bufferutil", "utf-8-validate"],
});

await chmod(path.resolve(distDir, "pentai.mjs"), 0o755);
console.log("✓ built dist/pentai.mjs");
