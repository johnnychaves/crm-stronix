// Testes da lógica do "Foco agora" da Meta Diária (src/lib/metaFoco.js): a ordem
// da fila, o que é urgente, o Agora que não muda sozinho e a faixa de aviso.
// O cenário do mockup B (sexta, 16/10/2026, 14:32) é o caso principal: se a
// ordem aqui mudar, o mockup aprovado pelo Johnny deixou de valer. Datas sempre
// em horário local, como o app faz.

import { describe, it, expect } from 'vitest';
import {
  FOCO_ORDER,
  URGENT_WINDOW_MIN,
  taskKey,
  pendingEntries,
  inFoco,
  klassOf,
  rankFoco,
  urgentCount,
  withSkipped,
  pickAgora,
  faixaFor,
} from '../metaFoco.js';
import { DAILY_GOAL_CATEGORIES as C } from '../leads.js';

const NOW = new Date(2026, 9, 16, 14, 32);
const at = (h, m = 0, dias = 0) => new Date(2026, 9, 16 + dias, h, m);
const entry = (lead, slug) => ({ key: taskKey(lead, slug), slug, lead });

const aula = (id, h, m) => entry({ id, appointmentType: 'aula_experimental', appointmentScheduledFor: at(h, m) }, C.AULA_HOJE);
const visita = (id, h, m) => entry({ id, appointmentType: 'visita', appointmentScheduledFor: at(h, m) }, C.VISITA_HOJE);
const contato = (id, h, m) => entry({ id, nextFollowUp: at(h, m) }, C.CONTATO_HOJE);
// Lead novo: cadastrado ontem. A janela de 24h fecha hoje, na mesma hora.
const novo = (id, h, m) => entry({ id, createdAt: at(h, m, -1) }, C.NOVO_24H);
const atrasado = (id, dias) => entry({ id, nextFollowUp: at(9, 0, -dias) }, C.ATRASADO);
const renovacao = (id, dias) => entry({ id, currentContractEndsAt: at(12, 0, dias) }, C.RENOVACAO);
const vencido = (id, haDias) => entry({ id, currentContractEndsAt: at(12, 0, -haDias) }, C.VENCIDO);

const ids = (lista) => lista.map((e) => e.lead.id);
const rank = (lista, opts) => rankFoco(lista, NOW, opts);

describe('classes da fila', () => {
  it('visita ou aula que já passou do horário é a classe 0', () => {
    expect(klassOf(aula('a', 13, 30), NOW)).toBe(0);
    expect(klassOf(visita('v', 14, 31), NOW)).toBe(0);
  });

  it('o que vence em até 90 minutos é a classe 1: visita, aula, contato e fim da janela do lead novo', () => {
    expect(klassOf(visita('v', 15, 0), NOW)).toBe(1);
    expect(klassOf(contato('c', 15, 30), NOW)).toBe(1);
    expect(klassOf(novo('n', 15, 20), NOW)).toBe(1);
    // 90 minutos exatos ainda entra, 91 não.
    expect(URGENT_WINDOW_MIN).toBe(90);
    expect(klassOf(contato('c90', 16, 2), NOW)).toBe(1);
    expect(klassOf(contato('c91', 16, 3), NOW)).toBe(3);
  });

  it('contato marcado para uma hora que já passou hoje continua na classe 1', () => {
    expect(klassOf(contato('c', 9, 0), NOW)).toBe(1);
  });

  it('atrasado crítico (a partir do SLA) é a classe 2 e o resto dos atrasados é a 4', () => {
    expect(klassOf(atrasado('a5', 5), NOW, { sla: 3 })).toBe(2);
    expect(klassOf(atrasado('a3', 3), NOW, { sla: 3 })).toBe(2);
    expect(klassOf(atrasado('a2', 2), NOW, { sla: 3 })).toBe(4);
    // O SLA é da academia: com 5 dias, o de 3 dias deixa de ser crítico.
    expect(klassOf(atrasado('a3', 3), NOW, { sla: 5 })).toBe(4);
  });

  it('o resto do que tem horário é a classe 3', () => {
    expect(klassOf(aula('a', 16, 30), NOW)).toBe(3);
    expect(klassOf(contato('c', 17, 30), NOW)).toBe(3);
    expect(klassOf(novo('n', 21, 10), NOW)).toBe(3);
  });

  it('renovação é a classe 5 e vencido é a 6', () => {
    expect(klassOf(renovacao('r', 50), NOW)).toBe(5);
    expect(klassOf(vencido('x', 16), NOW)).toBe(6);
  });
});

