// A página pública da pesquisa de NPS dos alunos (/avaliar/<academia>/<código>,
// spec 2026-11-24-perfil-do-professor e plano
// docs/superpowers/plans/2026-11-25-perfil-do-professor-05-pagina-publica.md).
// Três ações POST na api/tenant-resolve.js, a única função pública, para não
// gastar função da Vercel:
//   { action: 'nps-info', slug, code } → marca, professor e perguntas
//   { action: 'nps-check', slug, code, cpf } → primeiro nome do aluno ou o motivo
//   { action: 'nps-answer', slug, code, cpf, notas, comentario, website }
// Link inválido (academia fora do ar, sem o módulo, código desconhecido) tem
// uma resposta só, para a página não revelar que o recurso existe. O CPF não
// é gravado nem vai ao log ou ao Sentry.
import { adminDb, admin } from './_firebaseAdmin.js';
import { dataCollection } from './_auth.js';
import { checkRateLimit, clientIp } from './_rateLimit.js';
import { captureError } from './_sentry.js';
import { diaDeBrasilia, isoDoDia } from './_horarioDeBrasilia.js';
import { TENANT_SLUG_READ_RE, isReservedTenantSlug } from '../src/lib/tenantSlug.js';
import { hasModule, MODULES } from '../src/lib/modules.js';
import { isValidCpf } from '../src/lib/brazilLookups.js';
import { normalizeContracts } from '../src/lib/operacional/base.js';
import { carteiraAt } from '../src/lib/professor/carteira.js';
import { somarResposta } from '../src/lib/professor/nps.js';
import { recebeRespostas } from '../src/lib/professor/pesquisas.js';

export const NPS_ACTIONS = Object.freeze(['nps-info', 'nps-check', 'nps-answer']);
export const isNpsAction = (a) => NPS_ACTIONS.includes(a);

// Conferência e resposta levam no mínimo isto, para o tempo não dizer se o CPF
// existe. O 429 e o 400 de formato saem na hora: dependem só do pedido.
export const NPS_MIN_MS = 1200;
export const COMENTARIO_MAX = 500;
const CODE_RE = /^[a-km-np-z2-9]{10}$/;
const LINK = { ok: false, motivo: 'link' };

const PROFESSORES = 'stronix_professores';
const PESQUISAS = 'stronix_nps_pesquisas';
const RESPOSTAS = 'stronix_nps_respostas';
const TOTAIS = 'stronix_nps_totais';
const LEADS = 'stronix_leads';
const CONTRATOS = 'stronix_contratos';
const PLANOS = 'stronix_planos';
const MODALIDADES = 'stronix_modalities';

const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';
const soDigitos = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 20);
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
const hojeEmBrasilia = (agora) => isoDoDia(diaDeBrasilia(agora));

// Academia ativa com o módulo e um único professor ativo com o código, ou null.
export async function resolverLink(slugRaw, codeRaw) {
  const slug = String(slugRaw || '').trim().toLowerCase();
  const code = String(codeRaw || '').trim();
  if (!TENANT_SLUG_READ_RE.test(slug) || isReservedTenantSlug(slug) || !CODE_RE.test(code)) return null;
  const tSnap = await adminDb.collection('tenants').doc(slug).get();
  if (!tSnap.exists) return null;
  const tenant = tSnap.data() || {};
  if (tenant.archived === true || tenant.status === 'suspended' || !hasModule(tenant, MODULES.FALTOSOS)) return null;
  const ps = await dataCollection(slug, PROFESSORES).where('npsCode', '==', code).limit(2).get();
  const profs = ps.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.ativo !== false);
  return profs.length === 1 ? { slug, tenant, professor: profs[0] } : null;
}

// A pesquisa que recebe resposta hoje (dia de Brasília) e tem turma do professor.
async function pesquisaAberta(slug, profId, agora) {
  const hoje = hojeEmBrasilia(agora);
  const snap = await dataCollection(slug, PESQUISAS).where('situacao', '==', 'aberta').get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => recebeRespostas(p, hoje) && Number(p.turmas?.[profId]) > 0)
    .sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)))[0] ?? null;
}

