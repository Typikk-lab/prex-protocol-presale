/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // swcMinify is true by default in modern Next.js, but good to explicitly declare
  swcMinify: true,

  webpack: (config) => {
    // Resolve fallbacks for Node native modules required by Web3 libraries
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Ignore missing optional dependencies commonly found in WalletConnect/Wagmi
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    return config;
  },
};

module.exports = nextConfig;
