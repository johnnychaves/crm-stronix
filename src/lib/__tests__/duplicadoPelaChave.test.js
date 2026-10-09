// @vitest-environment jsdom
// O Novo lead, o "Cadastrar indicação" e a edição da ficha procuram o dono de
// um número pela chave do telefone (zapMatchKey: DDD mais os 8 últimos
// dígitos), a mesma do Stronizap. Antes procuravam pelos dígitos exatos, e o
// mesmo celular escrito sem o nono dígito ou com 55 na frente passava como
// outra pessoa. Os avisos de responsável seguem a mesma conta
// (guardianZapMatchKey). O Firestore aqui é um dublê que filtra pelo campo da
// consulta, então a consulta pelo campo errado não acha ninguém.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

const banco = vi.hoisted(() => ({ leads: [], consultas: [] }));
vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'leads' }));
vi.mock('firebase/firestore', () => ({
  collection: (...p) => ({ path: p.slice(1).join('/') }),
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
}));

const { findDuplicateLeadRemote } = await import('../../hooks/useDuplicateLead.js');
const { useGuardianMatches } = await import('../../hooks/useGuardianMatches.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Gravado como o Novo lead grava: com o nono dígito e sem o 55.
const GABRIEL = { id: 'gabriel', name: 'Gabriel', whatsapp: '(31) 9 7198-3969', whatsappDigits: '31971983969', zapMatchKey: '3171983969' };
// Menor cujo responsável usa o número da mãe.
const PEDRO = {
  id: 'pedro', name: 'Pedro', isMinor: true,
  guardian: { name: 'Maria', phone: '(31) 9 8888-7777', relationship: 'Mãe' },
  guardianPhoneDigits: '31988887777', guardianZapMatchKey: '3188887777',
};

beforeEach(() => {
  banco.leads = [GABRIEL, PEDRO];
  banco.consultas = [];
});

describe('findDuplicateLeadRemote procura pela chave do telefone', () => {
  it.each([
    ['igual ao gravado', '31971983969'],
    ['sem o nono dígito', '3171983969'],
    ['com 55 na frente', '5531971983969'],
    ['com 55 e sem o nono dígito', '553171983969'],
  ])('acha o dono do número %s', async (_, phoneDigits) => {
    const dup = await findDuplicateLeadRemote({ db: {}, phoneDigits });
    expect(dup?.id).toBe('gabriel');
    expect(banco.consultas).toEqual(['zapMatchKey==3171983969']);
  });

  it('na edição, o próprio lead não conta como duplicado', async () => {
    expect(await findDuplicateLeadRemote({ db: {}, phoneDigits: '3171983969', excludeId: 'gabriel' })).toBeNull();
  });

  it('número incompleto não consulta', async () => {
    expect(await findDuplicateLeadRemote({ db: {}, phoneDigits: '319719' })).toBeNull();
    expect(banco.consultas).toEqual([]);
  });
});

describe('useGuardianMatches procura pela chave do telefone', () => {
  let root = null;
  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    document.body.innerHTML = '';
    root = null;
  });

  // db fixo: um objeto novo a cada render refaria a consulta.
  const DB = {};
  async function achados(phoneDigits) {
    let atual = null;
    function Sonda() {
      atual = useGuardianMatches({ db: DB, phoneDigits, debounceMs: 0 });
      return null;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(h(Sonda)); });
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    return { owner: atual.owner?.id ?? null, wards: atual.wards.map((w) => w.id) };
  }

  it('acha o dono e os menores do mesmo número escrito de outro jeito', async () => {
    expect(await achados('3171983969')).toEqual({ owner: 'gabriel', wards: [] });
    expect(await achados('5531988887777')).toEqual({ owner: null, wards: ['pedro'] });
    expect(banco.consultas).toEqual([
      'zapMatchKey==3171983969', 'guardianZapMatchKey==3171983969',
      'zapMatchKey==3188887777', 'guardianZapMatchKey==3188887777',
    ]);
  });
});
