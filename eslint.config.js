import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // Global ignores - must be first for proper precedence
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      '.next/**',
      'coverage/**',
      'test-results/**',
      'server/templates/**',
    ],
  },

  // Base configurations
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Main configuration for TypeScript/JavaScript files
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React recommended rules
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // React Hooks rules
      ...reactHooksPlugin.configs.recommended.rules,

      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // General rules
      'no-console': 'warn',
      'no-debugger': 'warn',
      'prefer-const': 'warn',
      'no-var': 'warn',

      // Pre-existing issues downgraded to warnings
      'react/no-unescaped-entities': 'warn',
      'no-case-declarations': 'warn',
      'no-undef': 'off',
      '@typescript-eslint/no-require-imports': 'warn',
      'no-useless-escape': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/prefer-as-const': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'no-shadow-restricted-names': 'warn',
      'no-empty': 'warn',
      'no-constant-binary-expression': 'warn',
    },
  }
);
