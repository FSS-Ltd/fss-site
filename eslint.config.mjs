import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Supabase CLI local state:
    "supabase/.branches/**",
    "supabase/.temp/**",
    // Local agent worktrees are separate repositories with their own build output:
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
