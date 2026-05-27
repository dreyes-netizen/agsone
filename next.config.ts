import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin", "xlsx"],
  devIndicators: false,
};

export default nextConfig;
