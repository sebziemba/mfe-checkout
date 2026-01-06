// @ts-check

const nextBuildId = require("next-build-id")

const shouldAnalyzeBundles = process.env.ANALYZE === "true"

/** @type { import('next').NextConfig } */
let nextConfig = {
  reactStrictMode: true,

  // ✅ IMPORTANT: do NOT "export" on Vercel if you need /order/[orderId]
  output: "standalone",

  poweredByHeader: false,

  // keep build id if you want it
  generateBuildId: () => nextBuildId({ dir: __dirname }),
}

if (shouldAnalyzeBundles) {
  const withBundleAnalyzer = require("@next/bundle-analyzer")({ enabled: true })
  nextConfig = withBundleAnalyzer(nextConfig)
}

module.exports = nextConfig
