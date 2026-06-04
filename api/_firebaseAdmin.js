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

// Verifica o Firebase ID token do header Authorization: Bearer <token>.
// Retorna { uid, tenantId, superAdmin } do token verificado, ou null se
// ausente/inválido. Substitui o padrão antigo de confiar no requesterAuthUid
// vindo do body (que não era verificado).
export async function verifyRequest(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  try {
    // checkRevoked=true: rejeita tokens já revogados (ex.: ao suspender um tenant
    // chamamos revokeRefreshTokens) sem depender da expiração natural de ~1h.
    const decoded = await adminAuth.verifyIdToken(match[1], true);
    return {
      uid: decoded.uid,
      tenantId: decoded.tenantId || null,
      superAdmin: decoded.superAdmin === true,
      impersonatedBy: decoded.impersonatedBy || null
    };
  } catch (err) {
    console.error('verifyRequest: token inválido/revogado', err?.message || err);
    return null;
  }
}