// O lead com o CPF que está na carteira em vigor do professor agora, ou null.
async function alunoDaCarteira(slug, professor, cpf, agora) {
  const ls = await dataCollection(slug, LEADS).where('cpfDigits', '==', cpf).limit(10).get();
  const leads = ls.docs.map((d) => ({ id: d.id, ...d.data() })).filter((l) => l.professorId === professor.id);
  if (!leads.length) return null;
  const [contratosSnaps, planosSnap] = await Promise.all([
    Promise.all(leads.map((l) => dataCollection(slug, CONTRATOS).where('leadId', '==', l.id).get())),
    dataCollection(slug, PLANOS).get(),
  ]);
  const contratos = normalizeContracts(contratosSnaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))));
  const planos = planosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return carteiraAt({ leads, contratos, planos, professor, data: agora }).find((a) => a.estado === 'vigente')?.lead ?? null;
}

const respostaRef = (slug, pesquisaId, leadId) => dataCollection(slug, RESPOSTAS).doc(`${pesquisaId}_${leadId}`);

// As notas cobrem exatamente as perguntas, inteiras de 0 a 10.
export function notasValidas(notas, perguntas) {
  if (!notas || typeof notas !== 'object' || Array.isArray(notas)) return false;
  const ids = (perguntas || []).map((q) => q.id);
  return Object.keys(notas).length === ids.length
    && ids.every((id) => Number.isInteger(notas[id]) && notas[id] >= 0 && notas[id] <= 10);
}

async function limitar(req, acao, slug, code) {
  const [ip, link] = await Promise.all([
    checkRateLimit(`${acao}:${clientIp(req)}`, { limit: 60, windowMs: 10 * 60 * 1000 }),
    checkRateLimit(`${acao}:link:${String(slug ?? '').slice(0, 64)}:${String(code ?? '').slice(0, 16)}`, { limit: 150, windowMs: 60 * 60 * 1000 }),
  ]);
  return ip.ok && link.ok;
}

// O erro inesperado sobe sem dado pessoal: a mensagem do Firestore pode trazer
// o CPF da consulta. A pilha fica, sem a primeira linha.
async function falhou(err, req, res, acao) {
  const limpo = new Error(`nps ${acao} falhou (${err?.code ?? 'sem código'})`);
  limpo.stack = `${limpo.message}\n${String(err?.stack || '').split('\n').slice(1).join('\n')}`;
  console.error(limpo.message);
  await captureError(limpo, req);
  return res.status(500).json({ error: 'Não deu para continuar agora. Tente de novo em instantes.' });
}

