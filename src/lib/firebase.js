// Firebase init + collection path constants for the Stronix CRM.
// Centralized here so other modules can import without touching the
// App.jsx. The original initialization stays the same — single Firestore
// instance for the whole app.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC641_wb--R8B4SklAIQjXWSLp8egz9U-E",
  authDomain: "crm-stronix.firebaseapp.com",
  projectId: "crm-stronix",
  storageBucket: "crm-stronix.firebasestorage.app",
  messagingSenderId: "963219155705",
  appId: "1:963219155705:web:42aa0decf0d942dc779028",
  measurementId: "G-4XDH5H2VY0"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Tenant / namespace
export const appId = "stronix-crm-app";

// Firestore collection paths under /artifacts/{appId}/public/data/
export const LEADS_PATH = 'stronix_leads';
export const INTERACTIONS_PATH = 'stronix_interactions';
export const USERS_PATH = 'stronix_users';
export const SOURCES_PATH = 'stronix_sources';
export const STATUSES_PATH = 'stronix_statuses';
export const TAGS_PATH = 'stronix_tags';
export const LOSS_REASONS_PATH = 'stronix_loss_reasons';
export const FUNNELS_PATH = 'stronix_funnels';
