// Regras do scripts/sync-clientes-next-fit.js. Só pessoas inventadas: nada de
// dado real da Next Fit entra no repositório.

import { describe, it, expect } from 'vitest';
import {
  parsePeople, parseContracts, buildIndex, matchOne, leadItem, attachContracts, matchPeopleToLeads,
  etapa1Patch, planEtapa1,
  planEtapa2, extrasInStronilead, buildEtapa2Items, findUndefined, PLAN_SKIP, resolveByName
} from '../nextFitSync.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const NOW = D(2026, 11, 11);

// Linha da lista de clientes da Next Fit, com os cabeçalhos reais.
const nfRow = (o = {}) => ({
  Nome: 'Fulano de Tal',
  'E-mail': null,
  Contrato: 'Clube + Start (12 meses)',
  Telefone: null,
  'Situação do contrato': 'Ativo',
  'Situação do cliente': 'Ativo',
  CPF: null,
  'Data de nascimento': null,
  'Data de cadastro': 45000,
  Sexo: null,
  VIP: 'Não',
  Consultor: null,
  Professor: null,
  ...o
});

// Linha do relatório de contratos a vencer.
const ctRow = (o = {}) => ({
  Cliente: 'Fulano de Tal',
  'Descrição do contrato': 'Clube + Start (12 meses)',
  Início: '01/06/2026',
  Encerramento: '01/06/2027',
  Professor: null,
  Consultor: null,
  FoneCliente: null,
  ...o
});

describe('parsePeople', () => {
  it('lê CPF numérico, telefone com 55 e data em serial do Excel', () => {
    const [p] = parsePeople([nfRow({
      Nome: 'Ana  Souza',
      CPF: 52998224725,
      Telefone: '+55 (51) 99999-1234',
      'Data de nascimento': 36526
    })], NOW);
    expect(p.name).toBe('Ana Souza');
    expect(p.nameLower).toBe('ana souza');
    expect(p.cpfDigits).toBe('52998224725');
    expect(p.whatsappDigits).toBe('51999991234');
    expect(p.phoneKey).toBe('5199991234');
    expect(p.birthDate).toEqual(D(2000, 1, 1));
    expect(p.nf).toBe('ativo');
  });

  it('guarda a situação do cliente da Next Fit sem o acento nem a caixa', () => {
    const rows = [
      nfRow({ 'Situação do cliente': 'Suspenso', 'Situação do contrato': 'Suspenso' }),
      nfRow({ 'Situação do cliente': 'Bloqueado', 'Situação do contrato': 'Cancelado' }),
      nfRow({ 'Situação do cliente': 'Inativo', 'Situação do contrato': 'Encerrado' })
    ];
    expect(parsePeople(rows, NOW).map((p) => p.nf)).toEqual(['suspenso', 'bloqueado', 'inativo']);
  });

  it('CPF inválido e telefone curto não viram chave', () => {
    const [p] = parsePeople([nfRow({ CPF: '111.111.111-11', Telefone: '9999' })], NOW);
    expect(p.cpfDigits).toBeNull();
    expect(p.phoneKey).toBeNull();
  });
});

describe('parseContracts', () => {
  it('lê datas dd/mm/aaaa, a chave do telefone e a descrição', () => {
    const [c] = parseContracts([ctRow({ FoneCliente: '(51) 99999-1234' })], NOW);
    expect(c.nameLower).toBe('fulano de tal');
    expect(c.phoneKey).toBe('5199991234');
    expect(c.description).toBe('Clube + Start (12 meses)');
    expect(c.startsAt).toEqual(D(2026, 6, 1));
    expect(c.endsAt).toEqual(D(2027, 6, 1));
  });

  it('data ilegível vira null, sem derrubar a leitura', () => {
    const [c] = parseContracts([ctRow({ Encerramento: 'sem data' })], NOW);
    expect(c.endsAt).toBeNull();
  });
});

const item = (o = {}) => ({ id: 'x', cpfDigits: null, phoneKey: null, nameLower: '', isClient: false, ...o });
const probe = (o = {}) => ({ cpfDigits: null, phoneKey: null, nameLower: '', ...o });
const prefer = (it) => it.isClient;

