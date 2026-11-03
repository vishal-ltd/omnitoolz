import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "public/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // The Next 15 React Hooks plugin does not expose the newer React 19
      // compiler rules. Effects that synchronize browser APIs remain covered
      // by the standard hook dependency rules below.
    },
  },
];

export default config;
