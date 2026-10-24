// eslint-config-next 16 ships native flat config, so the shareable configs are
// imported and spread directly. Going through FlatCompat (which is how this
// file read under Next 15) now throws "Converting circular structure to JSON"
// while validating the legacy schema, which is what made `next lint` unusable
// on 16. `next lint` itself is gone in 16; package.json calls eslint directly.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['warn', 'type'],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/jsx-key': 'error',
      'react/react-in-jsx-scope': 'off',
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-role': 'error',
    },
  },

  // Node scripts are CommonJS and are meant to use require().  `next lint` never
  // looked at them; running eslint directly does.
  {
    files: ['scripts/**/*.js', '*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // React Compiler rules from eslint-plugin-react-hooks v6. They arrived with
  // 172 findings and were worked through one rule at a time (#447); all are
  // errors now, so a fixed pattern cannot slip back. set-state-in-effect in
  // particular is a pattern this codebase has been bitten by before (state
  // set after mount, so the first paint renders the wrong thing and then
  // undoes it).
  {
    rules: {
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/purity': 'error',
      'react-hooks/use-memo': 'error',
      'react-hooks/preserve-manual-memoization': 'error',
    },
  },

  {
    // `next lint` only ever walked the source directories. Calling eslint
    // directly (Next 16 removed `next lint`) walks everything, and flat config
    // does not read .gitignore, so generated and vendored output now needs
    // naming here or a local `npm run lint` fails on third-party minified JS
    // that was never ours to lint.
    ignores: [
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',
      'node_modules/**',
      'drizzle/**',
      // mkdocs writes the built docs site here, bundled lunr/glightbox and all.
      'site/**',
      // Build output that lands in public/: the next-pwa service worker and its
      // workbox runtime, and the MapLibre worker copied in by
      // scripts/copy-maplibre-worker.mjs.
      'public/sw.js',
      'public/workbox-*.js',
      'public/maplibre/**',
      // Test and coverage artefacts.
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '*.config.js',
      '*.config.mjs',
    ],
  },
];

export default eslintConfig;