describe('matchOne', () => {
  it('casa pelo CPF', () => {
    const a = item({ id: 'a', cpfDigits: '52998224725', nameLower: 'ana souza' });
    const r = matchOne(probe({ cpfDigits: '52998224725', nameLower: 'ana s' }), buildIndex([a]));
    expect(r.kind).toBe('cpf');
    expect(r.item).toBe(a);
  });

  it('casa pelo telefone só quando o primeiro nome é o mesmo', () => {
    const a = item({ id: 'a', phoneKey: '5199991234', nameLower: 'ana souza' });
    const index = buildIndex([a]);
    expect(matchOne(probe({ phoneKey: '5199991234', nameLower: 'ana s souza' }), index).kind).toBe('phone');
    // Mãe e filho no mesmo telefone: não casa por telefone nem por nome.
    expect(matchOne(probe({ phoneKey: '5199991234', nameLower: 'pedro souza' }), index).kind).toBe('none');
  });

  it('casa pelo nome completo quando só um cadastro tem esse nome', () => {
    const a = item({ id: 'a', nameLower: 'ana souza' });
    expect(matchOne(probe({ nameLower: 'ana souza' }), buildIndex([a])).kind).toBe('name');
  });

  it('homônimos viram ambíguos, a não ser que só um seja cliente', () => {
    const a = item({ id: 'a', nameLower: 'ana souza' });
    const b = item({ id: 'b', nameLower: 'ana souza' });
    const r = matchOne(probe({ nameLower: 'ana souza' }), buildIndex([a, b]), { prefer });
    expect(r.kind).toBe('ambiguous');
    expect(r.candidates).toHaveLength(2);
    const cliente = item({ id: 'c', nameLower: 'ana souza', isClient: true });
    const r2 = matchOne(probe({ nameLower: 'ana souza' }), buildIndex([a, cliente]), { prefer });
    expect(r2.kind).toBe('name');
    expect(r2.item).toBe(cliente);
  });

  it('sem nenhum sinal devolve none', () => {
    expect(matchOne(probe({ nameLower: 'ninguem' }), buildIndex([item()])).kind).toBe('none');
  });
});

describe('leadItem', () => {
  it('usa a chave de telefone gravada, ou calcula pelo whatsapp', () => {
    expect(leadItem({ id: 'l1', name: 'Ana Souza', zapMatchKey: '5199991234' }).phoneKey).toBe('5199991234');
    expect(leadItem({ id: 'l2', name: 'Ana Souza', whatsapp: '(51) 99999-1234' }).phoneKey).toBe('5199991234');
  });

  it('marca cliente pelo lifecycleStage', () => {
    expect(leadItem({ id: 'l1', name: 'A', lifecycleStage: 'cliente' }).isClient).toBe(true);
    expect(leadItem({ id: 'l2', name: 'A' }).isClient).toBe(false);
  });
});

