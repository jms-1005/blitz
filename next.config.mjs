/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // static export → deploys anywhere, incl. Cloudflare Pages
  trailingSlash: true,       // /privacy → privacy/index.html (works on any static host)
  images: { unoptimized: true },
};
export default nextConfig;
