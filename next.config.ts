import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/shop/orders/*/invoice': ['./public/KPKMM-logo-transparent.png', './node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'],
    '/admin/payments/*': ['./public/KPKMM-logo-transparent.png', './node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'],
    '/membership-invoices/*': ['./public/KPKMM-logo-transparent.png', './node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/kpkmm/media/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
