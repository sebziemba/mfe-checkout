// @ts-check
const nextBuildId = require("next-build-id")

/** @type { import('next').NextConfig } */
module.exports = {
  reactStrictMode: true,
  output: process.env.NODE_ENV === "production" ? "export" : "standalone",
  distDir: "out/dist",
  poweredByHeader: false,
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH
    ? `${process.env.NEXT_PUBLIC_BASE_PATH}/`
    : undefined,
  generateBuildId: () => nextBuildId({ dir: __dirname }),
}
