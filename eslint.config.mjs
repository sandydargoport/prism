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

  // React Compiler rules, new as errors in eslint-config-next 16 via
  // eslint-plugin-react-hooks v6. They report 172 findings across 112 files on
  // the tree as it stands, so they are warnings here: the Next 16 upgrade is
  // not the place to make 112 files of behavioural changes sight unseen.
  //
  // These are NOT noise to be silenced. set-state-in-effect in particular
  // describes a pattern this codebase has been bitten by before (per-display
  // preferences loading after mount, so the first paint renders the wrong
  // thing and then undoes it). They want working through deliberately, then
  // promoting back to error.
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },

  {
    ignores: [
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',
      'node_modules/**',
      'drizzle/**',
      '*.config.js',
      '*.config.mjs',
    ],
  },
];

export default eslintConfig;
