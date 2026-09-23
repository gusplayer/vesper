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
    // `server/*` is the backend (ADR-0033) and `web/*` the invite page (ADR-0034):
    // neither is the app, and neither goes through Metro.
    ignores: ['dist/*', 'coverage/*', 'android/*', 'ios/*', 'node_modules/*', 'targets/*', 'modules/*/android/*', 'server/*', 'web/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // React Compiler rules from eslint-config-expo, every site reviewed: an impure call,
      // a ref read in render, a setState in an effect or a mutated prop fails the lint.
      'react-hooks/refs': 'error',
      'react-hooks/purity': 'error',
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/immutability': 'error',
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
            // The three i18n patterns are one rule in three shapes: the barrel itself,
            // a namespace file ('../i18n/es'), and anything under one. '**/i18n/*/**'
            // alone let `import { es } from '../i18n/es'` through, which is how the
            // Spanish dictionary ended up inside domain/reminders.ts as a value.
            { group: ['**/db/**', '**/data/**', '**/platform/**', '**/i18n', '**/i18n/*', '**/i18n/*/**'], message: 'The domain receives data and strings by parameter.', allowTypeImports: true },
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
