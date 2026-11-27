// @vitest-environment jsdom
// O bloco Faltosos de Configurações → Metas & ritmo (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "Configurações"): só para o gestor, com o módulo ligado e com a configuração
// do módulo já lida; a última importação, como exportar e o botão que abre a
// janela de importação; marcos de 1 a 6 números de 1 a 365 sem repetir, janela
// do urgente e a troca do professor de cada nome da Next Fit. Grava
// stronix_config/faltosos com merge. Sem Firebase de verdade, e a janela de
// importação vira um marcador.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setDoc } from 'firebase/firestore';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));

// O que as leituras do bloco devolvem: estados sem professor, leads por id e o
// registro da última importação.
const lido = vi.hoisted(() => ({ faltosos: [], leads: [], registro: null }));
const docsDe = (lista) => ({ docs: lista.map((d) => ({ id: d.id, data: () => d })) });

vi.mock('../firebase.js', () => ({
  appId: 'academia-teste',
  CONFIG_PATH: 'stronix_config',
  CONFIG_FALTOSOS_ID: 'faltosos',
  FALTOSOS_PATH: 'stronix_faltosos',
  LEADS_PATH: 'stronix_leads',
  IMPORTACOES_NEXTFIT_PATH: 'stronix_importacoes_nextfit',
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
  collection: (_db, ...caminho) => ({ caminho: caminho.join('/') }),
  query: (ref) => ref,
  where: () => ({}),
  documentId: () => 'id',
  getDocs: vi.fn(async (ref) => docsDe(ref.caminho.endsWith('stronix_faltosos') ? lido.faltosos : lido.leads)),
  getDoc: vi.fn(async () => ({ exists: () => Boolean(lido.registro), data: () => lido.registro })),
  setDoc: vi.fn(async () => {}),
  serverTimestamp: () => 'agora',
}));
vi.mock('../../contexts/ToastContext.jsx', () => ({ useToast: () => toast }));
vi.mock('../../views/faltosos/importacao/ImportarPlanilhasDialog.jsx', async () => {
  const { createElement } = await import('react');
  return {
    ImportarPlanilhasDialog: ({ onClose }) => createElement('div', { 'data-janela-importacao': '' },
      createElement('button', { type: 'button', onClick: onClose }, 'Fechar a janela')),
  };
});

const { FaltososPanel } = await import('../../views/settings/FaltososPanel.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Lê o PaceSection.jsx pelo caminho relativo a este teste. No jsdom o new URL
// resolve contra a base http do jsdom, então o caminho sai do import.meta.url
// como texto, como no tenantModulesCard.test.js.
const AQUI = dirname(fileURLToPath(import.meta.url));

const PROFESSORES = [
  { id: 'prof-rafa', nome: 'Rafael Menezes', ativo: true },
  { id: 'prof-lu', nome: 'Luana Prado' },
  { id: 'prof-velho', nome: 'Carlos Antigo', ativo: false },
];
// A configuração como o App entrega no contexto, já lida e normalizada.
const CONFIG = {
  marcos: [7, 14, 30, 60],
  janelaUrgenteDias: 90,
  professorLinks: [
    { nome: 'RAFAEL MENEZES', professorId: 'prof-rafa' },
    { nome: 'CONTROLE (NÃO ALTERAR)', professorId: null },
    { nome: 'CARLOS ANTIGO', professorId: 'prof-velho' },
  ],
  ultimaImportacao: null,
  pronta: true,
};
const CAMINHO = 'artifacts/academia-teste/public/data/stronix_config/faltosos';
// O login do gestor, com o módulo ligado na academia: é o que a SettingsView
// passa à PaceSection, que o entrega ao bloco.
const GESTOR = { id: 'g1', name: 'Bruno', role: 'admin', tenantId: 'academia-teste', tenantModules: ['faltosos'] };

let root = null;
async function montar({ valor = { professores: PROFESSORES, faltosos: CONFIG }, appUser = GESTOR } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(h(GeneralConfigContext.Provider, { value: valor }, h(FaltososPanel, { db: {}, appUser })));
  });
}

