/**
 * ============================================================================
 * PRISM - Next.js Configuration
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * This configures Next.js, the React framework that powers Prism.
 * Here you can customize how pages are built, add image optimization,
 * configure environment variables, and more.
 *
 * WHEN TO EDIT THIS FILE:
 * - Adding external image domains (for iCloud/OneDrive photos)
 * - Enabling experimental features
 * - Adding custom headers or redirects
 * - Configuring internationalization
 *
 * DOCUMENTATION:
 * https://nextjs.org/docs/app/api-reference/next-config-js
 *
 * ============================================================================
 */

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Don't cache API routes
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 5, // 5 minutes
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ==========================================================================
  // OUTPUT MODE: Standalone
  // ==========================================================================
  // 'standalone' creates a minimal production bundle that includes only the
  // files needed to run your app. This is perfect for Docker deployments
  // because it results in smaller container images.
  //
  // The standalone output includes a custom server (server.js) that doesn't
  // require the full node_modules folder.
  // ==========================================================================
  output: 'standalone',

  // ==========================================================================
  // REACT STRICT MODE
  // ==========================================================================
  // Strict mode helps find common bugs by:
  // - Running components twice in development (to catch side effects)
  // - Warning about deprecated APIs
  // - Highlighting potential problems
  //
  // This only affects development mode, not production.
  // ==========================================================================
  reactStrictMode: true,

  // ==========================================================================
  // TRANSPILE PACKAGES
  // ==========================================================================
  // Packages that need to be transpiled by Next.js (e.g., for CSS imports)
  // ==========================================================================
  transpilePackages: ['react-grid-layout'],

  // ==========================================================================
  // IMAGE OPTIMIZATION
  // ==========================================================================
  // Next.js automatically optimizes images (resizing, format conversion, lazy
  // loading). For images from external sources (like iCloud or OneDrive), we
  // need to explicitly allow those domains.
  //
  // CUSTOMIZE: Add your photo source domains here.
  // ==========================================================================
  images: {
    // Allow images from these external domains
    remotePatterns: [
      // iCloud Photos (Apple)
      {
        protocol: 'https',
        hostname: '*.icloud.com',
      },
      // OneDrive (Microsoft)
      {
        protocol: 'https',
        hostname: '*.sharepoint.com',
      },
      {
        protocol: 'https',
        hostname: '*.live.com',
      },
      // Google (for profile photos, calendar images)
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      // Weather icons (OpenWeatherMap)
      {
        protocol: 'https',
        hostname: 'openweathermap.org',
      },
    ],
    // Image formats to use (avif and webp are smaller than jpg/png)
    formats: ['image/avif', 'image/webp'],
  },

  // ==========================================================================
  // EXPERIMENTAL FEATURES
  // ==========================================================================
  // These are newer Next.js features that may change but are useful.
  // ==========================================================================
  experimental: {
    // Server Actions allow form submissions without API routes
    // Great for simple operations like toggling a chore complete
    serverActions: {
      // Allow server actions from these origins
      allowedOrigins: ['localhost:3000'],
    },
  },

  // ==========================================================================
  // HEADERS
  // ==========================================================================
  // Custom HTTP headers added to all responses.
  // These improve security by controlling what browsers can do.
  // ==========================================================================
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          // Prevent clickjacking attacks (embedding in iframes)
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Enable XSS protection in older browsers
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Control referrer information sent to other sites
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // ==========================================================================
  // REDIRECTS
  // ==========================================================================
  // Automatically redirect users from old URLs to new ones.
  // Useful when you change page structures.
  // ==========================================================================
  async redirects() {
    return [
      // Example: Redirect old URL to new URL
      // {
      //   source: '/old-page',
      //   destination: '/new-page',
      //   permanent: true, // 301 redirect (permanent)
      // },
    ];
  },

  // ==========================================================================
  // WEBPACK CONFIGURATION
  // ==========================================================================
  // Customize the webpack bundler. Use sparingly - Next.js has good defaults.
  // ==========================================================================
  webpack: (config, { isServer }) => {
    // Example: Add custom webpack plugins or loaders here if needed

    return config;
  },

  // ==========================================================================
  // ENVIRONMENT VARIABLES
  // ==========================================================================
  // These environment variables are exposed to the browser.
  // ONLY put non-sensitive values here (they're visible in client-side code!)
  //
  // IMPORTANT: Sensitive data (API keys, secrets) should stay in .env and
  // only be accessed server-side.
  // ==========================================================================
  env: {
    // App name for display purposes
    NEXT_PUBLIC_APP_NAME: 'Prism',
    // App version
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
};

module.exports = withPWA(nextConfig);
