import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
];

const longCache = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
  { key: "CDN-Cache-Control", value: "public, max-age=31536000" },
];

const publicCache = [
  { key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=31536000" },
  { key: "CDN-Cache-Control", value: "public, max-age=2592000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["nodemailer", "sharp", "@aws-sdk/client-s3"],
  async redirects() {
    return [
      { source: "/plans", destination: "/products", permanent: true },
      { source: "/plans/:id", destination: "/products/:id", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/_next/static/:path*", headers: longCache },
      { source: "/uploads/:path*", headers: publicCache },
      { source: "/_next/image", headers: publicCache },
      {
        source: "/:file(favicon.ico|icon.svg|apple-icon.png|og.png|robots.txt|sitemap.xml|manifest.webmanifest)",
        headers: publicCache,
      },
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
