/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@pinpinwish/shared',
    '@pinpinwish/wishlist-core',
    '@pinpinwish/price-tracker',
  ],
}

export default nextConfig
