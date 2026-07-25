import { defineConfig, globalIgnores } from "eslint/config";
import nextConfig from "eslint-config-next/core-web-vitals";
import prettierConfig from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextConfig,
  prettierConfig,
  globalIgnores([
    ".next/**",
    "coverage/**",
    "node_modules/**",
    "out/**",
    "src/generated/prisma/**",
  ]),
]);
