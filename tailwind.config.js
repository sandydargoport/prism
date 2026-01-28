/**
 * ============================================================================
 * PRISM - Tailwind CSS Configuration
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Tailwind CSS is a utility-first CSS framework. Instead of writing CSS like:
 *   .my-button { background: blue; padding: 8px; border-radius: 4px; }
 *
 * You write classes directly in HTML:
 *   <button class="bg-blue-500 p-2 rounded">
 *
 * This file customizes Tailwind for Prism's specific design needs:
 * - Custom colors for light/dark modes
 * - Touch-friendly spacing
 * - Font sizes optimized for wall-mounted displays
 * - Animation utilities for delightful interactions
 *
 * DOCUMENTATION:
 * https://tailwindcss.com/docs/configuration
 *
 * ============================================================================
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  // ==========================================================================
  // DARK MODE
  // ==========================================================================
  // 'class' means dark mode is controlled by adding a 'dark' class to the
  // <html> element, rather than using the system preference.
  // This gives us control to switch themes programmatically.
  // ==========================================================================
  darkMode: 'class',

  // ==========================================================================
  // CONTENT PATHS
  // ==========================================================================
  // Tailwind scans these files to find which CSS classes you're using.
  // Classes not found in these files are removed from the final CSS
  // (called "purging"), keeping the CSS file small.
  // ==========================================================================
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  // ==========================================================================
  // THEME CUSTOMIZATION
  // ==========================================================================
  // Extend Tailwind's default theme with Prism-specific values.
  // 'extend' means we ADD to the defaults rather than replacing them.
  // ==========================================================================
  theme: {
    extend: {
      // ========================================================================
      // COLORS - The Prism Color Palette
      // ========================================================================
      // These colors are designed for:
      // - Good contrast (accessibility)
      // - Pleasant appearance in both light and dark modes
      // - Family-friendly, warm feeling
      //
      // Usage examples:
      //   bg-primary, text-primary-foreground, border-secondary
      //
      // CUSTOMIZE: Change these to match your family's preferences!
      // Use a tool like https://coolors.co to generate palettes.
      // ========================================================================
      colors: {
        // ------------------------------------------------
        // CORE COLORS (using CSS variables for dark mode)
        // ------------------------------------------------
        // These reference CSS variables defined in globals.css
        // This allows us to change all colors by switching the dark class
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // Primary color - main brand color for buttons, links
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },

        // Secondary color - less prominent UI elements
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },

        // Destructive - for delete buttons, error states
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },

        // Muted - subtle backgrounds, disabled states
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },

        // Accent - highlights, hover states
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },

        // Popover - floating elements like dropdowns
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },

        // Card - card backgrounds
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // ------------------------------------------------
        // FAMILY MEMBER COLORS
        // ------------------------------------------------
        // Each family member gets a unique color for their calendar,
        // tasks, chores, etc. These are the defaults - customize them
        // in the settings!
        //
        // CUSTOMIZE: Change these to your family members' favorite colors!
        // ------------------------------------------------
        family: {
          member1: '#3B82F6', // Blue
          member2: '#EC4899', // Pink
          member3: '#10B981', // Green
          member4: '#F59E0B', // Orange
          member5: '#8B5CF6', // Purple
          member6: '#EF4444', // Red
        },

        // ------------------------------------------------
        // STATUS COLORS
        // ------------------------------------------------
        // For chores, tasks, and other items that have states
        // ------------------------------------------------
        status: {
          pending: '#F59E0B',   // Yellow/Orange - waiting
          approved: '#10B981', // Green - complete
          overdue: '#EF4444',  // Red - needs attention
        },

        // ------------------------------------------------
        // PRIORITY COLORS
        // ------------------------------------------------
        // For task priority indicators
        // ------------------------------------------------
        priority: {
          high: '#EF4444',    // Red
          medium: '#F59E0B',  // Orange
          low: '#3B82F6',     // Blue
        },
      },

      // ========================================================================
      // BORDER RADIUS
      // ========================================================================
      // Rounded corners make the UI feel softer and more friendly.
      // These values create consistency across all components.
      // ========================================================================
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      // ========================================================================
      // FONT FAMILY
      // ========================================================================
      // Sans-serif fonts are easier to read on screens.
      // We use the system font stack for fast loading and native feel.
      // ========================================================================
      fontFamily: {
        sans: [
          'Inter',           // Our preferred font (if loaded)
          'system-ui',       // Fallback to system font
          '-apple-system',   // Safari/iOS
          'BlinkMacSystemFont',
          'Segoe UI',        // Windows
          'Roboto',          // Android
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },

      // ========================================================================
      // FONT SIZES
      // ========================================================================
      // Larger font sizes for readability on wall-mounted displays.
      // These are optimized for viewing from a few feet away.
      //
      // CUSTOMIZE: Increase these if your display is farther from viewers.
      // ========================================================================
      fontSize: {
        // Extra small - fine print, timestamps
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        // Small - secondary text
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        // Base - body text
        'base': ['1rem', { lineHeight: '1.5rem' }],
        // Large - emphasis
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        // Extra large - subheadings
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        // 2XL - section headings
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        // 3XL - page headings
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        // 4XL - large headings (clock time)
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        // 5XL - extra large (main clock display)
        '5xl': ['3rem', { lineHeight: '1' }],
        // 6XL+ - display sizes (screensaver clock)
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },

      // ========================================================================
      // SPACING
      // ========================================================================
      // Consistent spacing creates visual rhythm.
      // These are touch-friendly sizes (minimum 44px touch targets).
      // ========================================================================
      spacing: {
        // Touch-friendly sizes
        'touch-sm': '44px', // Minimum touch target (Apple HIG)
        'touch': '48px',    // Recommended touch target (Material Design)
        'touch-lg': '60px', // Large touch target for primary actions
      },

      // ========================================================================
      // ANIMATIONS
      // ========================================================================
      // Smooth animations make the UI feel responsive and delightful.
      // Keep animations short (200-300ms) so they don't slow users down.
      // ========================================================================
      keyframes: {
        // Accordion open/close
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        // Fade in for smooth appearances
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        // Slide up for toasts, notifications
        'slide-up': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        // Slide down for dropdowns
        'slide-down': {
          from: { transform: 'translateY(-10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        // Scale up for buttons on press
        'scale-up': {
          from: { transform: 'scale(0.95)' },
          to: { transform: 'scale(1)' },
        },
        // Spin for loading indicators
        'spin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        // Pulse for attention-grabbing elements
        'pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        // Bounce for playful animations (chore completion)
        'bounce': {
          '0%, 100%': { transform: 'translateY(-5%)', animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)' },
          '50%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' },
        },
        // Confetti for celebrations
        'confetti': {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' },
        },
        // Shake for error feedback (wrong PIN, validation errors)
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
        'slide-down': 'slide-down 0.2s ease-out',
        'scale-up': 'scale-up 0.15s ease-out',
        'spin': 'spin 1s linear infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce': 'bounce 1s infinite',
        'confetti': 'confetti 3s ease-out forwards',
        'shake': 'shake 0.5s ease-in-out',
      },

      // ========================================================================
      // SCREENS (Breakpoints)
      // ========================================================================
      // Responsive breakpoints for different screen sizes.
      // Primary target is 1920x1080, but we support tablets and phones too.
      // ========================================================================
      screens: {
        'xs': '480px',    // Small phones
        'sm': '640px',    // Large phones
        'md': '768px',    // Tablets
        'lg': '1024px',   // Small laptops
        'xl': '1280px',   // HD displays
        '2xl': '1536px',  // Large displays
        '3xl': '1920px',  // Full HD (our primary target)
      },
    },
  },

  // ==========================================================================
  // PLUGINS
  // ==========================================================================
  // Tailwind plugins add additional utilities and components.
  // ==========================================================================
  plugins: [
    // Adds animation utilities (animate-in, animate-out, etc.)
    require('tailwindcss-animate'),
  ],
};
