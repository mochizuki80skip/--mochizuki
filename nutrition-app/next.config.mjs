/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'profile.line-scdn.net' },
      { protocol: 'https', hostname: 'static.line-scdn.net' }
    ]
  },
  experimental: {
    serverActions: { bodySizeLimit: '6mb' }
  }
};
export default nextConfig;
