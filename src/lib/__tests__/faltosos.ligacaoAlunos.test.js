// A ligação dos alunos da Next Fit com os clientes
// (src/lib/faltosos/ligacaoAlunos.js): o Faltantes pelo telefone (do aluno e
// do responsável), com o nome conferindo e desempatando, e o Presenças pelo
// nome. Clientes, nomes e telefones inventados.
import { describe, it, expect } from 'vitest';
import {
  nomeChave, nomeConfere, ligarFaltantes, ligarPresencas, clienteProvavel, nomesParaGuardar, nomesManuais,
  indiceDeClientes,
} from '../faltosos/ligacaoAlunos.js';
import { nomeChave as nomeChaveDoArquivo } from '../faltosos/nextfitArquivos.js';

const cliente = (id, name, whatsapp, extra = {}) => ({ id, name, whatsapp, lifecycleBucket: 'cliente', ...extra });
const MAE = { name: 'Rita Teste', phone: '(51) 9 9000-0099', relationship: 'Mãe' };

const CLIENTES = [
  cliente('ana', 'Ana Teste Souza', '(51) 9 9000-0001'),
  cliente('bia', 'Bia Teste', '51 99000-0002'),
  // irmãos com o telefone da mãe como responsável
  cliente('pedro', 'Pedro Teste', '', { isMinor: true, guardian: MAE }),
  cliente('lia', 'Lia Teste', '', { isMinor: true, guardian: MAE }),
  // homônimos
  cliente('joao1', 'João Teste', '(51) 9 9000-0011'),
  cliente('joao2', 'Joao  Teste', '(51) 9 9000-0012'),
  // a mãe que é cliente, com o número que o filho também usa na Next Fit
  cliente('rita', 'Rita Souza', '(51) 9 9000-0020'),
  // lead que não é cliente não entra
  { id: 'lead', name: 'Caio Lead', whatsapp: '(51) 9 9000-0003', lifecycleBucket: 'ativo' },
];

const lf = (nome, telefone) => ({ nome, telefone });
const lp = (nome) => ({ nome, dia: '2026-10-02', hora: '07:00', origem: 'catraca', modalidade: null });

describe('nomeChave e nomeConfere', () => {
  it('a chave de nome é a mesma do leitor das planilhas', () => {
    expect(nomeChave).toBe(nomeChaveDoArquivo);
    expect(nomeChave('  JOÃO   da Silva-Neto ')).toBe('joao da silva neto');
  });

  it('confere com o primeiro nome igual', () => {
    expect(nomeConfere('Ana T. Souza', 'Ana Teste Souza')).toBe(true);
    expect(nomeConfere('PEDRO Henrique', 'Pedro Teste')).toBe(true);
  });

  it('confere com duas palavras em comum', () => {
    expect(nomeConfere('Maria Rita Souza', 'Rita Souza')).toBe(true);
  });

  it('uma palavra só não basta, e "de", "da" e "do" não contam', () => {
    expect(nomeConfere('João Souza', 'Rita Souza')).toBe(false);
    expect(nomeConfere('Joana da Silva', 'Maria da Silva')).toBe(false);
    expect(nomeConfere('', 'Ana Teste')).toBe(false);
  });
});