describe('attachContracts', () => {
  const ana = { name: 'Ana Souza', nameLower: 'ana souza', cpfDigits: null, phoneKey: '5199991234', nf: 'ativo' };
  const bia = { name: 'Bia Lima', nameLower: 'bia lima', cpfDigits: null, phoneKey: '5188887777', nf: 'bloqueado' };
  const contrato = (o) => ({ name: 'x', nameLower: '', phoneKey: null, description: 'Plano', startsAt: D(2026, 1, 1), endsAt: D(2027, 1, 1), ...o });

  it('liga o contrato à pessoa e fica com o de fim mais distante', () => {
    const { people } = attachContracts([ana, bia], [
      contrato({ phoneKey: '5199991234', nameLower: 'ana souza', endsAt: D(2026, 12, 1) }),
      contrato({ phoneKey: '5199991234', nameLower: 'ana souza', endsAt: D(2027, 6, 1) })
    ]);
    expect(people[0].contract.endsAt).toEqual(D(2027, 6, 1));
    expect(people[0].contractCount).toBe(2);
    expect(people[1].contract).toBeNull();
  });

  it('separa o contrato sem pessoa e o contrato de quem não é ativo', () => {
    const { orphans, onInactive } = attachContracts([ana, bia], [
      contrato({ nameLower: 'bia lima', phoneKey: '5188887777' }),
      contrato({ nameLower: 'desconhecido', phoneKey: null })
    ]);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].contract.nameLower).toBe('desconhecido');
    expect(onInactive.map((p) => p.name)).toEqual(['Bia Lima']);
  });

  // O relatório só traz contrato vigente: entre homônimos, é do aluno ativo.
  it('entre homônimos, o contrato vai para o ativo na Next Fit', () => {
    const ativa = { name: 'Clara Dias', nameLower: 'clara dias', cpfDigits: null, phoneKey: null, nf: 'ativo' };
    const antiga = { name: 'Clara Dias', nameLower: 'clara dias', cpfDigits: null, phoneKey: null, nf: 'inativo' };
    const { people, orphans } = attachContracts([antiga, ativa], [contrato({ nameLower: 'clara dias' })]);
    expect(orphans).toHaveLength(0);
    expect(people[0].contract).toBeNull();
    expect(people[1].contract).not.toBeNull();
  });

  it('dois ativos com o mesmo nome continuam ambíguos e o contrato fica sem dono', () => {
    const a = { name: 'Clara Dias', nameLower: 'clara dias', cpfDigits: null, phoneKey: null, nf: 'ativo' };
    const b = { ...a };
    const { orphans } = attachContracts([a, b], [contrato({ nameLower: 'clara dias' })]);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].kind).toBe('ambiguous');
  });
});

describe('matchPeopleToLeads', () => {
  it('casa cada pessoa com a ficha e prefere o cliente entre homônimos', () => {
    const pessoa = { name: 'Ana Souza', nameLower: 'ana souza', cpfDigits: null, phoneKey: null, nf: 'ativo' };
    const matched = matchPeopleToLeads([pessoa], [
      { id: 'l1', name: 'Ana Souza' },
      { id: 'l2', name: 'Ana Souza', lifecycleStage: 'cliente' }
    ]);
    expect(matched[0].kind).toBe('name');
    expect(matched[0].item.id).toBe('l2');
  });
});

describe('etapa1Patch', () => {
  const pessoa = { cpfDigits: '52998224725', birthDate: D(1990, 5, 20) };

  it('preenche CPF e nascimento vazios, com os campos de busca', () => {
    const { patch, conflict } = etapa1Patch(pessoa, { name: 'Ana Souza', whatsapp: '(51) 99999-1234' });
    expect(conflict).toBe(false);
    expect(patch.cpf).toBe('529.982.247-25');
    expect(patch.cpfDigits).toBe('52998224725');
    expect(patch.birthDate).toEqual(D(1990, 5, 20));
    expect(patch.zapMatchKey).toBe('5199991234');
  });

  it('nunca sobrescreve o que já está preenchido', () => {
    const lead = { name: 'Ana', cpf: '529.982.247-25', cpfDigits: '52998224725', birthDate: D(1980, 1, 1) };
    const { patch } = etapa1Patch(pessoa, lead);
    expect(patch).toEqual({});
  });

  it('só o nascimento vazio: grava o nascimento e não mexe nos campos de busca', () => {
    const lead = { name: 'Ana', cpfDigits: '52998224725' };
    const { patch } = etapa1Patch(pessoa, lead);
    expect(Object.keys(patch)).toEqual(['birthDate']);
  });

  it('CPF diferente do da Next Fit vira conflito e não grava nada', () => {
    const r = etapa1Patch(pessoa, { name: 'Ana', cpfDigits: '11144477735' });
    expect(r.conflict).toBe(true);
    expect(r.patch).toEqual({});
  });
});

