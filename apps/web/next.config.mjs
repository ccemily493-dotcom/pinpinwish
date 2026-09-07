/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@pinpinwish/shared',
    '@pinpinwish/wishlist-core',
    '@pinpinwish/price-tracker',
    '@pinpinwish/pinterest-connector',
  ],
}

export default nextConfig
