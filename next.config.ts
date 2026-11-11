import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The in-memory Postgres used to run cloud mode locally (DATABASE_URL=pglite:memory)
  // ships WebAssembly; load it from node_modules rather than bundle it.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