describe('planEtapa1', () => {
  const cliente = (o) => ({ id: 'l1', name: 'Ana Souza', lifecycleStage: 'cliente', ...o });
  const ana = { name: 'Ana Souza', nameLower: 'ana souza', cpfDigits: '52998224725', phoneKey: null, birthDate: D(1990, 5, 20), nf: 'ativo' };

  it('separa o que grava, os conflitos e os ambíguos', () => {
    const grava = matchPeopleToLeads([ana], [cliente()]);
    expect(planEtapa1(grava).writes).toHaveLength(1);
    expect(planEtapa1(grava).writes[0].leadId).toBe('l1');
    expect(planEtapa1(grava).writes[0].fills).toEqual(['CPF', 'nascimento']);

    const conflito = matchPeopleToLeads([{ ...ana, cpfDigits: '11144477735' }], [cliente({ cpfDigits: '52998224725' })]);
    expect(planEtapa1(conflito).conflicts).toHaveLength(1);
    expect(planEtapa1(conflito).writes).toHaveLength(0);

    const ambiguo = matchPeopleToLeads([{ ...ana, cpfDigits: null }], [cliente({ id: 'a' }), cliente({ id: 'b' })]);
    expect(planEtapa1(ambiguo).ambiguous).toHaveLength(1);
  });

  it('lead que ainda não é cliente fica para a etapa 2', () => {
    const lead = matchPeopleToLeads([ana], [{ id: 'l9', name: 'Ana Souza' }]);
    expect(planEtapa1(lead).writes).toHaveLength(0);
  });

  it('rodar de novo, com os campos já preenchidos, não grava nada', () => {
    const jaPreenchido = cliente({ cpf: '529.982.247-25', cpfDigits: '52998224725', birthDate: D(1990, 5, 20) });
    expect(planEtapa1(matchPeopleToLeads([ana], [jaPreenchido])).writes).toHaveLength(0);
  });
});

const FUTURO = D(2027, 6, 1);
const PASSADO = D(2026, 1, 1);
const contratoNF = { description: 'Clube + Start (12 meses)', startsAt: D(2026, 6, 1), endsAt: FUTURO, consultantName: null, professorName: null };
const ativo = (o = {}) => ({
  name: 'Fulano', nameLower: 'fulano', cpfDigits: null, phoneKey: null, birthDate: null, nf: 'ativo',
  email: null, whatsappRaw: '', whatsappDigits: null, rg: null, sexo: null, dor: null, vip: false,
  address: null, registeredAt: null, rowNumber: 2, contractSituation: 'ativo', warnings: [],
  consultantName: null, professorName: null, contract: contratoNF, ...o
});
const clienteAtivo = (o) => ({ id: 'c1', name: 'Fulano', lifecycleStage: 'cliente', currentContractId: 'k1', currentContractStatus: 'ativo', currentContractEndsAt: FUTURO, ...o });
const NOW2 = D(2026, 11, 11);

describe('planEtapa2', () => {
  it('manda cada pessoa para o grupo certo', () => {
    const pessoas = [
      ativo({ name: 'Ja Ativo', nameLower: 'ja ativo' }),
      ativo({ name: 'Venceu', nameLower: 'venceu' }),
      ativo({ name: 'So Lead', nameLower: 'so lead' }),
      ativo({ name: 'Sem Ficha', nameLower: 'sem ficha' }),
      ativo({ name: 'Sem Contrato', nameLower: 'sem contrato', contract: null })
    ];
    const leads = [
      clienteAtivo({ id: 'a', name: 'Ja Ativo' }),
      clienteAtivo({ id: 'b', name: 'Venceu', currentContractStatus: 'ativo', currentContractEndsAt: PASSADO }),
      { id: 'c', name: 'So Lead' },
      clienteAtivo({ id: 'd', name: 'Sem Contrato', currentContractEndsAt: PASSADO })
    ];
    const r = planEtapa2(matchPeopleToLeads(pessoas, leads), NOW2);
    expect(r.jaAtivos).toBe(1);
    expect(r.groups.contrato_nao_ativo.map((m) => m.person.name)).toEqual(['Venceu']);
    expect(r.groups.so_lead.map((m) => m.person.name)).toEqual(['So Lead']);
    expect(r.groups.sem_cadastro.map((m) => m.person.name)).toEqual(['Sem Ficha']);
    expect(r.semContrato.map((m) => m.person.name)).toEqual(['Sem Contrato']);
  });

  it('ambíguo, CPF divergente e contrato inválido ficam fora dos grupos', () => {
    const pessoas = [
      ativo({ name: 'Homonimo', nameLower: 'homonimo' }),
      ativo({ name: 'Divergente', nameLower: 'divergente', cpfDigits: '52998224725' }),
      ativo({ name: 'Datas Ruins', nameLower: 'datas ruins', contract: { ...contratoNF, endsAt: PASSADO, startsAt: FUTURO } })
    ];
    const leads = [
      { id: 'h1', name: 'Homonimo' }, { id: 'h2', name: 'Homonimo' },
      clienteAtivo({ id: 'dv', name: 'Divergente', cpfDigits: '11144477735', currentContractEndsAt: PASSADO }),
      { id: 'dr', name: 'Datas Ruins' }
    ];
    const r = planEtapa2(matchPeopleToLeads(pessoas, leads), NOW2);
    expect(r.ambiguous).toHaveLength(1);
    expect(r.conflicts).toHaveLength(1);
    expect(r.contratoInvalido).toHaveLength(1);
    expect(Object.values(r.groups).flat()).toHaveLength(0);
  });

  it('ignora quem não é ativo na Next Fit', () => {
    const r = planEtapa2(matchPeopleToLeads([ativo({ nf: 'bloqueado' })], []), NOW2);
    expect(Object.values(r.groups).flat()).toHaveLength(0);
    expect(r.semContrato).toHaveLength(0);
  });
});

