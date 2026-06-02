// Firebase init + collection path constants for the Stronix CRM.
// Centralized here so other modules can import without touching the
// App.jsx. The original initialization stays the same — single Firestore
// instance for the whole app.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Config do Firebase Web. Os valores são PÚBLICOS (embarcam no bundle do
// cliente — apiKey de Firebase Web não é segredo). Lê de import.meta.env
// (VITE_FIREBASE_*) quando definido, com fallback para os valores do projeto
// atual — assim a app funciona mesmo sem env configurado.
const env = import.meta.env || {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyC641_wb--R8B4SklAIQjXWSLp8egz9U-E",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "crm-stronix.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "crm-stronix",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "crm-stronix.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "963219155705",
  appId: env.VITE_FIREBASE_APP_ID || "1:963219155705:web:42aa0decf0d942dc779028",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-4XDH5H2VY0"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Tenant / namespace
// Multi-tenant: `appId` é o segmento de path que isola cada academia
// (artifacts/{appId}/public/data/...). É um *live-binding* mutável: começa no
// tenant padrão e é trocado UMA vez no boot, após resolver o tenant do usuário
// (claim `tenantId` do Firebase Auth). Como todos os call sites leem `appId`
// em tempo de chamada (dentro de effects), o setter propaga pra todos sem
// editar cada um. Enquanto `setTenantId` não é chamado, comporta-se igual ao
// sistema mono-tenant de antes.
export const DEFAULT_TENANT_ID = "stronix-crm-app";
export let appId = DEFAULT_TENANT_ID;
export function setTenantId(id) {
  appId = id || DEFAULT_TENANT_ID;
}

// Firestore collection paths under /artifacts/{appId}/public/data/
export const LEADS_PATH = 'stronix_leads';
export const INTERACTIONS_PATH = 'stronix_interactions';
export const USERS_PATH = 'stronix_users';
export const SOURCES_PATH = 'stronix_sources';
export const STATUSES_PATH = 'stronix_statuses';
export const TAGS_PATH = 'stronix_tags';
export const LOSS_REASONS_PATH = 'stronix_loss_reasons';
export const FUNNELS_PATH = 'stronix_funnels';
export const MODALITIES_PATH = 'stronix_modalities';
export const UNITS_PATH = 'stronix_units';
// Config "geral" da academia — doc único (singleton) sob este path.
export const CONFIG_PATH = 'stronix_config';
export const CONFIG_GENERAL_ID = 'general';
