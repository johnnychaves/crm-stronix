import { randomUUID } from 'node:crypto';
import { adminDb, admin, verifyRequest } from './_firebaseAdmin.js';
import { getSeatUsage, canAddSeat } from './_plans.js';
import { isTenantAdmin } from './_auth.js';
import { professorLinkRefusal } from './_professorLink.js';
import { ROLES } from '../src/lib/acesso.js';
import { professorIdProblem } from '../src/lib/teamRoles.js';
import { withSentry } from './_sentry.js';

// Cria um convite para adicionar um usuário (gestor, consultor ou professor)
// ao tenant. ADMIN do tenant only. Vercel serverless function.
//
// POST body: { email, role, professorId?, allowExtra? }
//   role: 'admin' | 'consultant' | 'professor' (outro valor vira consultor)
//   professorId: obrigatório no professor, id em stronix_professores
// Retorna { inviteId, token, tenantId, expiresAt } — o app monta o link
// /?invite=<token>&t=<tenantId> e o admin envia ao convidado.
//
// Professor só com o módulo Professor e faltosos ligado e com um professor
// ativo do cadastro, sem outro login (api/_professorLink.js). O convite guarda
// o professorId, e o aceite confere tudo de novo.

const INVITE_ROLES = [ROLES.GESTOR, ROLES.CONSULTOR, ROLES.PROFESSOR];
const INVITE_TTL_DAYS = 7;

const invitesCollection = (tenantId) =>
  adminDb.collection('tenants').doc(tenantId).collection('invites');

export default withSentry(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const auth = await verifyRequest(req);
    if (!auth || !auth.tenantId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const isAdmin = await isTenantAdmin(auth.tenantId, auth.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Apenas o master pode convidar usuários.' });
    }

    const { email, role, allowExtra, professorId } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = INVITE_ROLES.includes(role) ? role : ROLES.CONSULTOR;
    const asProfessor = normalizedRole === ROLES.PROFESSOR;

    if (!normalizedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    if (asProfessor) {
      const bad = professorIdProblem(professorId);
      if (bad) return res.status(bad.status).json({ error: bad.error });
    }

    // Vagas por PAPEL do convite: gestor além do incluso → upgrade; consultor
    // além do incluso pode entrar como EXTRA pago, com confirmação do admin
    // AQUI (quem aprova o custo é quem convida, não o convidado). A aprovação
    // fica gravada no convite (extraApproved) e o aceite revalida. Professor
    // não ocupa vaga, mas precisa do módulo e do professor do cadastro,
    // conferidos com a academia que o getSeatUsage já leu.
    const seats = await getSeatUsage(auth.tenantId);
    if (asProfessor) {
      const refused = await professorLinkRefusal({ tenantId: auth.tenantId, modules: seats.modules, professorId });
      if (refused) return res.status(refused.status).json({ error: refused.error });
    }
    const decision = canAddSeat(seats, normalizedRole, { allowExtra: allowExtra === true });
    if (!decision.ok) {
      if (decision.code === 'extra_confirm') {
        return res.status(409).json({
          error: decision.error,
          requiresExtraConfirmation: true,
          extraUserPrice: decision.extraUserPrice,
        });
      }
      return res.status(403).json({ error: decision.error });
    }

    const token = randomUUID();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    const ref = await invitesCollection(auth.tenantId).add({
      email: normalizedEmail,
      role: normalizedRole,
      ...(asProfessor ? { professorId } : {}),
      token,
      status: 'pending',
      expiresAt,
      extraApproved: decision.isExtra === true, // admin aceitou o custo do consultor extra
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.uid
    });

    return res.status(200).json({
      ok: true,
      inviteId: ref.id,
      token,
      tenantId: auth.tenantId,
      email: normalizedEmail,
      role: normalizedRole,
      ...(asProfessor ? { professorId } : {}),
      expiresAt: expiresAt.toMillis()
    });
  } catch (error) {
    console.error('invite-create', error);
    return res.status(500).json({ error: 'Erro interno ao criar convite.' });
  }
});