describe('ligarFaltantes', () => {
  it('pelo telefone do aluno, com ou sem o nono dígito e o 55', () => {
    const r = ligarFaltantes([lf('Ana T. Souza', '(51) 9 9000-0001'), lf('Bia', '+55 51 9000-0002')], CLIENTES);
    expect(r.ligados.map((x) => [x.leadId, x.origem])).toEqual([['ana', 'telefone'], ['bia', 'telefone']]);
    expect(r.naoLigados).toEqual([]);
    expect(r.ambiguos).toEqual([]);
  });

  it('pelo telefone do responsável, e o nome desempata os irmãos', () => {
    const r = ligarFaltantes([lf('Pedro Teste', '(51) 9 9000-0099'), lf('LIA TESTE', '(51) 99000-0099')], CLIENTES);
    expect(r.ligados.map((x) => x.leadId)).toEqual(['pedro', 'lia']);
  });

  it('sem nome igual, o nome que confere desempata', () => {
    const r = ligarFaltantes([lf('Pedro Henrique Teste', '(51) 9 9000-0099')], CLIENTES);
    expect(r.ligados.map((x) => [x.leadId, x.origem])).toEqual([['pedro', 'telefone']]);
  });

  it('telefone de mais de um cliente, sem nome que decida, fica ambíguo', () => {
    const r = ligarFaltantes([lf('Teste Junior', '(51) 9 9000-0099')], CLIENTES);
    expect(r.ambiguos).toEqual([{ linha: lf('Teste Junior', '(51) 9 9000-0099'), candidatos: ['pedro', 'lia'] }]);
    const gemeas = [
      cliente('clara', 'Ana Clara Teste', '', { isMinor: true, guardian: MAE }),
      cliente('luiza', 'Ana Luiza Teste', '', { isMinor: true, guardian: MAE }),
    ];
    expect(ligarFaltantes([lf('Ana Teste', '(51) 9 9000-0099')], gemeas).ambiguos[0].candidatos).toEqual(['clara', 'luiza']);
  });

  it('telefone de um cliente só, mas de outra pessoa (a mãe): vai para os ambíguos', () => {
    const r = ligarFaltantes([lf('João Souza', '(51) 9 9000-0020')], CLIENTES);
    expect(r.ligados).toEqual([]);
    expect(r.ambiguos).toEqual([{ linha: lf('João Souza', '(51) 9 9000-0020'), candidatos: ['rita'] }]);
  });

  it('com duas palavras do nome em comum, o telefone liga', () => {
    expect(ligarFaltantes([lf('Maria Rita Souza', '(51) 9 9000-0020')], CLIENTES).ligados[0]).toMatchObject({ leadId: 'rita', origem: 'telefone' });
  });

  it('a ligação feita à mão vale quando o telefone não decide', () => {
    const guardados = { 'teste junior': { nomeNextFit: 'Teste Junior', leadIds: ['pedro'], origem: 'manual' } };
    const r = ligarFaltantes([lf('Teste Junior', '(51) 9 9000-0099'), lf('Teste Junior', '')], CLIENTES, guardados);
    expect(r.ligados.map((x) => [x.leadId, x.origem])).toEqual([['pedro', 'manual'], ['pedro', 'manual']]);
    const filho = { 'joao souza': { nomeNextFit: 'João Souza', leadIds: ['ana'], origem: 'manual' } };
    expect(ligarFaltantes([lf('João Souza', '(51) 9 9000-0020')], CLIENTES, filho).ligados[0]).toMatchObject({ leadId: 'ana', origem: 'manual' });
  });

  it('o telefone que acha um cliente só, com o nome conferindo, ganha da ligação feita à mão', () => {
    const guardados = { 'ana teste souza': { nomeNextFit: 'Ana Teste Souza', leadIds: ['bia'], origem: 'manual' } };
    expect(ligarFaltantes([lf('Ana Teste Souza', '(51) 9 9000-0001')], CLIENTES, guardados).ligados[0].leadId).toBe('ana');
  });

  it('nome guardado pelo telefone não liga no Faltantes', () => {
    const guardados = { 'ana teste souza': { nomeNextFit: 'Ana Teste Souza', leadIds: ['ana'], origem: 'telefone' } };
    const r = ligarFaltantes([lf('Ana Teste Souza', '(51) 9 1111-2222')], CLIENTES, guardados);
    expect(r.naoLigados).toHaveLength(1);
  });

  it('sem telefone, telefone curto ou de quem não é cliente: não ligado', () => {
    const r = ligarFaltantes([lf('Sem Fone', null), lf('Curto', '9000-0001'), lf('Caio Lead', '(51) 9 9000-0003')], CLIENTES);
    expect(r.ligados).toEqual([]);
    expect(r.naoLigados.map((x) => x.nome)).toEqual(['Sem Fone', 'Curto', 'Caio Lead']);
  });

  it('aceita o índice pronto no lugar da lista', () => {
    expect(ligarFaltantes([lf('Ana', '(51) 9 9000-0001')], indiceDeClientes(CLIENTES)).ligados[0].leadId).toBe('ana');
  });
});

describe('ligarPresencas', () => {
  it('nome igual entre os clientes, sem acento e sem espaço a mais', () => {
    const r = ligarPresencas([lp('ANA  TESTE souza'), lp('Bia Teste')], CLIENTES);
    expect(r.ligados.map((x) => [x.leadId, x.origem])).toEqual([['ana', 'nome'], ['bia', 'nome']]);
  });

  it('o nome guardado vale primeiro, e diz de onde veio', () => {
    const guardados = {
      'ana t souza': { nomeNextFit: 'Ana T Souza', leadIds: ['ana'], origem: 'telefone' },
      bia: { nomeNextFit: 'Bia', leadIds: ['bia'], origem: 'manual' },
    };
    const r = ligarPresencas([lp('Ana T. Souza'), lp('Bia')], CLIENTES, guardados);
    expect(r.ligados.map((x) => [x.leadId, x.origem])).toEqual([['ana', 'guardado'], ['bia', 'manual']]);
  });

  it('homônimos e nome guardado com dois clientes ficam ambíguos', () => {
    const guardados = { 'ana teste souza': { nomeNextFit: 'Ana Teste Souza', leadIds: ['ana', 'bia'], origem: 'telefone' } };
    const r = ligarPresencas([lp('João Teste'), lp('Ana Teste Souza')], CLIENTES, guardados);
    expect(r.ambiguos.map((x) => x.candidatos)).toEqual([['joao1', 'joao2'], ['ana', 'bia']]);
  });

  it('nome guardado de quem deixou de ser cliente cai no nome igual', () => {
    const guardados = { 'bia teste': { nomeNextFit: 'Bia Teste', leadIds: ['apagado'], origem: 'telefone' } };
    expect(ligarPresencas([lp('Bia Teste')], CLIENTES, guardados).ligados[0]).toMatchObject({ leadId: 'bia', origem: 'nome' });
  });

  it('nome que ninguém tem não liga', () => {
    expect(ligarPresencas([lp('Ninguém Teste')], CLIENTES).naoLigados).toHaveLength(1);
  });
});

