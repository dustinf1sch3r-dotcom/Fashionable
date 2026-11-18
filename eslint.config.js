const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const forbiddenInCore = ['react', 'react-native', 'react-native-*', 'expo', 'expo-*', '@expo/*'];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      'dist-*/*',
      'public/*',
      '.expo/*',
      'node_modules/*',
      'test-results/*',
      'playwright-report/*',
    ],
  },
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: forbiddenInCore.flatMap((name) => [name, `${name}/*`]),
              message: 'src/core must stay pure TypeScript (no React, React Native or Expo).',
            },
          ],
        },
      ],
    },
  },
]);
