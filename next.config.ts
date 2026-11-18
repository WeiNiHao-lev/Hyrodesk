import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The in-memory Postgres used to run cloud mode locally (DATABASE_URL=pglite:memory)
  // ships WebAssembly; load it from node_modules rather than bundle it.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The Claude Code skill is read from tools/ at request time (/claude-skill/...).
  // The engine bundle Claude Code downloads is read from engine-dist/ (/api/engine).
  outputFileTracingIncludes: {
    "/claude-skill/[...path]": ["./tools/claude-skill/hydrodesk/**/*"],
    "/api/engine": ["./engine-dist/**/*"],
    "/api/selftest": ["./engine-dist/**/*", "./public/engine-version.json"],
  },
  // The account page became the profile pages.
  async redirects() {
    return [{ source: "/account", destination: "/profile", permanent: false }];
  },
};

export default nextConfig;
