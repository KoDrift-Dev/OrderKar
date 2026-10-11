/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Image CDN (Cloudflare Worker edge cache) — see cdnUrl() in lib/images.ts
      { protocol: 'https', hostname: 'orderkar-images.tahseenalam345.workers.dev' },
      // Cloudinary origin (used directly when the CDN env var is unset)
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // Dashboard hero art
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