async function info(req, res) {
  const rl = await checkRateLimit(`nps-info:${clientIp(req)}`, { limit: 60, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) return res.status(429).json({ error: 'Muitas tentativas. Aguarde um momento.' });
  try {
    const link = await resolverLink(req.body?.slug, req.body?.code);
    if (!link) return res.status(200).json({ found: false });
    const { slug, tenant, professor } = link;
    const [pesquisa, modsSnap] = await Promise.all([
      pesquisaAberta(slug, professor.id, new Date()),
      dataCollection(slug, MODALIDADES).get(),
    ]);
    const minhas = new Set(professor.modalidadeIds || []);
    const modalidades = modsSnap.docs.filter((d) => minhas.has(d.id)).map((d) => d.data()?.name).filter(Boolean);
    return res.status(200).json({
      found: true,
      academia: tenant.displayName || slug,
      logoUrl: tenant.settings?.logoUrl || null,
      professor: { nome: primeiroNome(professor.nome), photoUrl: professor.photoUrl || null, modalidades },
      pesquisa: pesquisa ? { perguntas: (pesquisa.perguntas || []).map((q) => ({ id: q.id, texto: q.texto })) } : null,
    });
  } catch (err) {
    return falhou(err, req, res, 'info');
  }
}

// O que a conferência e a resposta checam juntas. Devolve { recusa } ou o contexto.
async function conferir(body, agora) {
  const link = await resolverLink(body?.slug, body?.code);
  if (!link) return { recusa: LINK };
  const pesquisa = await pesquisaAberta(link.slug, link.professor.id, agora);
  if (!pesquisa) return { recusa: { ok: false, motivo: 'fechada' } };
  const aluno = await alunoDaCarteira(link.slug, link.professor, soDigitos(body?.cpf), agora);
  if (!aluno) return { recusa: { ok: false, motivo: 'fora' } };
  return { ...link, pesquisa, aluno };
}

async function comPiso(trabalho) {
  const inicio = Date.now();
  try {
    return await trabalho();
  } finally {
    const falta = NPS_MIN_MS - (Date.now() - inicio);
    if (falta > 0) await dormir(falta);
  }
}

async function check(req, res) {
  const { slug, code } = req.body || {};
  if (!(await limitar(req, 'nps-check', slug, code))) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
  if (!isValidCpf(soDigitos(req.body?.cpf))) return res.status(400).json({ ok: false, motivo: 'cpf' });
  return comPiso(async () => {
    try {
      const c = await conferir(req.body, new Date());
      if (c.recusa) return res.status(200).json(c.recusa);
      const ja = await respostaRef(c.slug, c.pesquisa.id, c.aluno.id).get();
      if (ja.exists) return res.status(200).json({ ok: false, motivo: 'ja' });
      return res.status(200).json({ ok: true, nome: primeiroNome(c.aluno.name) });
    } catch (err) {
      return falhou(err, req, res, 'check');
    }
  });
}

async function answer(req, res) {
  const { slug, code } = req.body || {};
  if (!(await limitar(req, 'nps-answer', slug, code))) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
  if (!isValidCpf(soDigitos(req.body?.cpf))) return res.status(400).json({ ok: false, motivo: 'cpf' });
  const comentario = typeof req.body?.comentario === 'string' ? req.body.comentario.trim() : '';
  if (comentario.length > COMENTARIO_MAX) return res.status(400).json({ ok: false, motivo: 'comentario' });
  return comPiso(async () => {
    // Campo invisível preenchido: robô. Sucesso sem gravar nada.
    if (String(req.body?.website || '').trim()) return res.status(200).json({ ok: true });
    try {
      const c = await conferir(req.body, new Date());
      if (c.recusa) return res.status(200).json(c.recusa);
      const notas = req.body?.notas;
      if (!notasValidas(notas, c.pesquisa.perguntas)) return res.status(400).json({ ok: false, motivo: 'notas' });
      const resp = respostaRef(c.slug, c.pesquisa.id, c.aluno.id);
      const tot = dataCollection(c.slug, TOTAIS).doc(`${c.pesquisa.id}_${c.professor.id}`);
      const agoraTs = admin.firestore.FieldValue.serverTimestamp();
      const gravou = await adminDb.runTransaction(async (tx) => {
        const jaSnap = await tx.get(resp);
        const totSnap = await tx.get(tot);
        if (jaSnap.exists) return false;
        tx.create(resp, {
          pesquisaId: c.pesquisa.id,
          professorId: c.professor.id,
          leadId: c.aluno.id,
          nome: String(c.aluno.name || '').trim(),
          notas,
          comentario,
          criadaEm: agoraTs,
        });
        tx.set(tot, {
          ...somarResposta(totSnap.exists ? totSnap.data() : {}, notas),
          pesquisaId: c.pesquisa.id,
          professorId: c.professor.id,
          turma: Number(c.pesquisa.turmas[c.professor.id]) || 0,
          atualizadoEm: agoraTs,
        });
        return true;
      });
      return res.status(200).json(gravou ? { ok: true } : { ok: false, motivo: 'ja' });
    } catch (err) {
      return falhou(err, req, res, 'answer');
    }
  });
}

export function handleNps(req, res) {
  const acao = req.body?.action;
  if (acao === 'nps-info') return info(req, res);
  if (acao === 'nps-check') return check(req, res);
  return answer(req, res);
}
