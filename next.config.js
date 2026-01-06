// @ts-check
const nextBuildId = require("next-build-id")

const shouldAnalyzeBundles = process.env.ANALYZE === "true"

/** @type {import("next").NextConfig} */
let nextConfig = {
  reactStrictMode: true,

  // Keep SPA export in production (official mfe-checkout style)
  output: process.env.NODE_ENV === "production" ? "export" : "standalone",

  poweredByHeader: false,

  // Optional: only if you really need these custom paths
  distDir: "out",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH
    ? `${process.env.NEXT_PUBLIC_BASE_PATH}/`
    : undefined,

  generateBuildId: () => nextBuildId({ dir: __dirname }),
}

if (shouldAnalyzeBundles) {
  const withBundleAnalyzer = require("@next/bundle-analyzer")({ enabled: true })
  nextConfig = withBundleAnalyzer(nextConfig)
}

module.exports = nextConfig
