import { build } from "esbuild";

// Shim out react-devtools-core (optional ink dependency, not needed at runtime)
const shimPlugin = {
  name: "shim-devtools",
  setup(b) {
    b.onResolve({ filter: /^react-devtools-core$/ }, () => ({
      path: "react-devtools-core",
      namespace: "shim",
    }));
    b.onLoad({ filter: /.*/, namespace: "shim" }, () => ({
      contents: "export default undefined;",
    }));
  },
};

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" },
  plugins: [shimPlugin],
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ["src/command.tsx"],
    outfile: "dist/command.mjs",
  }),
  build({
    ...shared,
    entryPoints: ["src/collector.ts"],
    outfile: "dist/collector.mjs",
  }),
]);

console.log("Built dist/command.mjs and dist/collector.mjs");
