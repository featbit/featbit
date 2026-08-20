import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  globalIgnores([
    "dist/**",
    "out/**",
    "build/**",
    "src/generated/prisma/**",
  ]),
]);

export default eslintConfig;
