// @vitest-environment jsdom
// O lápis da ficha (ClientRegistrationModal) gravava o WhatsApp sem conferir se
// o número já era de outro lead. Foi assim que nasceu a cópia da Maria Fernanda
// na Shape One (29/09/2026): o segundo lead nasceu com outro número e virou o
// número do primeiro na edição. Agora, quando o número muda, a edição confere o
// dono pela chave do telefone, como o Novo lead, e não salva se ele é de outro
// lead. Número que não mudou não é conferido: o par que já divide um número
// continua salvando o endereço.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';

const banco = vi.hoisted(() => ({ leads: [], consultas: [], gravacoes: [] }));
vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'leads' }));
vi.mock('firebase/firestore', () => ({
  collection: (...p) => ({ path: p.slice(1).join('/') }),
  doc: (...p) => ({ path: p.slice(1).join('/') }),
  where: (campo, op, valor) => ({ campo, op, valor }),
  limit: (n) => ({ n }),
  query: (col, ...partes) => ({ filtro: partes.find((p) => 'campo' in p), max: partes.find((p) => 'n' in p)?.n }),
  getDocs: async ({ filtro, max }) => {
    banco.consultas.push(`${filtro.campo}==${filtro.valor}`);
    const docs = banco.leads
      .filter((l) => l[filtro.campo] === filtro.valor)
      .slice(0, max)
      .map(({ id, ...d }) => ({ id, data: () => d }));
    return { empty: docs.length === 0, docs };
  },
  updateDoc: async (ref, dados) => { banco.gravacoes.push({ path: ref.path, dados }); },
  serverTimestamp: () => 'TS',
}));

const { ClientRegistrationModal } = await import('../../modals/ClientRegistrationModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const ANA = { id: 'ana', name: 'Ana Lima', whatsapp: '(31) 9 1111-2222', zapMatchKey: '3111112222', consultantId: 'u1', consultantName: 'Bruno' };
const GABRIEL = { id: 'gabriel', name: 'Gabriel', whatsapp: '(31) 9 7198-3969', zapMatchKey: '3171983969', consultantName: 'Eduarda de Carvalho', status: 'Negociação' };
// Par que já divide um número, de antes desta regra.
const MARIA = { id: 'mf1', name: 'Maria Fernanda', whatsapp: '(31) 9 5555-4444', zapMatchKey: '3155554444' };
const MARIA_COPIA = { id: 'mf2', name: 'Maria Fernanda Santiago', whatsapp: '(31) 9 5555-4444', zapMatchKey: '3155554444' };

let root = null;
async function abrir(lead) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast },
      h(GeneralConfigContext.Provider, { value: { professores: [], dores: [], modalities: [] } },
        h(ClientRegistrationModal, { open: true, onClose: () => {}, lead, appUser: { id: 'u1', name: 'Bruno' }, db: {}, usersList: [], tags: [] }))));
  });
}
const esperar = (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function digitarWhatsapp(valor) {
  const input = document.querySelector('input[placeholder="(51) 9 0000-0000"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, valor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // O aviso espera o debounce de 300 ms do useDuplicateLead.
  await esperar(350);
}
const salvar = () => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Salvar cadastro');

beforeEach(() => {
  banco.leads = [ANA, GABRIEL, MARIA, MARIA_COPIA];
  banco.consultas = [];
  banco.gravacoes = [];
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.clearAllMocks();
});

describe('Lápis da ficha: WhatsApp de outro lead', () => {
  it('trocar para o número de outro lead, mesmo escrito sem o nono dígito, avisa e não salva', async () => {
    await abrir(ANA);
    await digitarWhatsapp('(31) 7198-3969');

    expect(document.body.textContent).toContain('Já existe: Gabriel · Eduarda de Carvalho (Negociação)');
    await act(async () => { salvar().click(); });
    await esperar(0);
    expect(banco.gravacoes).toEqual([]);
    expect(toast.warning).toHaveBeenCalledWith('Esse WhatsApp já é de outro lead: Gabriel (consultor: Eduarda de Carvalho).');
  });

  it('de outra aba, o Salvar volta para a Identidade e mostra o aviso', async () => {
    await abrir(ANA);
    await digitarWhatsapp('(31) 9 7198-3969');
    const aba = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
    await act(async () => { aba('Endereço').click(); });
    expect(document.body.textContent).not.toContain('Já existe');

    await act(async () => { salvar().click(); });
    await esperar(0);

    expect(banco.gravacoes).toEqual([]);
    expect(document.body.textContent).toContain('Já existe: Gabriel');
  });

  it('confere de novo ao salvar, para o número que virou de outro lead depois do aviso', async () => {
    await abrir(ANA);
    await digitarWhatsapp('(31) 9 2222-3333');
    // Outra pessoa cadastrou esse número enquanto o modal estava aberto.
    banco.leads.push({ id: 'novo', name: 'Bia', whatsapp: '(31) 9 2222-3333', zapMatchKey: '3122223333' });

    await act(async () => { salvar().click(); });
    await esperar(0);

    expect(banco.gravacoes).toEqual([]);
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Bia'));
  });

  it('trocar para um número livre salva', async () => {
    await abrir(ANA);
    await digitarWhatsapp('(31) 9 4444-5555');

    await act(async () => { salvar().click(); });
    await esperar(0);

    expect(banco.gravacoes).toHaveLength(1);
    expect(banco.gravacoes[0].dados.zapMatchKey).toBe('3144445555');
  });

  it('sem mexer no número, o par que já divide o número continua salvando, e o dono não é procurado', async () => {
    await abrir(MARIA);
    await esperar(350);
    expect(document.body.textContent).not.toContain('Já existe');

    await act(async () => { salvar().click(); });
    await esperar(0);

    expect(banco.gravacoes).toHaveLength(1);
    expect(banco.consultas.filter((c) => c.startsWith('zapMatchKey=='))).toEqual([]);
  });

  it('só reformatar o mesmo número (pôr o nono dígito) não conta como troca', async () => {
    await abrir({ ...MARIA, whatsapp: '(31) 5555-4444' });
    await digitarWhatsapp('(31) 9 5555-4444');

    expect(document.body.textContent).not.toContain('Já existe');
    await act(async () => { salvar().click(); });
    await esperar(0);
    expect(banco.gravacoes).toHaveLength(1);
  });
});
