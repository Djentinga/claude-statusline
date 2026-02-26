import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" },
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ["src/command.ts"],
    outfile: "dist/command.mjs",
  }),
  build({
    ...shared,
    entryPoints: ["src/collector.ts"],
    outfile: "dist/collector.mjs",
  }),
]);

console.log("Built dist/command.mjs and dist/collector.mjs");
