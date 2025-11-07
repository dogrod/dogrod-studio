import type { NextConfig } from "next";

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];

const r2Base = process.env.R2_PUBLIC_BASE_URL;

if (r2Base) {
  try {
    const parsed = new URL(r2Base);
    remotePatterns.push({
      protocol: parsed.protocol.replace(":", "") as "http" | "https",
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      pathname: `${parsed.pathname.replace(/\/$/, "") || ""}/**`,
    });
  } catch (error) {
    console.warn("Invalid R2_PUBLIC_BASE_URL provided:", error);
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
