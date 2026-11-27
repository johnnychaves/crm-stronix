// @vitest-environment jsdom
// A tela da Meta diária do professor (src/components/dailygoal/professor/).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

const { ProfessorMetaScreen } = await import('../../components/dailygoal/professor/ProfessorMetaScreen.jsx');
const { RegistrarContatoDialog } = await import('../../components/dailygoal/professor/RegistrarContatoDialog.jsx');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date('2026-11-27T14:40:00-03:00');
const est = (id, ultima, extra = {}) => ({
  id, leadId: id, status: 'faltando', professorId: 'p1', ultimaPresenca: ultima, inicioFalta: ultima, urgente: false,
  contratoTerminaEm: '2027-03-01',
  tarefa: { marco: 14, urgente: false, status: 'pendente', inicioFalta: ultima, criadaEm: '2026-11-23', importacaoId: 'f', feitaEm: null },
  ...extra,
});
const leads = new Map([
  ['a', { id: 'a', name: 'Marina Albuquerque', whatsapp: '51998124430' }],
  ['b', { id: 'b', name: 'Rodrigo Saldanha', whatsapp: '51993715568' }],
]);
const base = () => ({
  now: NOW, live: true, saudacao: 'Bom dia', nomeVisto: 'Heloísa', gestorVendo: false, professorLigado: true,
  ultimaImportacao: { dataFaltantes: '2026-11-23', importadoEm: new Date('2026-11-23T12:00:00Z') }, marcos: [7, 14, 30, 60],
  estados: [est('a', '2026-10-14', { urgente: true, contratoTerminaEm: '2026-12-10' }), est('b', '2026-10-21')],
  leadsById: leads, aulas: [], onRegistrar: vi.fn(), onJaVoltou: vi.fn(),
});

let root = null;
async function montar(p = {}) {
  const props = { ...base(), ...p };
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(h(MemoryRouter, null, h(ProfessorMetaScreen, props))); });
  return props;
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

const agoraEl = () => document.querySelector('section[aria-label="Agora"]');
const botao = (re) => [...document.querySelectorAll('button')].find((b) => (re instanceof RegExp ? re.test(b.textContent) : b.textContent.trim() === re));
const clicar = async (el) => { await act(async () => { el.click(); }); };

describe('Meta do professor', () => {
  it('o urgente abre no Agora, com a frase e o motivo', async () => {
    await montar();
    const agora = agoraEl();
    expect(agora.querySelector('h2').textContent).toBe('Marina Albuquerque');
    expect(agora.textContent).toContain('Não vem há 44 dias, desde 14/10.');
    expect(agora.textContent).toContain('O contrato termina em 10/12.');
    expect(agora.textContent).toContain('Urgente: o contrato termina em 10/12');
  });

  it('a linha da fila traz o aluno para o Agora, com o efeito e o foco', async () => {
    await montar();
    await clicar(botao(/Rodrigo Saldanha/));
    const agora = agoraEl();
    expect(agora.querySelector('h2').textContent).toBe('Rodrigo Saldanha');
    expect(agora.classList.contains('meta-entra')).toBe(true);
    expect(document.activeElement).toBe(agora);
    expect(botao(/Marina Albuquerque/).classList.contains('meta-voltou')).toBe(true);
  });

  it('Pular manda o Agora para o fim da fila', async () => {
    await montar();
    await clicar(botao('Pular por agora'));
    expect(agoraEl().querySelector('h2').textContent).toBe('Rodrigo Saldanha');
  });

  it('o Agora não muda quando a ordem muda depois (nomes que chegam)', async () => {
    const a = est('a', '2026-10-14');
    const b = est('b', '2026-10-14');
    // sem nomes, o empate cai na ordem de chegada (a); com nomes, "Bia" passaria na frente de "Zeca"
    const zeca = new Map([['a', { id: 'a', name: 'Zeca' }], ['b', { id: 'b', name: 'Bia' }]]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const props = { ...base(), estados: [a, b], leadsById: new Map() };
    await act(async () => { root.render(h(MemoryRouter, null, h(ProfessorMetaScreen, props))); });
    expect(agoraEl().querySelector('h2').textContent).toBe('Aluno');
    await act(async () => { root.render(h(MemoryRouter, null, h(ProfessorMetaScreen, { ...props, leadsById: zeca }))); });
    expect(agoraEl().querySelector('h2').textContent).toBe('Zeca');
  });

  it('sem ninguém na fila, não há Pular por agora', async () => {
    await montar({ estados: [est('a', '2026-10-14')] });
    expect(botao('Pular por agora')).toBeUndefined();
  });

  it('a linha da fila não repete o marco nem a situação', async () => {
    await montar();
    const linha = botao(/Rodrigo Saldanha/);
    expect(linha.textContent).toContain('Não vem há 37 dias');
    expect(linha.textContent).not.toMatch(/Marco|Contato dos|pendente/i);
  });

  it('Já voltou chama a gravação com o estado do Agora', async () => {
    const p = await montar();
    await clicar(botao('Já voltou'));
    expect(p.onJaVoltou).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('gestor vendo um professor vê o título e o aviso de autoria', async () => {
    await montar({ gestorVendo: true });
    expect(document.body.textContent).toContain('Você está vendo a Meta de Heloísa. O que você registrar aqui fica no seu nome.');
    expect(document.querySelector('h1').textContent).toBe('Meta diária de Heloísa');
  });

  it('a agenda só diz Sem desfecho para aula agendada que já passou', async () => {
    const aula = (id, status) => ({ id, leadId: 'a', leadName: id, modality: 'Funcional', status, scheduledFor: new Date('2026-11-27T07:00:00-03:00') });
    await montar({ aulas: [aula('Pendente', 'agendada'), aula('Outra', 'rescheduled')] });
    const itens = [...document.querySelectorAll('section[aria-label="Agenda de hoje"] li')];
    expect(itens.find((li) => li.textContent.includes('Pendente')).textContent).toContain('Sem desfecho');
    expect(itens.find((li) => li.textContent.includes('Outra')).textContent).not.toContain('Sem desfecho');
  });

  it('professor sem ligação vê só o aviso', async () => {
    await montar({ professorLigado: false, estados: [] });
    expect(document.body.textContent).toContain('Seu acesso ainda não está ligado a um professor. Fale com o gestor.');
    expect(agoraEl()).toBeNull();
  });

  it('a agenda é só leitura e diz quem marca', async () => {
    await montar({ aulas: [{ id: 'x', leadId: 'a', leadName: 'Ana Clara', modality: 'Funcional', status: 'attended', scheduledFor: new Date('2026-11-27T07:00:00-03:00') }] });
    const agenda = document.querySelector('section[aria-label="Agenda de hoje"]');
    expect(agenda.textContent).toContain('Compareceu');
    expect(agenda.textContent).toContain('Quem marca se o aluno veio é o consultor, na Meta dele.');
    expect(agenda.querySelector('button')).toBeNull();
  });
});

describe('RegistrarContatoDialog', () => {
  it('o balão grava canal, resultado e observação', async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(h(RegistrarContatoDialog, { lead: { id: 'a', name: 'Marina' }, contexto: 'Urgente: o contrato termina em 10/12', onConfirm, onClose: () => {} }));
    });
    const radio = (re) => [...document.querySelectorAll('[role="radio"]')].find((r) => re.test(r.textContent));
    await clicar(radio(/^Ligação/));
    await clicar(radio(/Quer cancelar/));
    await clicar(botao('Registrar contato'));
    expect(onConfirm).toHaveBeenCalledWith({ canal: 'ligacao', resultado: 'quer_cancelar', observacao: '' });
  });
});
