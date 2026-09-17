// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * The layers of docs/ARCHITECTURE.md as lint rules: the domain knows nothing of React
 * or the database, screens and features never see tokens or SQL, and calendar
 * arithmetic lives in one place (a day is not always 24 h).
 */
module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', 'android/*', 'ios/*', 'node_modules/*', 'targets/*', 'modules/*/android/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // React Compiler rules from eslint-config-expo: kept visible as warnings until
      // each site is reviewed; a new violation should not slip in as an error-free lint.
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator=/^[+-]$/] > BinaryExpression[operator='*'] > Identifier[name='DAY']",
          message: 'A day is not always 24 h. Use dayStartShifted/atMinuteOfDay from domain/day.',
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      // Types may cross (the dictionary shape, `Strings`); values may not.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-native', 'expo*', 'expo-*'], message: 'The domain has no UI or native dependencies.', allowTypeImports: true },
            { group: ['**/db/**', '**/data/**', '**/platform/**', '**/i18n/*/**'], message: 'The domain receives data and strings by parameter.', allowTypeImports: true },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    // The root layout hosts the theme provider; every other screen only uses components.
    ignores: ['src/app/_layout.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/design/tokens', '**/design/theme', '**/design/useTheme'], message: 'Screens only use components from design/components (CLAUDE.md rule 3).' },
            { group: ['**/db/client', '**/db/repositories/**', '**/db/queries/**'], message: 'Screens talk to the hooks in src/data only.' },
            { group: ['react-native'], importNames: ['StyleSheet', 'Pressable'], message: 'Styles and tappables live in design/components.' },
          ],
        },
      ],
    },
  },
]);
