import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/kpkmm/media/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
