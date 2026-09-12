const { buildSecurityHeaders } = require('./src/lib/utils/securityHeaders');

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // No runtime caching of /api responses. The previous NetworkFirst rule on
  // /^https:\/\/.*\/api\/.*/i persisted every authenticated API GET (messages,
  // family, tokens, mapboxToken, audit-logs, …) into Cache Storage on disk,
  // with no cacheableResponse filter and no clearing on logout — on a shared
  // kiosk that data outlived the session. Static assets are still handled by
  // next-pwa's precache; dynamic API data is intentionally never cached.
  runtimeCaching: [],
  // Keep the colour-emoji font OUT of the precache manifest.
  //
  // next-pwa builds that manifest from everything in the build, which swept in
  // all ten Noto Color Emoji chunks — ~3.8 MB downloaded on service-worker
  // install, on every client, unconditionally. That silently undid the design
  // in src/app/layout.tsx: the font is split by unicode-range precisely so a
  // display fetches only the chunks for emoji it actually renders. The CSS did
  // that correctly and the service worker then grabbed the lot anyway.
  //
  // Excluded here rather than removed: the emoji still resolve, they are just
  // fetched on demand the way the stylesheet already intended. Scoped to the
  // emoji font by name so ordinary text fonts keep their precache.
  buildExcludes: [/noto-color-emoji.*\.woff2$/],
  // Same reasoning for MapLibre's worker chunks (public/maplibre, written by
  // scripts/copy-maplibre-worker.mjs). They are ~500 kB and are only ever
  // fetched by the travel globe; precaching them would download the pair onto
  // every display on service-worker install, including ones that never open
  // Travel. MapLibre requests the worker itself when a map is created.
  //
  // These live in public/, which next-pwa globs separately from the webpack
  // build, so they need publicExcludes rather than buildExcludes. The default
  // value is ['!noprecache/**/*'] and is repeated here so it is not dropped.
  // Twemoji is the same story again, and the biggest instance of it. The set is
  // 3846 SVGs totalling 18MB, and it was 91% of the precache manifest: every
  // service-worker install had the display fetch all of it, as 3846 separate
  // requests, before settling. A deploy invalidates the worker, so a thin
  // client paid that on every deploy, which reads as "the machine is slow".
  //
  // A page renders a few dozen emoji, not 3846. They are <img> tags
  // (components/ui/Emoji.tsx) and the browser caches them normally on first
  // use, which is the same on-demand behaviour the Noto font exclusion above
  // restored. The trade is that emoji not yet seen will not render with no
  // network at all; the displays are always-on and wired, and 18MB on every
  // install is the worse end of that bargain.
  publicExcludes: ['!noprecache/**/*', '!maplibre/**/*', '!twemoji/**/*'],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 writes AGENTS.md and CLAUDE.md into the repo root on dev/build.
  // CLAUDE.md here is gitignored and holds this project's own rules, so that
  // generation would quietly replace a file with no copy in git. Off.
  agentRules: false,

  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['undici'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.icloud.com' },
      { protocol: 'https', hostname: '*.sharepoint.com' },
      { protocol: 'https', hostname: '*.live.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'openweathermap.org' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', '@radix-ui/react-dropdown-menu', '@radix-ui/react-dialog', '@radix-ui/react-select'],
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: buildSecurityHeaders(),
      },
    ];
  },

  async redirects() {
    return [];
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)), 'undici'];
    }
    return config;
  },

  env: {
    NEXT_PUBLIC_APP_NAME: 'Prism',
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version,
  },
};

module.exports = withBundleAnalyzer(withPWA(nextConfig));
