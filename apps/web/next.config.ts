import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Served under https://yoshik.xyz/val via a rewrite in the personal
  // site's vercel.json. basePath makes all routes, links, and assets live
  // under /val so the proxy works (auth cookies included).
  basePath: "/val",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