beforeEach(() => {
  // 06/10/2026, meio-dia em Brasília: o lembrete de exportação conta até hoje.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-06T15:00:00Z'));
  setDoc.mockClear();
  lido.faltosos = []; lido.leads = []; lido.registro = null;
  for (const fn of Object.values(toast)) fn.mockClear();
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function escrever(el, valor) {
  const ehSelect = el instanceof window.HTMLSelectElement;
  const proto = ehSelect ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event(ehSelect ? 'change' : 'input', { bubbles: true }));
  });
}
async function clicar(el) {
  await act(async () => { el.click(); await new Promise((r) => setTimeout(r, 0)); });
}
async function sair(el) {
  await act(async () => { el.focus(); el.blur(); await new Promise((r) => setTimeout(r, 0)); });
}
async function enviar(form) {
  await act(async () => { form.requestSubmit(); await new Promise((r) => setTimeout(r, 0)); });
}
const botao = (rotulo) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const marcos = () => [...document.querySelectorAll('[aria-labelledby="faltosos-marcos"] li')].map((li) => li.textContent.trim());
const gravado = () => setDoc.mock.calls.map(([ref, dados, opcoes]) => [ref.caminho, dados, opcoes]);
const campoDoMarco = () => document.querySelector('[role="dialog"] input[type="number"]');
const formDoMarco = () => document.querySelector('[role="dialog"] form');

describe('bloco Faltosos: quando aparece', () => {
  it('sem a configuração dos faltosos no contexto (sem o módulo), não desenha nada', async () => {
    await montar({ valor: { professores: PROFESSORES } });
    expect(document.body.textContent).toBe('');
  });

  it('antes de a configuração ser lida, não desenha nada', async () => {
    await montar({ valor: { professores: PROFESSORES, faltosos: { ...CONFIG, pronta: false } } });
    expect(document.body.textContent).toBe('');
  });

  it('sem o módulo no login, não desenha nada, mesmo com a configuração lida', async () => {
    await montar({ appUser: { ...GESTOR, tenantModules: [] } });
    expect(document.body.textContent).toBe('');
  });

  it('o bloco é só do gestor: o consultor, o professor e a sessão vazia não veem', async () => {
    for (const appUser of [{ ...GESTOR, role: 'consultant' }, { ...GESTOR, role: 'professor', professorId: 'prof-rafa' }, null]) {
      await montar({ appUser });
      expect(document.body.textContent, String(appUser?.role)).toBe('');
      await act(async () => { root.unmount(); });
      document.body.innerHTML = '';
    }
  });

  it('a leitura que falhou mostra só o aviso, sem o botão e sem os campos', async () => {
    await montar({ valor: { professores: PROFESSORES, faltosos: { ...CONFIG, erro: true } } });
    expect(document.querySelector('[role="alert"]').textContent).toBe('Não deu para ler a configuração dos faltosos. Recarregue a página.');
    expect(botao('Importar planilhas')).toBeUndefined();
    expect(marcos()).toEqual([]);
    expect(document.querySelector('input')).toBeNull();
  });

  it('com a configuração lida, mostra marcos, janela e professores', async () => {
    await montar();
    expect(document.querySelector('h3').textContent).toBe('Faltosos');
    expect(marcos()).toEqual(['7 dias', '14 dias', '30 dias', '60 dias']);
    expect(document.querySelector('input[aria-label="Janela do urgente, em dias"]').value).toBe('90');
    const nomes = [...document.querySelectorAll('select')].map((s) => s.getAttribute('aria-label'));
    expect(nomes).toEqual([
      'Professor ligado a CARLOS ANTIGO', 'Professor ligado a CONTROLE (NÃO ALTERAR)', 'Professor ligado a RAFAEL MENEZES',
    ]);
  });

  it('Metas & ritmo monta o bloco no fim da seção, com o login que a SettingsView passa', () => {
    const pace = readFileSync(join(AQUI, '../../views/settings/PaceSection.jsx'), 'utf8');
    expect(pace).toContain("import { FaltososPanel } from './FaltososPanel.jsx';");
    expect(pace).toContain('function PaceSection({ db, usersList, metaWeekdays, appUser }) {');
    expect(pace).toContain('<FaltososPanel db={db} appUser={appUser} />');
    const settings = readFileSync(join(AQUI, '../../views/settings/SettingsView.jsx'), 'utf8');
    expect(settings).toContain('<PaceSection db={db} usersList={usersList} metaWeekdays={metaWeekdays} appUser={appUser} />');
  });
});