describe('clienteProvavel', () => {
  it('o cliente do nome guardado, de qualquer origem', () => {
    const guardados = { 'ana t souza': { nomeNextFit: 'Ana T. Souza', leadIds: ['ana'], origem: 'telefone' } };
    expect(clienteProvavel(lf('Ana T. Souza', '(51) 9 1111-2222'), CLIENTES, guardados)).toBe('ana');
  });

  it('sem nome guardado, o único cliente com o mesmo nome', () => {
    expect(clienteProvavel(lf('BIA  TESTE', null), CLIENTES)).toBe('bia');
  });

  it('homônimos, nome guardado com dois clientes, quem não é cliente e nome que ninguém tem: null', () => {
    const guardados = { 'ana teste souza': { nomeNextFit: 'Ana Teste Souza', leadIds: ['ana', 'bia'], origem: 'telefone' } };
    expect(clienteProvavel(lf('João Teste', null), CLIENTES)).toBeNull();
    expect(clienteProvavel(lf('Ana Teste Souza', null), CLIENTES, guardados)).toBeNull();
    expect(clienteProvavel(lf('Caio Lead', null), CLIENTES)).toBeNull();
    expect(clienteProvavel(lf('Ninguém Teste', null), CLIENTES)).toBeNull();
    expect(clienteProvavel(lf('', null), CLIENTES)).toBeNull();
  });
});

describe('nomes guardados', () => {
  it('cada ligação pelo telefone guarda o nome da Next Fit', () => {
    const r = ligarFaltantes([lf('Ana T. Souza', '(51) 9 9000-0001')], CLIENTES);
    expect(nomesParaGuardar(r.ligados, {}, CLIENTES)).toEqual({
      'ana t souza': { nomeNextFit: 'Ana T. Souza', leadIds: ['ana'], origem: 'telefone' },
    });
  });

  it('o que já está guardado igual não é gravado de novo', () => {
    const guardados = { 'ana t souza': { nomeNextFit: 'Ana T. Souza', leadIds: ['ana'], origem: 'telefone' } };
    const r = ligarFaltantes([lf('Ana T. Souza', '(51) 9 9000-0001')], CLIENTES);
    expect(nomesParaGuardar(r.ligados, guardados, CLIENTES)).toEqual({});
  });

  it('homônimos com telefones diferentes deixam o nome com os dois', () => {
    const r = ligarFaltantes([lf('João Teste', '(51) 9 9000-0011'), lf('João Teste', '(51) 9 9000-0012')], CLIENTES);
    expect(nomesParaGuardar(r.ligados, {}, CLIENTES)['joao teste'].leadIds).toEqual(['joao1', 'joao2']);
  });

  it('id que deixou de ser cliente sai, e a ligação feita à mão não é trocada', () => {
    const guardados = {
      'bia teste': { nomeNextFit: 'Bia Teste', leadIds: ['apagado'], origem: 'telefone' },
      'ana teste souza': { nomeNextFit: 'Ana Teste Souza', leadIds: ['ana'], origem: 'manual' },
    };
    const r = ligarFaltantes([lf('Bia Teste', '51 99000-0002'), lf('Ana Teste Souza', '(51) 9 9000-0001')], CLIENTES, guardados);
    expect(nomesParaGuardar(r.ligados, guardados, CLIENTES)).toEqual({
      'bia teste': { nomeNextFit: 'Bia Teste', leadIds: ['bia'], origem: 'telefone' },
    });
  });

  it('ligação à mão da prévia vira o documento do nome', () => {
    expect(nomesManuais([{ nomeNextFit: ' Pedro H. Teste ', leadId: 'pedro' }, { nomeNextFit: '', leadId: 'x' }, { nomeNextFit: 'Sem Id' }])).toEqual({
      'pedro h teste': { nomeNextFit: 'Pedro H. Teste', leadIds: ['pedro'], origem: 'manual' },
    });
  });
});
