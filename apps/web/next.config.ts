import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Absolute asset URLs so the app also works when proxied through
  // yoshik.xyz/val (vercel.json rewrite) — relative /_next/* paths would
  // otherwise resolve against yoshik.xyz and 404.
  assetPrefix:
    process.env.NODE_ENV === "production"
      ? "https://val.yoshik.xyz"
      : undefined,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
