/**
 * ============================================================================
 * PRISM - PostCSS Configuration
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * PostCSS is a tool that transforms CSS with JavaScript plugins.
 * It's the engine that makes Tailwind CSS work.
 *
 * PLUGINS:
 * - tailwindcss: Processes Tailwind's utility classes
 * - autoprefixer: Adds vendor prefixes (-webkit-, -moz-, etc.) automatically
 *
 * WHY AUTOPREFIXER:
 * Different browsers need different CSS prefixes for some properties.
 * Autoprefixer adds these automatically so you don't have to write:
 *   -webkit-transform: rotate(45deg);
 *   -ms-transform: rotate(45deg);
 *   transform: rotate(45deg);
 *
 * It just becomes: transform: rotate(45deg);
 *
 * ============================================================================
 */

module.exports = {
  plugins: {
    // Process Tailwind CSS directives (@tailwind, @apply, etc.)
    tailwindcss: {},
    // Add vendor prefixes for browser compatibility
    autoprefixer: {},
  },
};