describe('extrasInStronilead', () => {
  it('lista o cliente ativo que nenhuma pessoa ativa da Next Fit explica', () => {
    const leads = [
      clienteAtivo({ id: 'a', name: 'Fulano' }),
      clienteAtivo({ id: 'b', name: 'Outro' }),
      clienteAtivo({ id: 'c', name: 'Vencido', currentContractEndsAt: PASSADO })
    ];
    const matched = matchPeopleToLeads([ativo()], leads);
    expect(extrasInStronilead(matched, leads, NOW2).map((l) => l.id)).toEqual(['b']);
  });
});

describe('buildEtapa2Items', () => {
  const planos = [{ id: 'pl1', name: 'Clube + Start (12 meses)', value: 1308, durationMonths: 12 }];
  const usersList = [{ id: 'u1', name: 'Ana Consultora', authUid: 'auth-1' }];
  const importMeta = { importedBy: 'script:sync-clientes-next-fit', importSource: 'nextfit', importBatchId: 'lote-1', now: NOW2 };
  const grupos = (m) => ({ sem_cadastro: m, so_lead: [], contrato_nao_ativo: [] });
  const semFicha = (o) => ({ person: ativo(o), kind: 'none', item: null, candidates: [] });

  it('cria cadastro e contrato marcados como importados, com as datas do relatório', () => {
    const { items, unmapped } = buildEtapa2Items(
      grupos([semFicha({ consultantName: 'Ana Consultora' })]),
      { usersList, planos, funnelId: 'f1', importMeta, now: NOW2 }
    );
    expect(unmapped).toEqual([]);
    expect(items).toHaveLength(1);
    const it = items[0];
    expect(it.isNew).toBe(true);
    expect(it.contract.planId).toBe('pl1');
    expect(it.contract.startsAt).toEqual(D(2026, 6, 1));
    expect(it.contract.endsAt).toEqual(FUTURO);
    expect(it.contract.importBatchId).toBe('lote-1');
    expect(it.leadData.importBatchId).toBe('lote-1');
    expect(it.leadData.lifecycleStage).toBe('cliente');
    expect(it.leadData.consultantId).toBe('u1');
    expect(findUndefined(it.leadData)).toBeNull();
    expect(findUndefined(it.contract)).toBeNull();
  });

  it('descrição sem plano ligado não vira contrato e aparece na lista', () => {
    const p = semFicha({ contract: { ...contratoNF, description: 'Freepass 15 dias' } });
    const { items, unmapped } = buildEtapa2Items(grupos([p]), { planos, importMeta, now: NOW2 });
    expect(items).toHaveLength(0);
    expect(unmapped).toEqual([{ key: 'freepass 15 dias', label: 'Freepass 15 dias', count: 1 }]);
  });

  it('descrição marcada para pular não vira contrato nem pendência', () => {
    const p = semFicha({ contract: { ...contratoNF, description: 'Freepass 15 dias' } });
    const { items, unmapped, skipped } = buildEtapa2Items(grupos([p]), {
      planos, planMap: { 'freepass 15 dias': PLAN_SKIP }, importMeta, now: NOW2
    });
    expect(items).toHaveLength(0);
    expect(unmapped).toEqual([]);
    expect(skipped).toHaveLength(1);
  });

  it('lead existente: reaproveita a ficha e só completa CPF e nascimento', () => {
    const lead = { id: 'l9', name: 'Fulano', whatsapp: '(51) 99999-1234' };
    const m = { person: ativo({ cpfDigits: '52998224725', birthDate: D(1990, 5, 20) }), kind: 'name', item: leadItem(lead), candidates: [] };
    const { items } = buildEtapa2Items({ sem_cadastro: [], so_lead: [m], contrato_nao_ativo: [] }, { planos, importMeta, now: NOW2 });
    expect(items[0].isNew).toBe(false);
    expect(items[0].leadId).toBe('l9');
    expect(items[0].leadData.cpf).toBe('529.982.247-25');
    expect(items[0].leadData.birthDate).toEqual(D(1990, 5, 20));
    expect(items[0].leadData.lifecycleStage).toBe('cliente');
  });
});

