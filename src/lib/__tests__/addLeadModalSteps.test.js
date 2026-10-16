// @vitest-environment jsdom
// O Novo lead em gaveta libera um passo depois do outro (WhatsApp, nome, origem,
// dor, funil). Bugs de 16/10/2026: (1) voltar num passo pelo "Editar" e escolher
// uma opção não encerrava o "editando", então os chips continuavam abertos e o
// fluxo não seguia; (2) a lista do "Quem indicou?" abria atrás do resumo do passo
// de baixo. O modal é renderizado de verdade em jsdom (o Sheet vai para um
// portal) e clicado; o Firestore e os hooks de busca são dublês.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { ToastContext } from '../../contexts/ToastContext.jsx';
import { GeneralConfigContext } from '../../contexts/GeneralConfigContext.jsx';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';

// `duplicate` é o lead que o dublê da busca devolve (null = número livre), e
// `onSelect` guarda a função que o seletor de indicador receberia do modal.
const hoisted = vi.hoisted(() => ({ duplicate: null, onSelect: null }));
vi.mock('../firebase.js', () => ({ appId: 'teste', LEADS_PATH: 'leads' }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), addDoc: vi.fn(async () => ({ id: 'novo' })), serverTimestamp: vi.fn() }));
vi.mock('../../hooks/useDuplicateLead.js', () => ({
  useDuplicateLead: () => ({ duplicate: hoisted.duplicate, loading: false }),
  findDuplicateLeadRemote: async () => hoisted.duplicate,
}));
vi.mock('../../hooks/useGuardianMatches.js', () => ({ useGuardianMatches: () => ({ pending: false }) }));
vi.mock('../phoneNotice.js', () => ({ phoneNoticeLines: () => [] }));
vi.mock('../interactions.js', () => ({ logInteraction: vi.fn(async () => {}) }));
vi.mock('../referralsWrites.js', () => ({ commitReferralLink: vi.fn(async () => {}) }));
vi.mock('../../components/profile/ReferrerPicker.jsx', () => ({
  ReferrerPicker: ({ onSelect }) => { hoisted.onSelect = onSelect; return null; },
}));
const { addDoc } = await import('firebase/firestore');
const { AddLeadModal } = await import('../../modals/AddLeadModal.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Switch do Radix mede o tamanho com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const props = {
  appUser: { id: 'u1', name: 'Ana', authUid: 'auth-1' },
  sources: [
    { id: 's1', name: 'Instagram' }, { id: 's2', name: 'Passante' }, { id: 's3', name: 'Indicação' },
    { id: 's4', name: 'Indicação de empresa' },
  ],
  dores: [{ id: 'd1', name: 'Emagrecer' }, { id: 'd2', name: 'Reabilitação' }],
  statuses: [
    { id: 'st1', name: 'Novo', color: 'lime', order: 0, funnelId: 'f1' },
    { id: 'st2', name: 'Veio visitar', color: 'sky', order: 0, funnelId: 'f2' },
    { id: 'st3', name: 'Conversou', color: 'orange', order: 1, funnelId: 'f2' },
    { id: 'st4', name: 'Indicado', color: 'emerald', order: 0, funnelId: 'f3', systemKind: 'referral-entry' },
  ],
  funnels: [
    { id: 'f1', name: 'Digital', isDefault: true, order: 0 },
    { id: 'f2', name: 'Visitas presenciais', order: 3 },
    { id: 'f3', name: 'Indicações', order: 5, systemKind: 'referral' },
  ],
  selectedFunnelId: 'f1',
  tags: [],
  db: {},
};

