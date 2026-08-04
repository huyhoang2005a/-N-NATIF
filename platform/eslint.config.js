// @ts-check
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsparser = require("@typescript-eslint/parser");

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/next-env.d.ts",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // NestJS resolves constructor dependencies (services, repositories, Reflector, ...) via
    // `emitDecoratorMetadata`, which needs the real class at runtime, not just its type. A
    // type-only import erases that class from the compiled output, so `consistent-type-imports`
    // silently breaks dependency injection here (Nest boots fine, then crashes / injects
    // `undefined` on first request) — this bit us for real once, see
    // docs/spec/PHASE1_IMPLEMENTATION_NOTES.md §8. Excludes *.spec.ts, which construct classes
    // by hand and never go through Nest's DI container.
    files: ["apps/api/src/**/*.ts"],
    ignores: ["apps/api/src/**/*.spec.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
];
