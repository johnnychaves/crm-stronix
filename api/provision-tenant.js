import { adminAuth, adminDb, admin, verifyRequest } from './_firebaseAdmin.js';

const USERS_PATH = 'stronix_users';
// slug do tenant: minúsculas, números e hífen; 3–40 chars; sem hífen nas pontas.
const TENANT_ID_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

const tenantsCol = () => adminDb.collection('tenants');
const usersCollection = (tenantId) =>
  adminDb
    .collection('artifacts')
    .doc(tenantId)
    .collection('public')
    .doc('data')
    .collection(USERS_PATH);

export default async function handler(req, res) {
  // Só o super-admin gerencia organizações (claim superAdmin no token verificado).
  const auth = await verifyRequest(req);
  if (!auth) return res.status(401).json({ error: 'Não autenticado.' });
  if (!auth.superAdmin) {
    return res.status(403).json({ error: 'Apenas o super-admin pode gerenciar organizações.' });
  }

  // GET → lista as organizações.
  if (req.method === 'GET') {
    try {
      const snap = await tenantsCol().get();
      const tenants = snap.docs
        .map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            displayName: data.displayName || d.id,
            status: data.status || 'active',
            primaryAdminEmail: data.primaryAdminEmail || null
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      return res.status(200).json({ tenants });
    } catch (error) {
      console.error('provision-tenant GET', error);
      return res.status(500).json({ error: 'Erro ao listar organizações.' });
    }
  }

  // POST → provisiona uma organização nova.
  if (req.method === 'POST') {
    try {
      const { tenantId, displayName, adminEmail, adminPassword, adminName } = req.body || {};

      if (!tenantId || !displayName || !adminEmail || !adminPassword || !adminName) {
        return res.status(400).json({
          error: 'Campos obrigatórios: tenantId, displayName, adminEmail, adminPassword, adminName.'
        });
      }

      const slug = String(tenantId).trim().toLowerCase();
      if (!TENANT_ID_RE.test(slug)) {
        return res.status(400).json({
          error: 'Identificador inválido. Use minúsculas, números e hífen (3–40 caracteres).'
        });
      }
      if (String(adminPassword).length < 6) {
        return res.status(400).json({ error: 'Senha precisa ter ao menos 6 caracteres.' });
      }

      const existing = await tenantsCol().doc(slug).get();
      if (existing.exists) {
        return res.status(409).json({ error: `Já existe uma organização com o identificador "${slug}".` });
      }

      const normalizedEmail = String(adminEmail).trim().toLowerCase();
      const normalizedName = String(adminName).trim();

      // 1. cria o admin no Firebase Auth
      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email: normalizedEmail,
          password: adminPassword,
          displayName: normalizedName
        });
      } catch (err) {
        if (err?.code === 'auth/email-already-exists') {
          return res.status(409).json({ error: 'Já existe uma conta com esse e-mail no Firebase Auth.' });
        }
        throw err;
      }

      // 2. claim de tenant no admin
      await adminAuth.setCustomUserClaims(userRecord.uid, { tenantId: slug });

      // 3. registro do tenant (raiz)
      await tenantsCol().doc(slug).set({
        displayName: String(displayName).trim(),
        status: 'active',
        primaryAdminUid: userRecord.uid,
        primaryAdminEmail: normalizedEmail,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.uid
      });

      // 4. doc do admin dentro do tenant
      await usersCollection(slug).doc(userRecord.uid).set({
        name: normalizedName,
        email: normalizedEmail,
        authUid: userRecord.uid,
        role: 'admin',
        tenantId: slug,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Os padrões (funil "Comercial" + etapa "Negociação") são semeados
      // automaticamente no primeiro login do admin (effect in-app, idempotente).
      return res.status(200).json({ ok: true, tenantId: slug, adminUid: userRecord.uid });
    } catch (error) {
      console.error('provision-tenant POST', error);
      return res.status(500).json({ error: 'Erro interno ao provisionar organização.' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