let root = null;
// `modalidades` liga o passo "Modalidade de interesse": sem lista, a academia
// não tem modalidade cadastrada e o passo nem existe.
// `fontes` troca o catálogo de origens (lista vazia = academia sem origem), e
// `onClose` é o dublê de quem fecha a gaveta.
async function montar({ modalidades = null, fontes = null, onClose = () => {} } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // O "Abrir ficha" do número já cadastrado é um link de verdade (LeadLink), que
  // precisa do Router e do endereço da ficha.
  const perfil = { leadHref: (id) => `/t/ficha/${id}`, from: null, openProfile: () => {} };
  const modal = h(MemoryRouter, null,
    h(LeadProfileContext.Provider, { value: perfil },
      h(AddLeadModal, { ...props, ...(fontes ? { sources: fontes } : {}), onClose, onCreated: () => {} })));
  const comConfig = modalidades ? h(GeneralConfigContext.Provider, { value: { modalities: modalidades } }, modal) : modal;
  await act(async () => {
    root.render(h(ToastContext.Provider, { value: toast }, comConfig));
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
  hoisted.duplicate = null;
  hoisted.onSelect = null;
  vi.clearAllMocks();
});

const gaveta = () => document.querySelector('[data-slot="sheet-content"]');
const anuncio = () => gaveta().querySelector('p.sr-only[aria-live]').textContent;
const rodape = () => gaveta().querySelector('[role="status"]').textContent;
const botoes = () => [...gaveta().querySelectorAll('button')];
const botao = (rotulo) => botoes().find((b) => b.textContent.trim().startsWith(rotulo));
const opcao = (rotulo) => [...gaveta().querySelectorAll('[role="radio"]')].find((b) => b.textContent.trim() === rotulo);
// Campo controlado pelo React: o valor entra pelo setter nativo e pelo evento de input.
const digitar = async (input, valor) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, valor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const clicar = async (el) => { expect(el).toBeTruthy(); await act(async () => { el.click(); }); };
const editar = (titulo) => botoes().find((b) => b.textContent.includes(titulo) && b.textContent.includes('Editar'));
const fechar = () => gaveta().querySelector('button[aria-label="Fechar"]');
const telefones = () => [...gaveta().querySelectorAll('input[type="tel"]')];
const chaveMenor = () => gaveta().querySelector('[role="switch"]');
const teclar = async (el, init) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })); });
};

async function ateAOrigem() {
  await digitar(gaveta().querySelector('input[type="tel"]'), '51982144700');
  await clicar(botao('Continuar'));
  await digitar(gaveta().querySelector('input[type="text"]'), 'Rafael Moura');
  await clicar(botao('Continuar'));
}
// Origem, dor e a etapa do funil padrão: tudo feito.
async function tudoPreenchido() {
  await ateAOrigem();
  await clicar(opcao('Instagram'));
  await clicar(opcao('Emagrecer'));
  await clicar(opcao('Novo'));
}

