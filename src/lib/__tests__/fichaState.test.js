// Estados da ficha aberta por endereço. O hook (useProfileLead) e a rota
// (LeadProfileRoute) só ligam fios: tudo que decide o que aparece na tela
// mora aqui e roda em node, sem Firebase e sem jsdom.
import { describe, it, expect } from 'vitest';
import {
  profileSubscriptionKey,
  nextProfileSnap,
  profileStatusFor,
  resolveFichaView,
} from '../fichaState.js';

const LEAD = { id: 'AbC123xyz', name: 'Ana Duarte' };
const KEY = profileSubscriptionKey({ sessionKey: 'acad:u1', leadId: 'AbC123xyz', attempt: 0 });

describe('profileSubscriptionKey', () => {
  it('junta sessão, id e tentativa num texto só', () => {
    expect(KEY).toBe(JSON.stringify(['acad:u1', 'AbC123xyz', 0]));
  });

  it('é null sem sessão: a assinatura espera o login terminar', () => {
    for (const sessionKey of [null, undefined, '']) {
      expect(profileSubscriptionKey({ sessionKey, leadId: 'AbC123xyz', attempt: 0 })).toBeNull();
    }
  });

  it('é null com id inválido: o doc() nunca recebe caminho quebrado', () => {
    for (const leadId of [null, undefined, '', 'a/b', '.', '..', '__x__', 'x'.repeat(129)]) {
      expect(profileSubscriptionKey({ sessionKey: 'acad:u1', leadId, attempt: 0 })).toBeNull();
    }
  });

  it('muda quando muda a sessão, o id ou a tentativa', () => {
    const base = { sessionKey: 'acad:u1', leadId: 'AbC123xyz', attempt: 0 };
    expect(profileSubscriptionKey({ ...base, sessionKey: 'outra:u1' })).not.toBe(KEY);
    expect(profileSubscriptionKey({ ...base, leadId: 'Outro99' })).not.toBe(KEY);
    expect(profileSubscriptionKey({ ...base, attempt: 1 })).not.toBe(KEY);
  });

  it('não confunde sessão e id que formariam o mesmo texto emendados', () => {
    const a = profileSubscriptionKey({ sessionKey: 'acad:u1', leadId: 'x', attempt: 0 });
    const b = profileSubscriptionKey({ sessionKey: 'acad', leadId: 'u1:x', attempt: 0 });
    expect(a).not.toBe(b);
  });
});

describe('nextProfileSnap', () => {
  it('doc presente fica pronto', () => {
    expect(nextProfileSnap(null, KEY, LEAD)).toEqual({ key: KEY, status: 'ready', lead: LEAD });
  });

  it('doc que nunca existiu é "não encontrada"', () => {
    expect(nextProfileSnap(null, KEY, null)).toEqual({ key: KEY, status: 'missing', lead: null });
  });

  it('doc que some com a ficha aberta é "excluída" e guarda o último lead para o Voltar', () => {
    const shown = nextProfileSnap(null, KEY, LEAD);
    expect(nextProfileSnap(shown, KEY, null)).toEqual({ key: KEY, status: 'deleted', lead: LEAD });
  });

  it('continua "excluída" em mais um aviso de doc ausente', () => {
    const deleted = { key: KEY, status: 'deleted', lead: LEAD };
    expect(nextProfileSnap(deleted, KEY, null)).toEqual(deleted);
  });

  it('doc ausente depois de outra ficha pronta é "não encontrada", nunca "excluída"', () => {
    const other = profileSubscriptionKey({ sessionKey: 'acad:u1', leadId: 'Outro99', attempt: 0 });
    const prev = { key: other, status: 'ready', lead: { id: 'Outro99' } };
    expect(nextProfileSnap(prev, KEY, null)).toEqual({ key: KEY, status: 'missing', lead: null });
  });

  it('continua "não encontrada" se o doc segue ausente', () => {
    const prev = { key: KEY, status: 'missing', lead: null };
    expect(nextProfileSnap(prev, KEY, null)).toEqual({ key: KEY, status: 'missing', lead: null });
  });

  it('doc que volta (exclusão recusada pelo servidor) fica pronto de novo', () => {
    const deleted = { key: KEY, status: 'deleted', lead: LEAD };
    const back = { ...LEAD, name: 'Ana Duarte Silva' };
    expect(nextProfileSnap(deleted, KEY, back)).toEqual({ key: KEY, status: 'ready', lead: back });
  });

  it('doc ausente só no cache é erro de conexão, não não encontrada', () => {
    // Sem internet, o Firestore responde do cache com o doc ausente. O servidor
    // ainda não disse que ele não existe: é o painel "Não deu para abrir a ficha".
    expect(nextProfileSnap(null, KEY, null, { fromCache: true })).toEqual({ key: KEY, status: 'error', lead: null });
    const other = profileSubscriptionKey({ sessionKey: 'acad:u1', leadId: 'Outro99', attempt: 0 });
    const otherReady = { key: other, status: 'ready', lead: { id: 'Outro99' } };
    expect(nextProfileSnap(otherReady, KEY, null, { fromCache: true })).toEqual({ key: KEY, status: 'error', lead: null });
    // Com esta ficha já na tela, o doc que some continua sendo "excluída".
    const shown = nextProfileSnap(null, KEY, LEAD);
    expect(nextProfileSnap(shown, KEY, null, { fromCache: true })).toEqual({ key: KEY, status: 'deleted', lead: LEAD });
    // Doc que está no cache abre normalmente.
    expect(nextProfileSnap(null, KEY, LEAD, { fromCache: true })).toEqual({ key: KEY, status: 'ready', lead: LEAD });
  });
});

