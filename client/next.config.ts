import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const defaultBackendUrl = isProduction
  ? "https://elitedrive-demoversion.onrender.com"
  : "http://localhost:8000";

const backendUrl =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || defaultBackendUrl;

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://elitedrive-demoversion.onrender.com",
  "font-src 'self' data:",
  "connect-src 'self' https://elitedrive-demoversion.onrender.com http://localhost:8000 ws://localhost:* wss://localhost:*",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["shared", "ui"],
  poweredByHeader: false,
  compress: true,
  turbopack: {
    root: process.cwd(),
  },

  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },

  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "elitedrive-demoversion.onrender.com",
        pathname: "/**",
      },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/elitedrive/**",
      },
    ],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