describe('ordem da fila', () => {
  it('o cenário do mockup B sai na ordem aprovada', () => {
    const cenario = [
      novo('t11', 21, 10), vencido('t20', 21), atrasado('t16', 1), contato('t7', 17, 30),
      renovacao('t17', 88), visita('t4', 18, 30), atrasado('t12', 5), novo('t9', 17, 40),
      aula('t1', 13, 30), contato('t5', 15, 30), vencido('t21', 16), renovacao('t18', 53),
      visita('t2', 15, 0), atrasado('t14', 2), novo('t10', 19, 5), aula('t3', 16, 30),
      contato('t6', 16, 0), atrasado('t13', 3), novo('t8', 15, 20), atrasado('t15', 1),
      renovacao('t19', 50),
    ];
    expect(ids(rank(cenario, { sla: 3 }))).toEqual([
      't1',                                   // aula que já passou: marcar o desfecho
      't2', 't8', 't5', 't6',                 // vence em até 90 min, pelo prazo
      't12', 't13',                           // atrasados críticos, o mais antigo primeiro
      't3', 't7', 't9', 't4', 't10', 't11',   // o resto do que tem horário, pela hora
      't14', 't15', 't16',                    // atrasados; empate de dias desempata pelo id
      't19', 't18', 't17',                    // renovações, o vencimento mais próximo primeiro
      't21', 't20',                           // vencidos, o vencimento mais recente primeiro
    ]);
  });

  it('dentro da classe 0, o horário que passou há mais tempo vem primeiro', () => {
    expect(ids(rank([visita('b', 14, 0), aula('a', 13, 30)]))).toEqual(['a', 'b']);
  });

  it('não muda a lista recebida e devolve a classe e o prazo de cada tarefa', () => {
    const lista = [aula('b', 16, 30), visita('a', 15, 0)];
    const copia = [...lista];
    const r = rank(lista);
    expect(lista).toEqual(copia);
    expect(r.map((e) => e.klass)).toEqual([1, 3]);
    expect(r[0].minutes).toBe(28);
    expect(r[1].minutes).toBe(118);
  });

  it('atrasado, renovação e vencido não têm prazo em minutos', () => {
    expect(rank([atrasado('a', 5)])[0].minutes).toBeNull();
    expect(rank([renovacao('r', 50)])[0].minutes).toBeNull();
  });

  it('a mesma tarefa fica na mesma posição com o relógio parado (sem depender do Date de agora)', () => {
    const lista = [contato('c', 15, 30), visita('v', 15, 0)];
    expect(ids(rank(lista))).toEqual(ids(rank(lista)));
  });
});

describe('contagem de urgentes', () => {
  it('conta as classes 0 e 1', () => {
    const lista = [aula('t1', 13, 30), visita('t2', 15, 0), novo('t8', 15, 20), contato('t5', 15, 30),
      aula('t3', 16, 30), atrasado('t12', 5), renovacao('t17', 88)];
    expect(urgentCount(lista, NOW, { sla: 3 })).toBe(4);
  });

  it('sem tarefa, zero', () => {
    expect(urgentCount([], NOW)).toBe(0);
  });
});

describe('o Agora fica parado', () => {
  const lista = () => rank([aula('t1', 13, 30), visita('t2', 15, 0), atrasado('t12', 5), contato('t7', 17, 30)], { sla: 3 });

  it('sem escolha, o Agora é o primeiro da ordem', () => {
    expect(pickAgora(lista(), null).lead.id).toBe('t1');
  });

  it('com uma escolha que ainda está pendente, o Agora é ela, mesmo que outra seja mais urgente', () => {
    const l = lista();
    expect(pickAgora(l, taskKey({ id: 't12' }, C.ATRASADO)).lead.id).toBe('t12');
  });

  it('quando a escolhida some da lista, volta ao primeiro da ordem', () => {
    const l = lista().filter((e) => e.lead.id !== 't12');
    expect(pickAgora(l, taskKey({ id: 't12' }, C.ATRASADO)).lead.id).toBe('t1');
  });

  it('lista vazia não tem Agora', () => {
    expect(pickAgora([], null)).toBeNull();
  });

  it('pular manda a tarefa para o fim, na ordem em que foi pulada, e ignora o que já saiu', () => {
    const l = lista();
    const t1 = taskKey({ id: 't1' }, C.AULA_HOJE);
    const t2 = taskKey({ id: 't2' }, C.VISITA_HOJE);
    expect(ids(withSkipped(l, [t1]))).toEqual(['t2', 't12', 't7', 't1']);
    expect(ids(withSkipped(l, [t1, t2]))).toEqual(['t12', 't7', 't1', 't2']);
    expect(ids(withSkipped(l, ['nao-existe:aula_hoje']))).toEqual(ids(l));
  });
});

