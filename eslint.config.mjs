import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Filter out the problematic react plugin from nextVitals
const filteredNextVitals = nextVitals.filter(
  (config) => !config.plugins || !config.plugins.react,
);

const eslintConfig = defineConfig([
  ...filteredNextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
