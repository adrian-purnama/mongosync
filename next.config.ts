import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / CJS packages must stay external for Turbopack production builds.
  serverExternalPackages: [
    "mongodb",
    "bson",
    "archiver",
    "@mongodb-js/zstd",
    "snappy",
    "jszip",
  ],
};

export default nextConfig;
