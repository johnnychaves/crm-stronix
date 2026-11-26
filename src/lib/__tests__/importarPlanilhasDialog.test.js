// @vitest-environment jsdom
// A janela "Importar planilhas da Next Fit" (src/views/faltosos/importacao/),
// passo a passo: arquivos, professores novos, prévia com ligação à mão e
// gravação. O arquivo, a leitura da base e a gravação são dublês; o leitor das
// planilhas e o plano são os de verdade, com planilhas falsas do mesmo
// cabeçalho das reais. Nada é gravado antes do Confirmar.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { CONFIG_FALTOSOS_PADRAO } from '../faltosos/configFaltosos.js';
import { FALTANTES_HEADER, PRESENCAS_HEADER } from '../faltosos/nextfitArquivos.js';

const toast = vi.hoisted(() => ({ show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }));
const mundo = vi.hoisted(() => ({ planilhas: {}, bases: [], erroDaBase: null, gravacoes: [] }));

vi.mock('../firebase.js', () => ({
  appId: 'acad', db: {}, auth: {}, storage: {},
  LEADS_PATH: 'stronix_leads', INTERACTIONS_PATH: 'stronix_interactions', CONFIG_PATH: 'stronix_config',
  CONFIG_FALTOSOS_ID: 'faltosos', FALTOSOS_PATH: 'stronix_faltosos', PRESENCAS_PATH: 'stronix_presencas',
  IMPORTACOES_NEXTFIT_PATH: 'stronix_importacoes_nextfit', NEXTFIT_ALUNOS_PATH: 'stronix_nextfit_alunos',
}));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => toast }));
vi.mock('../spreadsheetRead.js', () => ({
  readSpreadsheetFile: vi.fn(async (file) => {
    const p = mundo.planilhas[file.name];
    if (!p) throw new Error('arquivo ilegível');
    return p;
  }),
}));
vi.mock('../faltosos/lerImportacao.js', () => ({
  // Cada leitura devolve a próxima base da fila; a última se repete.
  lerBaseDaImportacao: vi.fn(async () => {
    if (mundo.erroDaBase) throw mundo.erroDaBase;
    return mundo.bases.length > 1 ? mundo.bases.shift() : mundo.bases[0];
  }),
}));
vi.mock('../faltosos/gravarImportacao.js', () => ({
  // Cada gravação usa a próxima resposta da fila; sem resposta, grava tudo.
  gravarImportacao: vi.fn(async ({ onProgress }) => {
    const resposta = mundo.gravacoes.shift();
    if (resposta instanceof Error) throw resposta;
    if (typeof resposta === 'function') return resposta({ onProgress });
    onProgress?.(2, 4);
    if (resposta) return resposta;
    onProgress?.(4, 4);
    return { ok: true, gravadas: 4, total: 4, lote: null, lotes: 2, jaExistia: false, erro: null };
  }),
}));

