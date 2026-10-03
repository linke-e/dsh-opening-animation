// Build both runtime artifacts. The client bundle format mirrors the shipped
// dsh-custom-skin/lib/client.js byte-for-byte at the seams:
//   banner: window.__ModuleLoader__.load({ id, factory: (require) => { ... }))
//   body:   esbuild CJS output of the ESM source ("use strict" + helpers)
//   footer: return module.exports; } });
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(path.join(root, "package.json"), "utf8")));

await mkdir(path.join(root, "lib"), { recursive: true });

// Host entry: empty apply(), zero dependencies, plain ESM like the skin host artifact.
await build({
  entryPoints: [path.join(root, "src/index.ts")],
  outfile: path.join(root, "lib/index.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  sourcemap: false,
  logLevel: "info",
});

const id = pkg.name;
await build({
  entryPoints: [path.join(root, "src/client/index.ts")],
  outfile: path.join(root, "lib/client.js"),
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  external: ["react", "react/jsx-runtime"],
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  footer: {
    js: `return module.exports; } });`,
  },
  sourcemap: true,
  logLevel: "info",
});
