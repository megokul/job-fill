import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/**',
      'dist-e2e/**',
      'node_modules/**',
      'e2e-report/**',
      'e2e/fixtures/react-dist/**',
      'e2e/**/*.mjs',
      'scripts/**',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}', '*.ts', 'e2e/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
