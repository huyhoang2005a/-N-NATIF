// `@types/pdf-parse` only declares the package root (`pdf-parse`), not the `lib/pdf-parse.js`
// subpath that `extract-text.ts` imports directly (see that file's comment for why: 1.1.1's
// `index.js` has a debug self-test block that crashes under vitest). Same runtime export,
// so just re-export the existing types onto the subpath rather than redeclaring them.
declare module "pdf-parse/lib/pdf-parse.js" {
  // `import X = require(...)` is the only valid syntax for re-exporting a CJS `export =`
  // module from inside an ambient `declare module` block — not a real "require() call" the
  // no-require-imports lint rule is meant to catch (that rule targets runtime `require()`
  // in application code, not type-only ambient declarations).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  import PdfParse = require("pdf-parse");
  export = PdfParse;
}