describe('faixa de aviso', () => {
  const lista = () => rank([aula('t1', 13, 30), visita('t2', 15, 0), atrasado('t12', 5), contato('t7', 17, 30)], { sla: 3 });
  const por = (id, l) => l.find((e) => e.lead.id === id);

  it('avisa quando existe algo mais urgente que o Agora e é da classe 0 ou 1', () => {
    const l = lista();
    expect(faixaFor(l, por('t12', l), new Map()).lead.id).toBe('t1');
    expect(faixaFor(l, por('t7', l), new Map()).lead.id).toBe('t1');
  });

  it('não avisa quando o Agora já é o mais urgente', () => {
    const l = lista();
    expect(faixaFor(l, por('t1', l), new Map())).toBeNull();
  });

  it('não avisa quando o Agora está na mesma classe do primeiro, para não interromper à toa', () => {
    const l = rank([visita('a', 15, 0), contato('b', 15, 30)]);
    expect(faixaFor(l, por('b', l), new Map())).toBeNull();
  });

  it('não avisa quando o que é mais urgente que o Agora não é da classe 0 nem da 1', () => {
    const l = rank([atrasado('crit', 5), atrasado('leve', 1)], { sla: 3 });
    expect(faixaFor(l, por('leve', l), new Map())).toBeNull();
  });

  it('"Agora não" esconde a faixa daquela tarefa, e ela volta se a classe mudar', () => {
    const l = rank([aula('t1', 13, 30), atrasado('t12', 5)], { sla: 3 });
    const alvo = por('t1', l);
    const dispensada = new Map([[alvo.key, alvo.klass]]);
    expect(faixaFor(l, por('t12', l), dispensada)).toBeNull();
    const mudou = new Map([[alvo.key, alvo.klass + 1]]);
    expect(faixaFor(l, por('t12', l), mudou).lead.id).toBe('t1');
  });

  it('com a primeira dispensada, a faixa passa para a próxima da classe 0 ou 1', () => {
    const l = lista();
    const t1 = por('t1', l);
    const faixa = faixaFor(l, por('t7', l), new Map([[t1.key, t1.klass]]));
    expect(faixa.lead.id).toBe('t2');
  });

  it('sem Agora ou sem lista, nada a avisar', () => {
    expect(faixaFor([], null, new Map())).toBeNull();
  });
});

describe('grupos do Foco em', () => {
  it('a ordem dos grupos é a da barra Foco em', () => {
    expect(FOCO_ORDER).toEqual(['all', 'compromissos', C.CONTATO_HOJE, C.NOVO_24H, C.ATRASADO, C.RENOVACAO, C.VENCIDO]);
  });

  it('compromissos junta visitas e aulas, e "all" aceita tudo', () => {
    expect(inFoco(C.VISITA_HOJE, 'compromissos')).toBe(true);
    expect(inFoco(C.AULA_HOJE, 'compromissos')).toBe(true);
    expect(inFoco(C.CONTATO_HOJE, 'compromissos')).toBe(false);
    expect(inFoco(C.ATRASADO, 'all')).toBe(true);
    expect(inFoco(C.ATRASADO, C.ATRASADO)).toBe(true);
    expect(inFoco(C.ATRASADO, C.VENCIDO)).toBe(false);
  });
});

describe('pendências do dia', () => {
  it('pega só o que ainda está pendente, uma entrada por lead e categoria', () => {
    const processados = [
      { id: 'a', categorySlugs: [C.NOVO_24H, C.ATRASADO], categoryStatus: { [C.NOVO_24H]: false, [C.ATRASADO]: true } },
      { id: 'b', categorySlugs: [C.CONTATO_HOJE], categoryStatus: { [C.CONTATO_HOJE]: false } },
      { id: 'c', categorySlugs: [C.AULA_HOJE], categoryStatus: { [C.AULA_HOJE]: true } },
    ];
    const lista = pendingEntries(processados);
    expect(lista.map((e) => e.key)).toEqual(['a:novo_24h', 'b:contato_hoje']);
    expect(lista[0].slug).toBe(C.NOVO_24H);
    expect(lista[0].lead).toBe(processados[0]);
  });

  it('lista vazia ou ausente não quebra', () => {
    expect(pendingEntries([])).toEqual([]);
    expect(pendingEntries(undefined)).toEqual([]);
  });
});
