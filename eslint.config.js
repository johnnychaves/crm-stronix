import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Barra <Componente> usado sem import/definição — o core no-undef NÃO
      // enxerga JSX, e foi exatamente esse buraco que deixou passar o bug do
      // ícone X (hotfix #82). jsx-uses-vars evita falso "unused" em componentes.
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-vars': 'error',
    },
  },
  {
    // Funções serverless (api/) e CLIs (scripts/) rodam no Node — dão acesso a
    // process, Buffer, fetch, console, etc. Sem isto o no-undef (modo browser)
    // acusava esses globais falsamente e o lint não servia de portão real p/ o
    // backend (ex.: o código de cobrança Asaas).
    files: ['api/**/*.js', 'scripts/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
])
