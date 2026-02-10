import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  cacheComponents: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
}

export default nextConfig