describe('profileStatusFor', () => {
  const ready = { key: KEY, status: 'ready', lead: LEAD };

  it('id inválido é "invalid" mesmo sem sessão', () => {
    expect(profileStatusFor({ leadId: 'a/b', sessionKey: null, key: null, snap: null })).toBe('invalid');
    expect(profileStatusFor({ leadId: null, sessionKey: 'acad:u1', key: null, snap: null })).toBe('invalid');
  });

  it('sem sessão é "waiting"', () => {
    expect(profileStatusFor({ leadId: 'AbC123xyz', sessionKey: null, key: null, snap: null })).toBe('waiting');
  });

  it('sem resposta ainda é "loading"', () => {
    expect(profileStatusFor({ leadId: 'AbC123xyz', sessionKey: 'acad:u1', key: KEY, snap: null })).toBe('loading');
  });

  it('resposta de outra chave é "loading" e nunca mostra o lead velho', () => {
    const cases = [
      { sessionKey: 'outra:u9', leadId: 'AbC123xyz', attempt: 0 }, // sessão anterior
      { sessionKey: 'acad:u1', leadId: 'AbC123xyz', attempt: 1 }, // tentativa anterior
      { sessionKey: 'acad:u1', leadId: 'Outro99', attempt: 0 }, // id anterior
    ];
    for (const c of cases) {
      const key = profileSubscriptionKey(c);
      expect(profileStatusFor({ leadId: c.leadId, sessionKey: c.sessionKey, key, snap: ready })).toBe('loading');
    }
  });

  it('resposta da mesma chave manda o status dela', () => {
    for (const status of ['ready', 'missing', 'deleted', 'error']) {
      const snap = { key: KEY, status, lead: status === 'ready' ? LEAD : null };
      expect(profileStatusFor({ leadId: 'AbC123xyz', sessionKey: 'acad:u1', key: KEY, snap })).toBe(status);
    }
  });
});

describe('resolveFichaView', () => {
  const ALL = ['invalid', 'waiting', 'loading', 'ready', 'missing', 'deleted', 'error'];

  it('"Excluindo a ficha" ganha de qualquer status', () => {
    for (const status of ALL) {
      expect(resolveFichaView({ status, dataReady: true, deleting: true })).toBe('deleting');
      expect(resolveFichaView({ status, dataReady: false, deleting: true })).toBe('deleting');
    }
  });

  it('id inválido e doc ausente mostram "não encontrada" sem esperar a carga', () => {
    expect(resolveFichaView({ status: 'invalid', dataReady: false, deleting: false })).toBe('missing');
    expect(resolveFichaView({ status: 'missing', dataReady: false, deleting: false })).toBe('missing');
  });

  it('excluída e erro aparecem sem esperar a carga', () => {
    expect(resolveFichaView({ status: 'deleted', dataReady: false, deleting: false })).toBe('deleted');
    expect(resolveFichaView({ status: 'error', dataReady: false, deleting: false })).toBe('error');
  });

  it('ficha pronta só aparece com os catálogos da academia carregados', () => {
    expect(resolveFichaView({ status: 'ready', dataReady: false, deleting: false })).toBe('loading');
    expect(resolveFichaView({ status: 'ready', dataReady: true, deleting: false })).toBe('ready');
  });

  it('esperando sessão ou resposta é "loading", com ou sem carga', () => {
    for (const status of ['waiting', 'loading']) {
      expect(resolveFichaView({ status, dataReady: true, deleting: false })).toBe('loading');
      expect(resolveFichaView({ status, dataReady: false, deleting: false })).toBe('loading');
    }
  });

  it('nunca devolve "ready" para status que não é "ready"', () => {
    for (const status of ALL.filter((s) => s !== 'ready')) {
      expect(resolveFichaView({ status, dataReady: true, deleting: false })).not.toBe('ready');
    }
  });
});
