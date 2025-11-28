import {defineConfig} from 'eslint/config';
import eslintConfig from '@monholm/eslint-config';

export default defineConfig(
  eslintConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ['dist'],
  },
);
