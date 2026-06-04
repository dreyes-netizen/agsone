import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin", "xlsx"],
  devIndicators: false,
  allowedDevOrigins: ["jinx-delicious-jawline.ngrok-free.dev", "*.ngrok-free.dev"],
};

export default nextConfig;
