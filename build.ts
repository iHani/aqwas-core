// Bundles @aqwas/core for browser use.
// Yjs is kept external (loaded via importmap in the HTML).
// Output: server/public/aqwas-core.js
import * as esbuild from "npm:esbuild"
import { fromFileUrl, dirname, join } from "https://deno.land/std@0.220.0/path/mod.ts"

const root = dirname(fromFileUrl(import.meta.url))
const outfile = join(root, "../../server/public/aqwas-core.js")

await esbuild.build({
  entryPoints: [join(root, "src/index.ts")],
  bundle: true,
  format: "esm",
  outfile,
  external: ["yjs"],
  minify: false,
  logLevel: "info",
})

esbuild.stop()
console.log(`Built → ${outfile}`)
