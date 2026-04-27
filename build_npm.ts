// Builds @aqwas/core for npm publishing using dnt.
// Outputs dual ESM+CJS with TypeScript declarations to ./dist/
// Usage: deno task build:npm
import { build, emptyDir } from "jsr:@deno/dnt@^0.41.3";
import {
  dirname,
  fromFileUrl,
} from "https://deno.land/std@0.220.0/path/mod.ts";

const root = dirname(fromFileUrl(import.meta.url));

await emptyDir(`${root}/dist`);

await build({
  entryPoints: [`${root}/src/index.ts`],
  outDir: `${root}/dist`,
  shims: {
    // WebSocket is native in Node 21+; for Node 18 we shim it via `ws`
    custom: [{
      package: {
        name: "ws",
        version: "^8.18.0",
      },
      globalNames: [
        { name: "WebSocket", exportName: "WebSocket" },
      ],
    }],
  },
  package: {
    name: "@aqwas/core",
    version: "0.2.0",
    description:
      "Vanilla TypeScript client for Aqwas — distributed real-time state. Last-write-wins, optimistic updates, offline buffering. Works in the browser, Node.js, Deno, and Bun. No dependencies.",
    license: "MIT",
    author: "Hani Yahya",
    homepage: "https://github.com/iHani/aqwas-core",
    repository: {
      type: "git",
      url: "https://github.com/iHani/aqwas-core.git",
    },
    bugs: { url: "https://github.com/iHani/aqwas-core/issues" },
    keywords: [
      "realtime",
      "state",
      "websocket",
      "sync",
      "distributed",
      "lww",
      "last-write-wins",
      "ai-agents",
      "offline-first",
    ],
    engines: { node: ">=18" },
    devDependencies: {
      ws: "^8.18.0",
      "@types/ws": "^8.5.0",
    },
    publishConfig: {
      access: "public",
    },
  },
  // Tests use Deno-only APIs (Deno.env); run them with `deno task test`
  test: false,
  postBuild() {
    Deno.copyFileSync(`${root}/README.md`, `${root}/dist/README.md`);
  },
  compilerOptions: {
    lib: ["ES2022", "DOM"],
    target: "ES2022",
  },
  filterDiagnostic(d) {
    // Ignore diagnostics from test files (they use Deno-only APIs)
    return !d.file?.fileName.includes("_test.ts");
  },
});

console.log("npm build complete → dist/");
