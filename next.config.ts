import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Standalone bundles the server and only the files it traced, so the app can
  // be copied somewhere else and run with plain node.
  output: "standalone",
  reactCompiler: true,
  allowedDevOrigins: ['192.168.1.*'],
  experimental: {
    // Allow logo/cover/gallery image (≤5 MB) and short promo video uploads
    // through Server Actions (default is 1 MB).
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.storage.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
