import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Explicitly permit /embed/* pages to be iframed from any origin.
        // Content-Security-Policy frame-ancestors is the modern standard;
        // it supersedes X-Frame-Options in all current browsers.
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;
