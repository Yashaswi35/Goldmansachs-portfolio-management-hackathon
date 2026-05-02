/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep dev and prod artifacts separate to avoid chunk manifest collisions
  // when switching between `next dev` and `next build`.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
};

export default nextConfig;