describe('bloco Faltosos: importação', () => {
  const ULTIMA = {
    id: 'f2026-10-06_p2026-09-29_2026-10-05', dataFaltantes: '2026-10-06', dataFaltantesAnterior: '2026-09-29',
    periodoPresencas: { de: '2026-09-29', ate: '2026-10-05' }, ultimoDiaPresencas: '2026-10-05',
    importadoEm: new Date('2026-10-06T12:12:00Z'), importadoPorNome: 'Johnny',
  };
  const textoDe = (id) => document.getElementById(id)?.closest('section')?.textContent ?? '';

  it('mostra a última importação: quando, quem, a data do Faltantes e o período do Presenças', async () => {
    await montar({ valor: { professores: PROFESSORES, faltosos: { ...CONFIG, ultimaImportacao: ULTIMA } } });
    expect(document.getElementById('faltosos-importacao').textContent).toBe('Última importação: 06/10 às 09:12, por Johnny');
    expect(textoDe('faltosos-importacao')).toContain('Faltantes de 06/10/2026 · Presenças de 29/09 a 05/10');
    expect(textoDe('faltosos-importacao')).toContain(
      'Como exportar da Next Fit. Faltantes: exporte com o filtro de 7 dias sem vir. Presenças: exporte de 06/10 até hoje.',
    );
  });

  it('antes da primeira importação, diz que não há nenhuma e como exportar', async () => {
    await montar();
    expect(document.getElementById('faltosos-importacao').textContent).toBe('Nenhuma importação ainda');
    expect(textoDe('faltosos-importacao')).toContain('Presenças: exporte a última semana, até hoje.');
  });

  it('o botão abre a janela, que só carrega nessa hora, e fechar a tira da tela', async () => {
    await montar();
    expect(document.querySelector('[data-janela-importacao]')).toBeNull();
    await act(async () => { botao('Importar planilhas').click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(document.querySelector('[data-janela-importacao]')).toBeTruthy();
    await act(async () => { botao('Fechar a janela').click(); });
    expect(document.querySelector('[data-janela-importacao]')).toBeNull();
  });
});

describe('bloco Faltosos: marcos', () => {
  it('Novo marco grava a lista em ordem, com merge', async () => {
    await montar();
    await clicar(botao('Novo marco'));
    await escrever(campoDoMarco(), '21');
    await enviar(formDoMarco());
    expect(gravado()).toEqual([[CAMINHO, { marcos: [7, 14, 21, 30, 60], updatedAt: 'agora' }, { merge: true }]]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('marco repetido ou vazio não grava e avisa', async () => {
    await montar();
    await clicar(botao('Novo marco'));
    await escrever(campoDoMarco(), '14');
    await enviar(formDoMarco());
    await escrever(campoDoMarco(), '');
    await enviar(formDoMarco());
    expect(setDoc).not.toHaveBeenCalled();
    expect(toast.warning.mock.calls.map(([t]) => t)).toEqual([
      'O marco de 14 dias já existe.', 'Informe um número inteiro de dias entre 1 e 365.',
    ]);
  });

  it('fora de 1 a 365 o próprio campo barra o envio, e nada é gravado', async () => {
    // min, max e step no campo: o navegador barra o envio antes, e o
    // adicionarMarco repete a regra para o valor que passar.
    await montar();
    await clicar(botao('Novo marco'));
    for (const valor of ['400', '0', '7.5']) {
      await escrever(campoDoMarco(), valor);
      await enviar(formDoMarco());
    }
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('com seis marcos, o Novo marco fica desligado', async () => {
    await montar({ valor: { professores: PROFESSORES, faltosos: { ...CONFIG, marcos: [7, 14, 21, 30, 45, 60] } } });
    expect(botao('Novo marco').disabled).toBe(true);
  });

  it('remover grava o resto, mas o último marco fica', async () => {
    await montar();
    await clicar(document.querySelector('button[aria-label="Remover o marco de 14 dias"]'));
    expect(gravado()).toEqual([[CAMINHO, { marcos: [7, 30, 60], updatedAt: 'agora' }, { merge: true }]]);
    await act(async () => { root.unmount(); });
    setDoc.mockClear();
    await montar({ valor: { professores: PROFESSORES, faltosos: { ...CONFIG, marcos: [7] } } });
    await clicar(document.querySelector('button[aria-label="Remover o marco de 7 dias"]'));
    expect(setDoc).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('Mantenha ao menos um marco de falta.');
  });

  it('a falha ao gravar os marcos avisa e deixa a janela aberta', async () => {
    setDoc.mockRejectedValueOnce(new Error('permission-denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar();
    await clicar(botao('Novo marco'));
    await escrever(campoDoMarco(), '21');
    await enviar(formDoMarco());
    expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar os marcos de falta.');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
});

describe('bloco Faltosos: janela do urgente', () => {
  const campo = () => document.querySelector('input[aria-label="Janela do urgente, em dias"]');

  it('salva ao sair do campo e avisa que vale a partir da próxima importação', async () => {
    await montar();
    await escrever(campo(), '120');
    await sair(campo());
    expect(gravado()).toEqual([[CAMINHO, { janelaUrgenteDias: 120, updatedAt: 'agora' }, { merge: true }]]);
    expect(toast.success).toHaveBeenCalledWith('Urgente: contrato terminando em até 120 dias. Vale a partir da próxima importação.');
  });

  it('o mesmo valor não grava, e o inválido volta para o salvo', async () => {
    await montar();
    await sair(campo());
    expect(setDoc).not.toHaveBeenCalled();
    await escrever(campo(), '0');
    await sair(campo());
    expect(setDoc).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('Informe um número inteiro de dias entre 1 e 365.');
    expect(campo().value).toBe('90');
  });
});

describe('bloco Faltosos: professores da Next Fit', () => {
  const escolha = (nome) => document.querySelector(`select[aria-label="Professor ligado a ${nome}"]`);
  const opcoes = (select) => [...select.options].map((o) => o.textContent);

  it('cada nome mostra o professor ligado, e as opções são Sem professor e os ativos', async () => {
    await montar();
    expect(escolha('RAFAEL MENEZES').value).toBe('prof-rafa');
    expect(escolha('CONTROLE (NÃO ALTERAR)').value).toBe('');
    expect(opcoes(escolha('RAFAEL MENEZES'))).toEqual(['Sem professor', 'Luana Prado', 'Rafael Menezes']);
    // O inativo continua aparecendo na linha que já está ligada a ele.
    expect(escolha('CARLOS ANTIGO').value).toBe('prof-velho');
    expect(opcoes(escolha('CARLOS ANTIGO')).at(-1)).toBe('Carlos Antigo (inativo)');
  });

  it('trocar grava a lista inteira com só aquele nome mudado, e vale na próxima importação', async () => {
    await montar();
    await escrever(escolha('RAFAEL MENEZES'), 'prof-lu');
    expect(gravado()).toEqual([[CAMINHO, {
      professorLinks: [
        { nome: 'RAFAEL MENEZES', professorId: 'prof-lu' },
        { nome: 'CONTROLE (NÃO ALTERAR)', professorId: null },
        { nome: 'CARLOS ANTIGO', professorId: 'prof-velho' },
      ],
      updatedAt: 'agora',
    }, { merge: true }]]);
    expect(toast.success).toHaveBeenCalledWith('Ligação salva. Vale a partir da próxima importação.');
  });

  it('Sem professor grava null', async () => {
    await montar();
    await escrever(escolha('RAFAEL MENEZES'), '');
    expect(gravado()[0][1].professorLinks[0]).toEqual({ nome: 'RAFAEL MENEZES', professorId: null });
  });

  it('antes da primeira importação, diz de onde os nomes vêm', async () => {
    await montar({ valor: { professores: PROFESSORES, faltosos: { ...CONFIG, professorLinks: [] } } });
    expect(document.querySelector('select')).toBeNull();
    expect(document.body.textContent).toContain('Os nomes aparecem aqui depois da primeira importação do relatório Faltantes.');
  });

  it('a falha ao gravar avisa', async () => {
    setDoc.mockRejectedValueOnce(new Error('permission-denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await montar();
    await escrever(escolha('RAFAEL MENEZES'), 'prof-lu');
    expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar a ligação do professor.');
  });

  it('os textos da tela não têm travessão nem aspas curvas', async () => {
    await montar();
    expect(document.body.textContent).not.toMatch(/[—–“”‘’]/);
  });
});

describe('bloco Faltosos: sem professor e não achados', () => {
  const COM_IMPORTACAO = { ...CONFIG, ultimaImportacao: { id: 'f2026-10-06', importadoEm: new Date('2026-10-06T12:00:00Z') } };

  it('lista quem ficou sem professor e o que a importação não achou', async () => {
    lido.faltosos = [{ id: 'l1', status: 'faltando', professorId: null }, { id: 'l2', status: 'voltou', professorId: null }];
    lido.leads = [{ id: 'l1', name: 'Jéssica Lemos' }];
    lido.registro = { naoLigados: [{ nome: 'JOAO PEDRO S. LIMA', telefone: '51996345519', relatorio: 'faltantes' }] };
    await montar({ valor: { professores: PROFESSORES, faltosos: COM_IMPORTACAO } });
    expect(document.body.textContent).toContain('Sem professor');
    expect(document.body.textContent).toContain('Jéssica Lemos');
    expect(document.querySelectorAll('#faltosos-sem-professor + * li, [aria-labelledby="faltosos-sem-professor"] li')).toHaveLength(1);
    expect(document.body.textContent).toContain('Não achados');
    expect(document.body.textContent).toContain('JOAO PEDRO S. LIMA');
  });

  it('sem nenhum dos dois, as seções não aparecem', async () => {
    await montar({ valor: { professores: PROFESSORES, faltosos: COM_IMPORTACAO } });
    expect(document.querySelector('#faltosos-sem-professor')).toBeNull();
    expect(document.querySelector('#faltosos-nao-achados')).toBeNull();
  });
});
