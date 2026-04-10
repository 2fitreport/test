import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactCompiler: false,
  serverExternalPackages: ["better-auth"],
  output: "standalone",
};

export default nextConfig;