describe('resolveByName', () => {
  const users = [{ id: 'u1', name: 'Ana Júlia' }, { id: 'u2', name: 'Hosiel Couto' }, { id: 'u3', name: 'Pedro' }];

  it('liga o nome completo da Next Fit ao nome curto do Stronilead', () => {
    expect(resolveByName(users, 'Ana Julia Kubiczewski dos Santos')?.id).toBe('u1');
    expect(resolveByName(users, 'Hosiel Vitor Couto Moraes')?.id).toBe('u2');
  });

  it('nome igual ganha, e nome de uma palavra só não casa por pedaço', () => {
    expect(resolveByName(users, 'Pedro')?.id).toBe('u3');
    expect(resolveByName(users, 'Pedro Carlos Sousa')).toBeNull();
  });

  it('mais de um candidato ou nenhum devolve null', () => {
    const dois = [{ id: 'a', name: 'Ana Maria' }, { id: 'b', name: 'Ana Souza' }];
    expect(resolveByName(dois, 'Ana Maria Souza')).toBeNull();
    expect(resolveByName(users, 'Fulano de Tal')).toBeNull();
    expect(resolveByName(users, '')).toBeNull();
  });
});

describe('buildEtapa2Items: dono do cadastro novo', () => {
  const planos = [{ id: 'pl1', name: 'Clube + Start (12 meses)', value: 1308, durationMonths: 12 }];
  const usersList = [{ id: 'u1', name: 'Ana Júlia', authUid: 'auth-1' }];
  const importMeta = { importedBy: 'script', importSource: 'nextfit', importBatchId: 'lote-2', now: NOW2 };

  it('acha o consultor pelo nome completo da Next Fit', () => {
    const m = { person: ativo({ consultantName: 'Ana Julia Kubiczewski dos Santos' }), kind: 'none', item: null, candidates: [] };
    const { items } = buildEtapa2Items({ sem_cadastro: [m], so_lead: [], contrato_nao_ativo: [] }, { usersList, planos, importMeta, now: NOW2 });
    expect(items[0].leadData.consultantId).toBe('u1');
    expect(items[0].leadData.consultantName).toBe('Ana Júlia');
  });

  it('consultor que não é usuário do Stronilead deixa o cadastro sem dono', () => {
    const m = { person: ativo({ consultantName: 'Gabriella Souza Oliveira' }), kind: 'none', item: null, candidates: [] };
    const { items } = buildEtapa2Items({ sem_cadastro: [m], so_lead: [], contrato_nao_ativo: [] }, { usersList, planos, importMeta, now: NOW2 });
    expect(items[0].leadData.consultantId).toBeNull();
  });
});

describe('findUndefined', () => {
  it('acha o caminho do primeiro undefined, ignorando datas', () => {
    expect(findUndefined({ a: 1, b: { c: undefined } })).toBe('b.c');
    expect(findUndefined({ a: new Date(), b: null, c: [1, 2] })).toBeNull();
  });
});
