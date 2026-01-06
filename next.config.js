// @ts-check
const nextBuildId = require("next-build-id")

const shouldAnalyzeBundles = process.env.ANALYZE === "true"

/** @type {import("next").NextConfig} */
let nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  generateBuildId: () => nextBuildId({ dir: __dirname }),
}

if (shouldAnalyzeBundles) {
  const withBundleAnalyzer = require("@next/bundle-analyzer")({ enabled: true })
  nextConfig = withBundleAnalyzer(nextConfig)
}

module.exports = nextConfig