const { ImportarPlanilhasDialog } = await import('../../views/faltosos/importacao/ImportarPlanilhasDialog.jsx');
const { lerBaseDaImportacao } = await import('../faltosos/lerImportacao.js');
const { gravarImportacao } = await import('../faltosos/gravarImportacao.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const fimContrato = (dia) => new Date(`${dia}T00:00:00-03:00`);
const faltante = (nome, ausencias, ultima, professor, telefone) => ({
  Nome: nome, Contrato: 'PLANO ANUAL', 'Qtde de ausências': ausencias, 'Última presença': ultima,
  Telefone: telefone, Professor: professor, Consultor: 'BIA',
});
const comLinha = (rows) => rows.map((r, i) => ({ __row: i + 2, ...r }));
const PLANILHAS = {
  'faltantes.xlsx': {
    headers: [...FALTANTES_HEADER],
    rows: comLinha([
      faltante('ANA LIMA', 11, '25/09/2026', 'RAFAEL MENEZES DA SILVA SANTO', '(51) 9 9999-0001'),
      faltante('JOAO SEM CADASTRO', 8, '28/09/2026', 'CONTROLE (NAO ALTERAR)', '(51) 9 9999-0002'),
      faltante('CAIO TESTE', 30, '06/09/2026', 'LUANA PRADO', '(51) 9 9999-0003'),
    ]),
  },
  'presencas.xlsx': {
    headers: [...PRESENCAS_HEADER],
    rows: comLinha([
      { Cliente: 'BIA SOUZA', Modalidade: 'offf', Contrato: 'PLANO ANUAL', Tipo: 'Acesso', Data: '01/10/2026 07:00' },
      { Cliente: 'BIA SOUZA', Modalidade: 'Pilates', Contrato: 'PLANO ANUAL', Tipo: 'Agenda', Data: '06/10/2026 18:30' },
    ]),
  },
  'acessos.xlsx': {
    headers: ['AcessoLiberado', 'Cliente', 'Contrato', 'Acesso', 'ModoReconhecimento', 'Offline', 'Motivo'],
    rows: comLinha([{ AcessoLiberado: 'Sim', Cliente: 'ANA LIMA', Contrato: 'PLANO ANUAL', Acesso: '01/10/2026 07:00' }]),
  },
};
const PROFESSORES = [
  { id: 'p-rafa', nome: 'Rafael Menezes da Silva Santos', ativo: true },
  { id: 'p-lu', nome: 'Luana Prado', ativo: true },
];
const cliente = (id, name, whatsapp, extra = {}) => ({
  id, name, whatsapp, lifecycleBucket: 'cliente', lifecycleStage: 'cliente',
  currentContractId: `c-${id}`, currentContractStatus: 'ativo',
  currentContractStartsAt: fimContrato('2026-01-10'), currentContractEndsAt: fimContrato('2027-06-10'),
  ...extra,
});
const ULTIMA = { id: 'f2026-09-29_p2026-09-22_2026-09-30', dataFaltantes: '2026-09-29', periodoPresencas: { de: '2026-09-22', ate: '2026-09-30' }, importadoEm: null, importadoPorNome: 'Johnny' };
const CONFIG_DOC = { professorLinks: [{ nome: 'LUANA PRADO', professorId: 'p-lu' }], ultimaImportacao: ULTIMA };
const BASE = {
  clientes: [
    cliente('l-ana', 'Ana Lima', '51999990001'),
    cliente('l-caio', 'Caio Teste', '51999990003', { currentContractEndsAt: fimContrato('2026-11-30') }),
    cliente('l-bia', 'Bia Souza', '51999990004'),
    cliente('l-joao', 'João Pedro', '51999990009'),
  ],
  estadosAtuais: {},
  nomesGuardados: {},
  presencasAtuais: {},
  configDoc: CONFIG_DOC,
};
const CONFIG_DA_TELA = { ...CONFIG_FALTOSOS_PADRAO, professorLinks: CONFIG_DOC.professorLinks, ultimaImportacao: ULTIMA, pronta: true };
const GESTOR = { id: 'g1', name: 'Johnny', role: 'admin', authUid: 'auth-g1', tenantId: 'acad', tenantModules: ['faltosos'] };

let root = null;
let fechou = 0;
async function montar({ faltosos = CONFIG_DA_TELA } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(GeneralConfigContext.Provider, { value: { professores: PROFESSORES, faltosos } },
      h(ImportarPlanilhasDialog, { appUser: GESTOR, db: {}, onClose: () => { fechou += 1; } })));
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // 06/10/2026, meio-dia em Brasília.
  vi.setSystemTime(new Date('2026-10-06T15:00:00Z'));
  mundo.planilhas = PLANILHAS;
  mundo.bases = [BASE];
  mundo.erroDaBase = null;
  mundo.gravacoes = [];
  fechou = 0;
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.clearAllMocks();
  vi.useRealTimers();
});

