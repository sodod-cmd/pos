/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // Product photos are uploaded through Server Actions (up to 6 images, 8MB each).
    serverActions: { bodySizeLimit: '30mb' },
    // /admin goes through proxy.ts, which buffers request bodies up to this size.
    proxyClientMaxBodySize: '30mb',
  },
}

export default nextConfig
