/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Traces the minimal node_modules subset into `.next/standalone` — the production
  // Docker image copies just that + `.next/static` + `public/`, instead of the full
  // workspace `node_modules`.
  output: "standalone",
};

export default nextConfig;
