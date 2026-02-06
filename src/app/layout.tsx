/**
 * ============================================================================
 * PRISM - Root Layout
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * This is the root layout that wraps every page in the application.
 * Think of it as the HTML "shell" that contains all your pages.
 *
 * IT INCLUDES:
 * - HTML document structure (<html>, <head>, <body>)
 * - Global styles and fonts
 * - Theme provider (for dark/light mode)
 * - Metadata (title, description, etc.)
 *
 * HOW NEXT.JS LAYOUTS WORK:
 * In Next.js App Router, layouts wrap pages and persist across navigation.
 * This means the layout doesn't re-render when you navigate between pages,
 * making navigation feel instant and smooth.
 *
 * Layout Hierarchy:
 *   layout.tsx (this file - root)
 *     └── page.tsx (home page)
 *     └── calendar/
 *         └── layout.tsx (optional nested layout)
 *         └── page.tsx (calendar page)
 *
 * WHEN TO EDIT THIS FILE:
 * - Adding global providers (auth, theme, etc.)
 * - Changing fonts
 * - Updating site metadata
 * - Adding global UI elements (navigation that appears on every page)
 *
 * ============================================================================
 */

// Import global styles (including Tailwind CSS)
import '@/styles/globals.css';

// Next.js types for metadata
import type { Metadata, Viewport } from 'next';

// Inter font from Google Fonts (loaded by Next.js for performance)
// Next.js automatically optimizes font loading to prevent layout shift
import { Inter } from 'next/font/google';

// Providers (theme, auth, etc.)
import { Providers } from '@/components/providers';

// Error boundary
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Screensaver (idle detection photo slideshow)
import { Screensaver } from '@/components/screensaver/Screensaver';


/**
 * FONT CONFIGURATION
 * ============================================================================
 * We use Inter, a highly readable sans-serif font designed for screens.
 *
 * Configuration options:
 * - subsets: Which character sets to include (latin for English)
 * - variable: CSS variable name for using the font in Tailwind
 * - display: 'swap' shows fallback font immediately, then swaps when loaded
 *
 * WHY INTER:
 * - Designed specifically for computer screens
 * - Excellent readability at all sizes
 * - Open source and free to use
 * - Supports many languages
 * ============================================================================
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});


/**
 * METADATA
 * ============================================================================
 * Defines information about the website shown in browser tabs, search results,
 * and when sharing links on social media.
 *
 * This metadata is static - it's the same for all pages.
 * For page-specific metadata, add a metadata export in each page.tsx file.
 *
 * WHAT EACH FIELD DOES:
 * - title: Browser tab title (and <title> tag)
 * - description: Shown in search results and social shares
 * - keywords: Help search engines understand your content
 * - authors: Who created this site
 * - manifest: Links to PWA manifest for "Add to Home Screen"
 * - icons: Favicon and app icons
 * ============================================================================
 */
export const metadata: Metadata = {
  // Title configuration
  // 'default' is used when no page-specific title
  // 'template' is used with page titles: "Calendar | Prism"
  title: {
    default: 'Prism - Family Dashboard',
    template: '%s | Prism',
  },

  // Description for search engines and social sharing
  description:
    'Prism is your family\'s digital home. Sync calendars, manage chores, plan meals, track tasks, and stay connected—all on one beautiful touchscreen display.',

  // Keywords for SEO
  keywords: [
    'family dashboard',
    'home calendar',
    'family organization',
    'chore tracking',
    'meal planning',
    'smart home display',
    'touchscreen calendar',
  ],

  // Author information
  authors: [{ name: 'Prism Community' }],

  // App name (used when added to home screen)
  applicationName: 'Prism',

  // Generator (what built this site)
  generator: 'Next.js',

  // Robots directive (allow search engines to index)
  robots: {
    index: true,
    follow: true,
  },

  // Icons configuration
  icons: {
    icon: '/icons/icon.png',
    apple: '/icons/icon.png',
  },

  // Open Graph metadata (for social sharing on Facebook, LinkedIn, etc.)
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Prism',
    title: 'Prism - Family Dashboard',
    description: 'Your family\'s digital home',
  },

  // Twitter Card metadata (for Twitter/X sharing)
  twitter: {
    card: 'summary_large_image',
    title: 'Prism - Family Dashboard',
    description: 'Your family\'s digital home',
  },
};


/**
 * VIEWPORT CONFIGURATION
 * ============================================================================
 * Controls how the page is displayed on different devices.
 *
 * These settings are important for:
 * - Mobile responsiveness
 * - Touch screen interaction
 * - Preventing unwanted zoom/scroll behaviors
 *
 * PRISM-SPECIFIC CONSIDERATIONS:
 * - Primary display is a 1920x1080 touchscreen
 * - We disable user scaling to prevent accidental zoom
 * - Theme color affects browser chrome on mobile
 * ============================================================================
 */
export const viewport: Viewport = {
  // Width equals device width (responsive)
  width: 'device-width',

  // Initial zoom level (1 = 100%)
  initialScale: 1,

  // Prevent user zoom (important for touchscreen kiosks)
  // NOTE: This can affect accessibility. Consider enabling for non-kiosk use.
  maximumScale: 1,
  userScalable: false,

  // Theme color for browser chrome (status bar, etc.)
  // This changes based on system theme
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a2e' },
  ],
};


/**
 * ROOT LAYOUT COMPONENT
 * ============================================================================
 * The main layout component that wraps all pages.
 *
 * PROPS:
 * - children: The page content (automatically provided by Next.js)
 *
 * STRUCTURE:
 * <html>
 *   <body>
 *     {children} <- Your page content goes here
 *   </body>
 * </html>
 *
 * IMPORTANT NOTES:
 * - This is a Server Component (runs on the server)
 * - Can't use hooks or browser APIs directly
 * - For client-side features, wrap in a Client Component
 * ============================================================================
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      // Suppress hydration warnings from browser extensions
      // that might modify the HTML (password managers, etc.)
      suppressHydrationWarning
    >
      {/*
        The body element with our font applied.

        CLASSES EXPLAINED:
        - inter.variable: Adds CSS variable for Inter font
        - font-sans: Uses our sans-serif font stack
        - antialiased: Smooth font rendering
        - bg-background: Background color from theme
        - text-foreground: Text color from theme
        - min-h-screen: At least full viewport height
        - overflow-hidden: Prevent scrolling (dashboard fills screen)

        NOTE: overflow-hidden is specific to our kiosk-style dashboard.
        Remove this if you want pages to scroll.
      */}
      <body
        className={`
          ${inter.variable}
          font-sans
          antialiased
          bg-background
          text-foreground
          min-h-screen
          overflow-hidden
        `}
      >
        {/*
          PROVIDERS
          Wrap children with application providers (theme, auth, etc.)
        */}
        <ErrorBoundary>
          <Providers>
            {children}
            <Screensaver />
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
