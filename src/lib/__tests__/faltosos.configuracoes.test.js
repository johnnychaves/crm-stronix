// As contas do bloco Faltosos de Configurações → Metas & ritmo
// (src/lib/faltosos/configuracoes.js): marcos de 1 a 6 números de 1 a 365 sem
// repetir, janela do urgente e a troca do professor de cada nome da Next Fit.
// A regra que a importação usa para os marcos é o normalizarMarcos, e o
// último bloco confere que as duas dizem o mesmo.
import { describe, it, expect } from 'vitest';
import {
  MARCOS_MAX, MENSAGENS_DO_BLOCO, SEM_PROFESSOR, adicionarMarco, removerMarco, validarJanelaUrgente,
  trocarLigacaoProfessor, ligacoesEmOrdem, opcoesDeProfessor,
} from '../faltosos/configuracoes.js';
import { normalizarMarcos } from '../faltosos/marcos.js';

describe('marcos de falta', () => {
  it('marco novo entra em ordem', () => {
    expect(adicionarMarco([7, 14, 30, 60], '21')).toEqual({ marcos: [7, 14, 21, 30, 60] });
    expect(adicionarMarco([7], 1)).toEqual({ marcos: [1, 7] });
    expect(adicionarMarco([7], ' 365 ')).toEqual({ marcos: [7, 365] });
  });

  it('recusa fora de 1 a 365, número quebrado e campo vazio', () => {
    for (const x of ['0', '366', '7.5', '', '  ', 'abc', null, undefined, -3]) {
      expect(adicionarMarco([7], x), String(x)).toEqual({ erro: MENSAGENS_DO_BLOCO.marcoForaDoLimite });
    }
  });

  it('recusa repetido e o sétimo marco', () => {
    expect(adicionarMarco([7, 14], '14')).toEqual({ erro: 'O marco de 14 dias já existe.' });
    expect(adicionarMarco([1, 7], '1')).toEqual({ erro: 'O marco de 1 dia já existe.' });
    const seis = [7, 14, 21, 30, 45, 60];
    expect(seis).toHaveLength(MARCOS_MAX);
    expect(adicionarMarco(seis, '90')).toEqual({ erro: 'São no máximo 6 marcos.' });
  });

  it('remove, mas nunca o último', () => {
    expect(removerMarco([7, 14, 30], 14)).toEqual({ marcos: [7, 30] });
    expect(removerMarco([7], 7)).toEqual({ erro: 'Mantenha ao menos um marco de falta.' });
  });

  it('a lista que sai do bloco é a mesma que a importação aceita (normalizarMarcos)', () => {
    let lista = [7];
    for (const n of [365, 1, 60, 30, 14]) {
      lista = adicionarMarco(lista, String(n)).marcos;
      expect(normalizarMarcos(lista), lista.join(',')).toEqual(lista);
    }
    expect(lista).toHaveLength(MARCOS_MAX);
    expect(normalizarMarcos(removerMarco(lista, 365).marcos)).toEqual([1, 7, 14, 30, 60]);
  });
});

describe('janela do urgente', () => {
  it('inteiro de 1 a 365', () => {
    expect(validarJanelaUrgente('120')).toEqual({ dias: 120 });
    expect(validarJanelaUrgente(1)).toEqual({ dias: 1 });
    expect(validarJanelaUrgente('365')).toEqual({ dias: 365 });
    for (const x of ['0', '366', '', '9.5', 'x', null]) {
      expect(validarJanelaUrgente(x), String(x)).toEqual({ erro: MENSAGENS_DO_BLOCO.janelaForaDoLimite });
    }
  });

  it('os textos não têm travessão nem aspas curvas', () => {
    const textos = [
      MENSAGENS_DO_BLOCO.marcoForaDoLimite, MENSAGENS_DO_BLOCO.marcoRepetido(7),
      MENSAGENS_DO_BLOCO.marcosDemais, MENSAGENS_DO_BLOCO.marcoUltimo, MENSAGENS_DO_BLOCO.janelaForaDoLimite,
    ];
    for (const t of textos) expect(t).not.toMatch(/[—–“”‘’]/);
  });
});

describe('professores da Next Fit', () => {
  const LINKS = [
    { nome: 'RAFAEL MENEZES', professorId: 'prof-rafa' },
    { nome: 'CONTROLE (NÃO ALTERAR)', professorId: null },
  ];

  it('troca o professor de um nome e deixa os outros como estão, na mesma ordem', () => {
    expect(trocarLigacaoProfessor(LINKS, 'RAFAEL MENEZES', 'prof-lu')).toEqual([
      { nome: 'RAFAEL MENEZES', professorId: 'prof-lu' }, { nome: 'CONTROLE (NÃO ALTERAR)', professorId: null },
    ]);
  });

  it('texto vazio é "Sem professor", e nome que não está na lista não entra', () => {
    expect(trocarLigacaoProfessor(LINKS, 'RAFAEL MENEZES', '')[0]).toEqual({ nome: 'RAFAEL MENEZES', professorId: null });
    expect(trocarLigacaoProfessor(LINKS, 'OUTRO', 'prof-lu')).toEqual(LINKS);
  });

  it('item sem nome sai da lista gravada', () => {
    expect(trocarLigacaoProfessor([...LINKS, { nome: '  ' }, null], 'OUTRO', 'x')).toEqual(LINKS);
  });

  it('a tela mostra os nomes em ordem, sem ligar para acento e caixa', () => {
    expect(ligacoesEmOrdem([{ nome: 'Érica' }, { nome: 'bruno' }, { nome: 'Ana' }]).map((l) => l.nome)).toEqual(['Ana', 'bruno', 'Érica']);
    expect(ligacoesEmOrdem(null)).toEqual([]);
  });

  it('opções: "Sem professor" e os ativos em ordem de nome', () => {
    const professores = [
      { id: 'p2', nome: 'Rafael Menezes', ativo: true },
      { id: 'p1', nome: 'Ana Souza' },
      { id: 'p3', nome: 'Carlos Antigo', ativo: false },
    ];
    expect(opcoesDeProfessor(professores, null)).toEqual([
      { value: '', label: SEM_PROFESSOR },
      { value: 'p1', label: 'Ana Souza' },
      { value: 'p2', label: 'Rafael Menezes' },
    ]);
  });

  it('o professor da linha continua na lista, mesmo inativo ou fora do cadastro', () => {
    const professores = [{ id: 'p3', nome: 'Carlos Antigo', ativo: false }];
    expect(opcoesDeProfessor(professores, 'p3').at(-1)).toEqual({ value: 'p3', label: 'Carlos Antigo (inativo)' });
    expect(opcoesDeProfessor([], 'sumiu').at(-1)).toEqual({ value: 'sumiu', label: 'Professor fora do cadastro' });
  });
});