const esperar = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const botao = (texto) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
const texto = () => document.body.textContent;
async function clicar(el) {
  await act(async () => { el.click(); });
  await esperar();
}
async function soltar(...nomes) {
  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { value: nomes.map((n) => new File(['x'], n)), configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  await esperar();
}
async function escrever(el, valor) {
  const proto = el instanceof window.HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event(el instanceof window.HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
const escolha = (nome) => document.querySelector(`select[aria-label="Professor do cadastro para ${nome}"]`);
const alerta = () => document.querySelector('[role="alert"]')?.textContent ?? '';

async function irParaPrevia() {
  await montar();
  await soltar('faltantes.xlsx', 'presencas.xlsx');
  await clicar(botao('Continuar'));
  await escrever(escolha('CONTROLE (NAO ALTERAR)'), '__sem_professor__');
  await clicar(botao('Continuar'));
}

describe('passo dos arquivos', () => {
  it('reconhece os dois relatórios pelo cabeçalho, em qualquer ordem, e lembra como exportar', async () => {
    await montar();
    expect(texto()).toContain('Faltantes: exporte com o filtro de 7 dias sem vir.');
    expect(texto()).toContain('Presenças: exporte de 01/10 até hoje.');
    expect(botao('Continuar').disabled).toBe(true);
    await soltar('presencas.xlsx', 'faltantes.xlsx');
    expect(document.querySelector('[data-arquivo="faltantes"]').textContent).toContain('3 alunos · exportado em 06/10/2026');
    expect(document.querySelector('[data-arquivo="presencas"]').textContent).toContain('2 presenças · de 01/10 a 06/10');
    expect(botao('Continuar').disabled).toBe(false);
  });

  it('arquivo que não é da Next Fit é recusado com o texto da spec', async () => {
    await montar();
    await soltar('acessos.xlsx');
    expect(alerta()).toContain('acessos.xlsx: Esse arquivo não é o relatório Faltantes nem o Presenças da Next Fit.');
    expect(botao('Continuar').disabled).toBe(true);
  });

  it('arquivo que não abre é recusado sem derrubar a janela', async () => {
    await montar();
    await soltar('quebrado.xlsx');
    expect(alerta()).toContain('Não deu para ler esse arquivo.');
  });

  it('Faltantes mais antigo que o último importado é recusado na hora, sem ler a base', async () => {
    await montar({ faltosos: { ...CONFIG_DA_TELA, ultimaImportacao: { ...ULTIMA, dataFaltantes: '2026-10-07' } } });
    await soltar('faltantes.xlsx');
    expect(alerta()).toContain('06/10/2026');
    expect(alerta()).toContain('07/10/2026');
    expect(botao('Continuar').disabled).toBe(true);
    expect(lerBaseDaImportacao).not.toHaveBeenCalled();
  });

  it('tirar o arquivo devolve o espaço vazio', async () => {
    await montar();
    await soltar('faltantes.xlsx');
    await clicar(document.querySelector('button[aria-label="Tirar o Faltantes"]'));
    expect(document.querySelector('[data-arquivo="faltantes"]')).toBeNull();
    expect(botao('Continuar').disabled).toBe(true);
  });
});

describe('da leitura da base à prévia', () => {
  it('lê a base da academia da janela, com os meses do Presenças, e pede só os professores novos', async () => {
    await montar();
    await soltar('faltantes.xlsx', 'presencas.xlsx');
    await clicar(botao('Continuar'));
    expect(lerBaseDaImportacao).toHaveBeenCalledWith({ db: {}, tenant: 'acad', mesesPresencas: ['2026-10'] });
    // LUANA PRADO já tem ligação; os outros dois são novos.
    expect([...document.querySelectorAll('select[aria-label^="Professor do cadastro"]')].map((s) => s.getAttribute('aria-label')))
      .toEqual(['Professor do cadastro para CONTROLE (NAO ALTERAR)', 'Professor do cadastro para RAFAEL MENEZES DA SILVA SANTO']);
    // O nome cortado em 29 letras pela Next Fit já vem com a sugestão.
    expect(escolha('RAFAEL MENEZES DA SILVA SANTO').value).toBe('p-rafa');
    expect(texto()).toContain('sugerido pelo nome');
    expect(escolha('CONTROLE (NAO ALTERAR)').value).toBe('');
    expect(botao('Continuar').disabled).toBe(true);
    expect(gravarImportacao).not.toHaveBeenCalled();
  });

  it('com as escolhas feitas, a prévia mostra as datas, os números, cada professor e os não ligados', async () => {
    await irParaPrevia();
    expect(texto()).toContain('Faltantes de 06/10/2026 · Presenças de 01/10 a 06/10. Nada foi gravado ainda.');
    expect(texto()).toContain('Entram no marco de 7 dias');
    expect(texto()).toContain('Urgentes');
    expect(texto()).toContain('Rafael Menezes da Silva Santos');
    expect(document.querySelector('[data-nao-ligado="joao sem cadastro"]').textContent).toContain('(51) 9 9999-0002');
    expect(botao('Confirmar e gravar').disabled).toBe(false);
    expect(gravarImportacao).not.toHaveBeenCalled();
  });

  it('sem nome novo de professor, vai direto para a prévia', async () => {
    mundo.bases = [{
      ...BASE,
      configDoc: {
        ...CONFIG_DOC,
        professorLinks: [
          { nome: 'LUANA PRADO', professorId: 'p-lu' },
          { nome: 'CONTROLE (NAO ALTERAR)', professorId: null },
          { nome: 'RAFAEL MENEZES DA SILVA SANTO', professorId: 'p-rafa' },
        ],
      },
    }];
    await montar();
    await soltar('faltantes.xlsx');
    await clicar(botao('Continuar'));
    expect(document.querySelector('select')).toBeNull();
    expect(botao('Confirmar e gravar')).toBeTruthy();
  });

  it('a leitura que falha volta aos arquivos e diz o motivo', async () => {
    mundo.erroDaBase = Object.assign(new Error('negado'), { code: 'permission-denied' });
    await montar();
    await soltar('faltantes.xlsx');
    await clicar(botao('Continuar'));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('regras novas foram publicadas'));
    expect(botao('Continuar')).toBeTruthy();
    expect(document.querySelector('[data-arquivo="faltantes"]')).toBeTruthy();
  });

  it('a data do Faltantes é conferida de novo com a configuração do servidor', async () => {
    mundo.bases = [{ ...BASE, configDoc: { ...CONFIG_DOC, ultimaImportacao: { ...ULTIMA, dataFaltantes: '2026-10-08' } } }];
    await montar();
    await soltar('faltantes.xlsx');
    await clicar(botao('Continuar'));
    expect(alerta()).toContain('08/10/2026');
    expect(botao('Continuar').disabled).toBe(true);
  });
});

describe('ligação à mão na prévia', () => {
  it('busca o cliente, liga, refaz a prévia e deixa desfazer', async () => {
    await irParaPrevia();
    const busca = document.querySelector('input[aria-label="Buscar cliente para JOAO SEM CADASTRO"]');
    await escrever(busca, 'joão');
    await clicar([...document.querySelectorAll('ul[aria-label="Clientes para JOAO SEM CADASTRO"] button')].find((b) => b.textContent.includes('João Pedro')));
    expect(document.querySelector('[data-nao-ligado]')).toBeNull();
    expect(document.querySelector('ul[aria-label="Ligados à mão nesta importação"]').textContent).toContain('JOAO SEM CADASTRO ligado a João Pedro');
    await clicar(botao('Desfazer'));
    expect(document.querySelector('[data-nao-ligado="joao sem cadastro"]')).toBeTruthy();
  });
});

describe('gravação', () => {
  it('o Confirmar grava o plano da prévia, com o replanejar, a última importação lida e quem importou', async () => {
    await irParaPrevia();
    await clicar(botao('Confirmar e gravar'));
    // A releitura do estado dos alunos é da gravação (replanejar), e não da janela.
    expect(lerBaseDaImportacao).toHaveBeenCalledTimes(1);
    expect(gravarImportacao).toHaveBeenCalledTimes(1);
    const pedido = gravarImportacao.mock.calls[0][0];
    expect(pedido.tenant).toBe('acad');
    expect(pedido.quem).toEqual({ uid: 'auth-g1', id: 'g1', nome: 'Johnny' });
    expect(pedido.ultimaImportacaoLida).toEqual(ULTIMA);
    expect(pedido.plano.prontoParaGravar).toBe(true);
    expect(pedido.plano.recusa).toBeNull();
    expect(pedido.plano.previa.dataFaltantes).toBe('2026-10-06');
    expect(pedido).not.toHaveProperty('professorLinks');
    // O replanejar roda o mesmo plano com os estados que a gravação ler.
    const refeito = pedido.replanejar({});
    expect(refeito.importacao.id).toBe(pedido.plano.importacao.id);
    expect(refeito.prontoParaGravar).toBe(true);
    expect(texto()).toContain('Importação gravada.');
    expect(toast.success).toHaveBeenCalledWith('Importação gravada.');
    await clicar(botao('Fechar'));
    expect(fechou).toBe(1);
  });

  it('a ligação feita à mão vai no plano gravado', async () => {
    await irParaPrevia();
    await escrever(document.querySelector('input[aria-label="Buscar cliente para JOAO SEM CADASTRO"]'), 'joão');
    await clicar([...document.querySelectorAll('ul[aria-label="Clientes para JOAO SEM CADASTRO"] button')].find((b) => b.textContent.includes('João Pedro')));
    await clicar(botao('Confirmar e gravar'));
    const { plano } = gravarImportacao.mock.calls[0][0];
    expect(plano.nomesAlunos).toEqual(expect.arrayContaining([
      expect.objectContaining({ doc: expect.objectContaining({ nomeNextFit: 'JOAO SEM CADASTRO', leadIds: ['l-joao'], origem: 'manual' }) }),
    ]));
  });

  it('se a gravação para no meio, diz o que fazer e tenta de novo com o mesmo plano', async () => {
    mundo.gravacoes = [{ ok: false, gravadas: 2, total: 4, lote: 2, lotes: 3, jaExistia: false, erro: new Error('rede caiu') }];
    await irParaPrevia();
    await clicar(botao('Confirmar e gravar'));
    expect(alerta()).toContain('A gravação parou no lote 2 de 3.');
    expect(texto()).toContain('2 de 4 gravações');
    await clicar(botao('Tentar de novo'));
    expect(gravarImportacao).toHaveBeenCalledTimes(2);
    expect(gravarImportacao.mock.calls[1][0].plano).toBe(gravarImportacao.mock.calls[0][0].plano);
    expect(lerBaseDaImportacao).toHaveBeenCalledTimes(1);
    expect(texto()).toContain('Importação gravada.');
  });

  it('outra importação gravada com a janela aberta: diz o que houve e só deixa fechar', async () => {
    const texto1 = 'Outra importação foi gravada enquanto esta janela estava aberta. Nada foi gravado. Feche a janela e importe os arquivos de novo.';
    mundo.gravacoes = [{ ok: false, gravadas: 0, total: 0, lote: null, lotes: 0, jaExistia: false, erro: Object.assign(new Error(texto1), { code: 'outra-importacao' }) }];
    await irParaPrevia();
    await clicar(botao('Confirmar e gravar'));
    expect(alerta()).toContain(texto1);
    expect(botao('Tentar de novo')).toBeUndefined();
    await clicar(botao('Fechar'));
    expect(fechou).toBe(1);
  });

  it('plano com defeito não grava nada e não oferece tentar de novo', async () => {
    mundo.gravacoes = [new Error('plano da importação inválido: volta sem leadId')];
    await irParaPrevia();
    await clicar(botao('Confirmar e gravar'));
    expect(alerta()).toContain('nada foi gravado');
    expect(botao('Tentar de novo')).toBeUndefined();
    expect(botao('Fechar')).toBeTruthy();
  });

  it('durante a gravação a janela não fecha', async () => {
    let terminar;
    mundo.gravacoes = [() => new Promise((r) => { terminar = r; })];
    await irParaPrevia();
    await clicar(botao('Confirmar e gravar'));
    expect(document.querySelector('button[aria-label="Fechar"]')).toBeNull();
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(fechou).toBe(0);
    await act(async () => { terminar({ ok: true, gravadas: 4, total: 4, lote: null, lotes: 2, jaExistia: true, erro: null }); });
    await esperar();
    expect(texto()).toContain('Essa importação já tinha sido gravada.');
  });

  it('voltar da prévia leva aos professores, e de lá aos arquivos', async () => {
    await irParaPrevia();
    await clicar(botao('Voltar'));
    expect(escolha('RAFAEL MENEZES DA SILVA SANTO')).toBeTruthy();
    await clicar(botao('Voltar'));
    expect(document.querySelector('[data-arquivo="faltantes"]')).toBeTruthy();
    expect(gravarImportacao).not.toHaveBeenCalled();
  });
});
