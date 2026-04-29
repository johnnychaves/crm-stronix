import admin from 'firebase-admin';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId) throw new Error('FIREBASE_ADMIN_PROJECT_ID ausente');
if (!clientEmail) throw new Error('FIREBASE_ADMIN_CLIENT_EMAIL ausente');
if (!privateKey) throw new Error('FIREBASE_ADMIN_PRIVATE_KEY ausente');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export { admin };