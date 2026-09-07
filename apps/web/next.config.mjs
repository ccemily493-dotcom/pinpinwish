/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@pinpinwish/shared',
    '@pinpinwish/wishlist-core',
    '@pinpinwish/price-tracker',
    '@pinpinwish/pinterest-connector',
    '@pinpinwish/product-resolver',
    '@pinpinwish/product-search',
  ],
}

export default nextConfig
