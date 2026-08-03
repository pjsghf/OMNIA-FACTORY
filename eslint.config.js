import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // The codebase already marks deliberately-unused bindings with a leading
      // underscore (Express error-handler arity, destructuring to omit a field).
      // Encode that convention here rather than scattering per-line disables.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-console': 'off',
      'no-undef': 'off',
      'no-useless-escape': 'warn',
      'no-useless-assignment': 'warn',
      'prefer-const': 'warn',
      'preserve-caught-error': 'off',
    },
  }
);
