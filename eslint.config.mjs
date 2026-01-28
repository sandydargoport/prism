/**
 * ============================================================================
 * PRISM - ESLint Configuration
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Configures ESLint, a tool that checks your code for errors and style issues.
 * ESLint helps maintain code quality by catching bugs and enforcing conventions.
 *
 * WHY LINTING MATTERS:
 * - Catches bugs before they hit production
 * - Enforces consistent code style across the team
 * - Prevents common JavaScript/TypeScript mistakes
 * - Improves code readability
 *
 * HOW TO RUN:
 * - Check for issues: npm run lint
 * - Auto-fix issues: npm run lint:fix
 *
 * CONFIGURATION:
 * This uses the flat config format (ESLint 9+).
 * We extend Next.js's recommended settings which include React rules.
 *
 * ============================================================================
 */

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

// Setup for ES modules (getting __dirname equivalent)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// FlatCompat allows using legacy eslintrc-style configs with flat config
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// ESLint configuration
const eslintConfig = [
  // Extend Next.js's recommended configuration
  // This includes:
  // - React rules (hooks, JSX)
  // - Next.js specific rules (Image, Link, etc.)
  // - TypeScript rules
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // Custom rule overrides
  {
    rules: {
      // =====================================================================
      // RELAXED RULES (for educational codebase)
      // =====================================================================
      // We relax some rules because this is meant to be readable/learnable

      // Allow console.log for debugging (we'll use proper logging in production)
      'no-console': 'off',

      // Allow unused variables prefixed with underscore (e.g., _unused)
      // Useful during development
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // =====================================================================
      // TYPESCRIPT RULES
      // =====================================================================

      // Prefer 'type' over 'interface' for consistency
      // Both work, but 'type' is more flexible
      '@typescript-eslint/consistent-type-definitions': ['warn', 'type'],

      // Require explicit return types on exported functions
      // Helps with documentation and prevents accidental return type changes
      '@typescript-eslint/explicit-function-return-type': 'off',

      // Allow 'any' type (we try to avoid it, but sometimes it's needed)
      '@typescript-eslint/no-explicit-any': 'warn',

      // =====================================================================
      // REACT RULES
      // =====================================================================

      // Require keys in lists (prevents React warnings)
      'react/jsx-key': 'error',

      // Allow JSX in .tsx files (Next.js handles this)
      'react/react-in-jsx-scope': 'off',

      // =====================================================================
      // ACCESSIBILITY RULES
      // =====================================================================
      // Important for touchscreen and screen reader support

      // Require alt text on images
      'jsx-a11y/alt-text': 'error',

      // Require ARIA roles to be valid
      'jsx-a11y/aria-role': 'error',
    },
  },

  // Ignore patterns
  {
    ignores: [
      // Build outputs
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',

      // Dependencies
      'node_modules/**',

      // Generated files
      'drizzle/**',
      '*.config.js',
      '*.config.mjs',
    ],
  },
];

export default eslintConfig;