describe('Novo lead em etapas', () => {
  it('cada passo libera o próximo e, no fim, o botão acende com o foco nele', async () => {
    await montar();
    expect(anuncio()).toBe('Passo 1 de 5: WhatsApp.');
    expect(botao('Cadastrar lead').disabled).toBe(true);
    expect(rodape()).toBe('Falta WhatsApp, nome, origem, dor e funil.');

    await ateAOrigem();
    expect(anuncio()).toBe('Passo 3 de 5: Como chegou.');
    await clicar(opcao('Instagram'));
    expect(anuncio()).toBe('Passo 4 de 5: Dor.');
    await clicar(opcao('Emagrecer'));
    expect(anuncio()).toBe('Passo 5 de 5: Onde entra.');
    expect(rodape()).toBe('Falta funil.');
    expect(botao('Cadastrar lead').disabled).toBe(true);
    await clicar(opcao('Novo'));

    expect(anuncio()).toBe('Todos os passos feitos.');
    expect(botao('Cadastrar lead').disabled).toBe(false);
    expect(document.activeElement).toBe(botao('Cadastrar lead'));
  });

  describe('modalidade de interesse', () => {
    const modalidades = [{ id: 'm1', name: 'Musculação' }, { id: 'm2', name: 'Pilates' }];
    const ateAModalidade = async () => {
      await ateAOrigem();
      await clicar(opcao('Instagram'));
      await clicar(opcao('Emagrecer'));
    };

    it('vem depois da dor e antes do funil, fecha no clique e vai para o lead', async () => {
      await montar({ modalidades });
      expect(anuncio()).toBe('Passo 1 de 6: WhatsApp.');
      await ateAModalidade();
      expect(anuncio()).toBe('Passo 5 de 6: Modalidade de interesse.');
      expect(rodape()).toBe('Falta modalidade e funil.');

      await clicar(opcao('Pilates'));
      expect(anuncio()).toBe('Passo 6 de 6: Onde entra.');
      expect(gaveta().textContent).toContain('Pilates');
      await clicar(opcao('Novo'));
      expect(anuncio()).toBe('Todos os passos feitos.');

      await clicar(botao('Cadastrar lead'));
      expect(addDoc.mock.calls[0][1]).toMatchObject({ modalidade: 'Pilates', funnelId: 'f1', status: 'Novo' });
    });

    it('"Pular" segue sem modalidade e o lead é gravado sem ela', async () => {
      await montar({ modalidades });
      await ateAModalidade();
      await clicar(botao('Pular'));
      expect(anuncio()).toBe('Passo 6 de 6: Onde entra.');
      expect(gaveta().textContent).toContain('Sem preferência');
      await clicar(opcao('Novo'));

      await clicar(botao('Cadastrar lead'));
      expect(addDoc.mock.calls[0][1].modalidade).toBeNull();
    });

    it('voltar pelo Editar troca a modalidade, e Pular limpa a que estava escolhida', async () => {
      await montar({ modalidades });
      await ateAModalidade();
      await clicar(opcao('Musculação'));
      await clicar(opcao('Novo'));

      await clicar(editar('Modalidade de interesse'));
      expect(anuncio()).toBe('Passo 5 de 6: Modalidade de interesse.');
      await clicar(opcao('Pilates'));
      expect(anuncio()).toBe('Todos os passos feitos.');
      expect(document.activeElement).toBe(botao('Cadastrar lead'));

      await clicar(editar('Modalidade de interesse'));
      await clicar(botao('Pular'));
      expect(anuncio()).toBe('Todos os passos feitos.');
      expect(gaveta().textContent).toContain('Sem preferência');
    });

    it('sem modalidade cadastrada o passo não existe', async () => {
      await montar();
      expect(anuncio()).toBe('Passo 1 de 5: WhatsApp.');
      await ateAOrigem();
      await clicar(opcao('Instagram'));
      await clicar(opcao('Emagrecer'));
      expect(anuncio()).toBe('Passo 5 de 5: Onde entra.');
      expect(gaveta().textContent).not.toContain('Modalidade de interesse');
    });
  });

  it('o funil padrão já vem marcado, e o passo só fecha no clique numa etapa', async () => {
    await montar();
    await ateAOrigem();
    await clicar(opcao('Instagram'));
    await clicar(opcao('Emagrecer'));

    // Funil e etapa à vista, com o padrão marcado. A indicação não é um funil de escolha.
    expect(opcao('Digital').getAttribute('aria-checked')).toBe('true');
    expect(opcao('Visitas presenciais').getAttribute('aria-checked')).toBe('false');
    expect(opcao('Indicações')).toBeUndefined();
    expect(opcao('Novo').getAttribute('aria-checked')).toBe('true');
    expect(anuncio()).toBe('Passo 5 de 5: Onde entra.');

    await clicar(opcao('Novo'));
    expect(anuncio()).toBe('Todos os passos feitos.');
    expect(gaveta().textContent).toContain('Digital › Novo');
  });

  it('trocar de funil leva a etapa para a primeira dele, e o lead é gravado no funil escolhido', async () => {
    await montar();
    await ateAOrigem();
    await clicar(opcao('Instagram'));
    await clicar(opcao('Emagrecer'));

    await clicar(opcao('Visitas presenciais'));
    expect(opcao('Novo')).toBeUndefined();
    expect(opcao('Veio visitar').getAttribute('aria-checked')).toBe('true');
    expect(anuncio()).toBe('Passo 5 de 5: Onde entra.');
    await clicar(opcao('Conversou'));
    expect(gaveta().textContent).toContain('Visitas presenciais › Conversou');

    await clicar(botao('Cadastrar lead'));
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(addDoc.mock.calls[0][1]).toMatchObject({
      name: 'Rafael Moura', source: 'Instagram', dor: 'Emagrecer', funnelId: 'f2', status: 'Conversou',
    });
  });

  it('na origem Indicação o destino é o funil Indicações, fixo e já feito', async () => {
    await montar();
    await ateAOrigem();
    await clicar(opcao('Indicação'));

    expect(gaveta().textContent).toContain('Indicações › Indicado');
    expect(gaveta().textContent).toContain('Fixo na indicação');
    expect(opcao('Digital')).toBeUndefined();
    // Sem o indicador a origem continua aberta: o que falta é quem indicou.
    expect(rodape()).toBe('Falta quem indicou e dor.');

    // Voltar para uma origem comum devolve o funil padrão para escolher de novo.
    await clicar(opcao('Passante'));
    await clicar(opcao('Emagrecer'));
    expect(anuncio()).toBe('Passo 5 de 5: Onde entra.');
    expect(opcao('Digital').getAttribute('aria-checked')).toBe('true');
  });

  it('voltar em "Como chegou" com a dor aberta e escolher outra origem segue sozinho para a dor', async () => {
    await montar();
    await ateAOrigem();
    await clicar(opcao('Instagram'));
    expect(anuncio()).toBe('Passo 4 de 5: Dor.');

    await clicar(editar('Como chegou'));
    expect(anuncio()).toBe('Passo 3 de 5: Como chegou.');
    await clicar(opcao('Passante'));

    expect(anuncio()).toBe('Passo 4 de 5: Dor.');
    expect(opcao('Instagram')).toBeUndefined();
    expect(opcao('Emagrecer')).toBeTruthy();
    expect(gaveta().textContent).toContain('Passante');
    expect(rodape()).toBe('Falta dor e funil.');
  });

  it('voltar num passo de escolha com tudo preenchido fecha no clique e leva o foco ao botão', async () => {
    await montar();
    await tudoPreenchido();

    await clicar(editar('Como chegou'));
    await clicar(opcao('Passante'));
    expect(anuncio()).toBe('Todos os passos feitos.');
    expect(opcao('Instagram')).toBeUndefined();
    expect(document.activeElement).toBe(botao('Cadastrar lead'));

    await clicar(editar('Dor'));
    expect(anuncio()).toBe('Passo 4 de 5: Dor.');
    await clicar(opcao('Reabilitação'));
    expect(anuncio()).toBe('Todos os passos feitos.');
    expect(document.activeElement).toBe(botao('Cadastrar lead'));

    await clicar(editar('Onde entra'));
    expect(anuncio()).toBe('Passo 5 de 5: Onde entra.');
    await clicar(opcao('Novo'));
    expect(anuncio()).toBe('Todos os passos feitos.');
    expect(document.activeElement).toBe(botao('Cadastrar lead'));
  });

  // Bug de 16/10/2026: voltar em "Como chegou" com a dor já escolhida e abrir a
  // busca do "Quem indicou?" deixava a lista atrás do resumo da dor. O passo
  // aberto tem animação com transform, que lhe dá uma camada própria, e o resumo
  // de baixo pintava por cima. O jsdom não tem layout para medir isso, então o
  // teste cobra a causa: só o passo aberto leva a camada acima (z-10).
  it('o passo aberto fica numa camada acima dos resumos de baixo', async () => {
    await montar();
    await tudoPreenchido();
    await clicar(editar('Como chegou'));

    const linha = (el) => el.closest('.relative.flex');
    const abertos = [...gaveta().querySelectorAll('.step-reveal')];
    expect(abertos).toHaveLength(1);
    expect(linha(abertos[0]).classList.contains('z-10')).toBe(true);
    const resumos = [...gaveta().querySelectorAll('.sum-in')];
    expect(resumos.length).toBeGreaterThan(0);
    for (const resumo of resumos) expect(linha(resumo).classList.contains('z-10')).toBe(false);
  });

  it('número já cadastrado: mostra quem é, leva à ficha por um link e trava o Continuar', async () => {
    hoisted.duplicate = { id: 'lead-9', name: 'Mariana Costa', status: 'Em conversa', consultantName: 'Ana' };
    await montar();
    await digitar(telefones()[0], '51999990000');

    expect(gaveta().textContent).toContain('Mariana Costa');
    expect(gaveta().textContent).toContain('Em conversa · responsável Ana');
    expect(gaveta().querySelector('a[href="/t/ficha/lead-9"]')?.textContent).toContain('Abrir ficha');
    expect(botao('Continuar').disabled).toBe(true);
    expect(rodape()).toBe('Esse número já tem cadastro.');
    expect(anuncio()).toBe('Passo 1 de 5: WhatsApp.');
  });

  it('menor de idade ganha o passo do responsável, e o lead sai com ele e sem WhatsApp próprio', async () => {
    await montar();
    await clicar(chaveMenor());
    expect(anuncio()).toBe('Passo 1 de 6: WhatsApp do responsável.');
    await digitar(telefones()[0], '51997123380');
    await clicar(botao('Continuar'));
    await digitar(gaveta().querySelector('input[type="text"]'), 'Pedro Alves');
    await clicar(botao('Continuar'));

    expect(anuncio()).toBe('Passo 3 de 6: Responsável.');
    await digitar(gaveta().querySelector('input[type="text"]'), 'Luciana Alves');
    await clicar(opcao('Mãe'));
    await clicar(botao('Continuar'));
    await clicar(opcao('Instagram'));
    await clicar(opcao('Emagrecer'));
    await clicar(opcao('Novo'));
    await clicar(botao('Cadastrar lead'));

    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(addDoc.mock.calls[0][1]).toMatchObject({
      name: 'Pedro Alves', isMinor: true, whatsapp: '',
      guardian: { name: 'Luciana Alves', phone: '(51) 9 9712-3380', relationship: 'Mãe' },
    });

    // O comprovante mostra o número do responsável, o aviso e quem responde pelo aluno.
    const texto = gaveta().textContent;
    expect(texto).toContain('(51) 9 9712-3380');
    expect(texto).toContain('Menor de idade');
    expect(texto).toContain('Luciana Alves (Mãe)');
  });

  it('a chave Menor de idade troca os números de lugar sem perder nenhum', async () => {
    await montar();
    await digitar(telefones()[0], '51982144700');
    await clicar(chaveMenor());
    expect(telefones()[0].value).toBe('(51) 9 8214-4700');

    // O WhatsApp do aluno mora em "Mais detalhes", e a pessoa o preenche.
    await clicar(botao('Mais detalhes'));
    expect(telefones()).toHaveLength(2);
    await digitar(telefones()[1], '51988887777');

    // O número do passo 1 continua o mesmo nos dois sentidos, e o outro volta ao seu lugar.
    await clicar(chaveMenor());
    expect(telefones()).toHaveLength(1);
    expect(telefones()[0].value).toBe('(51) 9 8214-4700');
    await clicar(chaveMenor());
    expect(telefones()[0].value).toBe('(51) 9 8214-4700');
    expect(telefones()[1].value).toBe('(51) 9 8888-7777');
  });

  it('Enter continua o passo de texto e Ctrl+Enter cadastra de qualquer campo', async () => {
    await montar();
    await digitar(telefones()[0], '51982144700');
    await teclar(telefones()[0], { key: 'Enter' });
    expect(anuncio()).toBe('Passo 2 de 5: Nome.');

    const nome = gaveta().querySelector('input[type="text"]');
    await digitar(nome, 'Rafael Moura');
    await teclar(nome, { key: 'Enter' });
    expect(anuncio()).toBe('Passo 3 de 5: Como chegou.');

    await clicar(opcao('Instagram'));
    await clicar(opcao('Emagrecer'));
    await clicar(opcao('Novo'));
    expect(addDoc).not.toHaveBeenCalled();
    await teclar(botao('Cadastrar lead'), { key: 'Enter', ctrlKey: true });
    expect(addDoc).toHaveBeenCalledTimes(1);
  });

  it('voltar em "Como chegou" com o indicador já escolhido e reclicar em Indicação fecha o passo', async () => {
    await montar();
    await ateAOrigem();
    await clicar(opcao('Indicação'));
    await act(async () => { hoisted.onSelect({ id: 'c1', name: 'Carla Menezes' }); });
    expect(anuncio()).toBe('Passo 4 de 5: Dor.');
    await clicar(opcao('Emagrecer'));
    expect(anuncio()).toBe('Todos os passos feitos.');

    await clicar(editar('Como chegou'));
    expect(anuncio()).toBe('Passo 3 de 5: Como chegou.');
    await clicar(opcao('Indicação'));

    expect(anuncio()).toBe('Todos os passos feitos.');
    expect(gaveta().textContent).toContain('Indicação · Carla Menezes');
    expect(document.activeElement).toBe(botao('Cadastrar lead'));
  });

  describe('origem', () => {
    it('academia sem origem cadastrada consegue cadastrar sem origem', async () => {
      await montar({ fontes: [] });
      await ateAOrigem();
      expect(anuncio()).toBe('Passo 3 de 5: Como chegou.');
      expect(gaveta().textContent).toContain('Nenhuma origem cadastrada');
      expect(rodape()).toBe('Falta origem, dor e funil.');

      await clicar(botao('Continuar sem origem'));
      expect(anuncio()).toBe('Passo 4 de 5: Dor.');
      expect(gaveta().textContent).toContain('Sem origem');
      await clicar(opcao('Emagrecer'));
      await clicar(opcao('Novo'));
      await clicar(botao('Cadastrar lead'));
      expect(addDoc.mock.calls[0][1]).toMatchObject({ source: '', dor: 'Emagrecer' });
    });

    it('só a origem Indicação liga o modo indicação: outra com "indica" no nome é comum', async () => {
      await montar();
      await ateAOrigem();
      await clicar(opcao('Indicação de empresa'));
      expect(anuncio()).toBe('Passo 4 de 5: Dor.');
      expect(gaveta().textContent).not.toContain('Fixo na indicação');
      await clicar(opcao('Emagrecer'));
      expect(opcao('Digital')).toBeTruthy();
      expect(gaveta().textContent).toContain('Indicação de empresa');
    });

    it('sem a origem de nome exato, a primeira que casa com "indica" liga o modo, como na migração do funil', async () => {
      await montar({ fontes: [{ id: 's9', name: 'Indicação de aluno' }, { id: 's10', name: 'Instagram' }] });
      await ateAOrigem();
      await clicar(opcao('Indicação de aluno'));
      expect(gaveta().textContent).toContain('Indicações › Indicado');
      expect(gaveta().textContent).toContain('Fixo na indicação');
    });
  });

  describe('depois de cadastrar', () => {
    it('mostra o comprovante do que foi gravado e "Cadastrar outro" começa um cadastro limpo', async () => {
      await montar({ modalidades: [{ id: 'm1', name: 'Pilates' }] });
      await ateAOrigem();
      await clicar(opcao('Instagram'));
      await clicar(opcao('Emagrecer'));
      await clicar(opcao('Pilates'));
      await clicar(opcao('Novo'));
      await clicar(botao('Cadastrar lead'));

      const texto = gaveta().textContent;
      expect(texto).toContain('Lead cadastrado');
      expect(texto).toContain('Rafael Moura');
      expect(texto).toContain('(51) 9 8214-4700');
      // Uma linha para cada coisa gravada, com o destino à vista.
      for (const linha of ['Digital', 'Novo', 'Instagram', 'Emagrecer', 'Pilates', 'Consultor', 'Você']) {
        expect(texto).toContain(linha);
      }
      expect(texto).not.toContain('Menor de idade');
      expect(gaveta().querySelector('form')).toBeNull();

      await clicar(botao('Cadastrar outro'));
      expect(anuncio()).toBe('Passo 1 de 6: WhatsApp.');
      expect(telefones()[0].value).toBe('');
    });

    it('o X da tela de sucesso fecha sem perguntar', async () => {
      const onClose = vi.fn();
      await montar({ onClose });
      await tudoPreenchido();
      await clicar(botao('Cadastrar lead'));

      await clicar(fechar());
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(gaveta().textContent).not.toContain('Descartar este cadastro?');
    });
  });

  describe('fechar a gaveta', () => {
    const AVISO = 'Descartar este cadastro?';

    it('sem nada preenchido fecha direto', async () => {
      const onClose = vi.fn();
      await montar({ onClose });
      await clicar(fechar());
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(gaveta().textContent).not.toContain(AVISO);
    });

    it('com algo preenchido o X e o Esc pedem confirmação antes de descartar', async () => {
      const onClose = vi.fn();
      await montar({ onClose });
      await digitar(telefones()[0], '51982144700');

      await clicar(fechar());
      expect(onClose).not.toHaveBeenCalled();
      expect(gaveta().textContent).toContain(AVISO);

      await clicar(botao('Continuar cadastrando'));
      expect(gaveta().textContent).not.toContain(AVISO);
      expect(telefones()[0].value).toBe('(51) 9 8214-4700');

      // O Esc faz o mesmo que o X, e outro Esc com o aviso aberto o dispensa.
      await teclar(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
      expect(gaveta().textContent).toContain(AVISO);
      await teclar(document, { key: 'Escape' });
      expect(gaveta().textContent).not.toContain(AVISO);

      await clicar(fechar());
      await clicar(botao('Descartar'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('depois de salvo o Esc fecha sem perguntar', async () => {
      const onClose = vi.fn();
      await montar({ onClose });
      await tudoPreenchido();
      await clicar(botao('Cadastrar lead'));
      expect(gaveta().textContent).toContain('Lead cadastrado');

      await teclar(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(gaveta().textContent).not.toContain(AVISO);
    });
  });

  it('voltar no nome, trocar e continuar também fecha o passo', async () => {
    await montar();
    await tudoPreenchido();

    await clicar(editar('Nome'));
    expect(anuncio()).toBe('Passo 2 de 5: Nome.');
    await digitar(gaveta().querySelector('input[type="text"]'), 'Rafael M. Moura');
    await clicar(botao('Continuar'));
    expect(anuncio()).toBe('Todos os passos feitos.');
    expect(gaveta().textContent).toContain('Rafael M. Moura');
  });
});
