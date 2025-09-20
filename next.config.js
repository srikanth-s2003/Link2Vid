/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure server to run on port 5000
  async rewrites() {
    return []
  },
  
  // Optimize for large file downloads
  experimental: {
    serverComponentsExternalPackages: ['youtube-dl-exec'],
  },
}

module.exports = nextConfig