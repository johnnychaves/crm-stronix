import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { initSentry } from './lib/sentry.js'
import App from './App.jsx'
import './index.css'

// Antes do render, para que erro durante o boot da árvore seja capturado.
initSentry()

// React 19 expõe três ganchos de erro no createRoot. Sem eles, erro capturado
// por ErrorBoundary não chega ao Sentry, porque o React o considera tratado.
ReactDOM.createRoot(document.getElementById('root'), {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
