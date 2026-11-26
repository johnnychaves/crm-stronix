// A ficha da equipe (spec docs/superpowers/specs/2026-11-26-cadastro-da-equipe-design.md):
// vínculos, movimentações, o anel do que falta e o patch de cada bloco da tela.
// Puro, e só importa ../brazilLookups.js (que não importa nada), porque a api/
// (desligar, cadastro) também lê. O equipeImports.test.js trava isso.
import { isValidCpf } from '../brazilLookups.js';

export const FUNCOES = Object.freeze(['consultor', 'gestor', 'professor']);
export const FUNCAO_TEXTO = Object.freeze({ consultor: 'Consultor', gestor: 'Gestor', professor: 'Professor' });

// A lista do Gestão 360, mais Sócio, que a planilha FINANCEIRO_STRONIX já usa.
export const VINCULOS = Object.freeze([
  { id: 'clt', label: 'CLT' },
  { id: 'estagio', label: 'Estágio' },
  { id: 'pj', label: 'PJ' },
  { id: 'socio', label: 'Sócio' },
  { id: 'temporario', label: 'Temporário' },
  { id: 'outro', label: 'Outro' },
]);
const VINCULO_IDS = new Set(VINCULOS.map((v) => v.id));
export const isVinculo = (v) => VINCULO_IDS.has(v);
export const vinculoTexto = (v) => VINCULOS.find((x) => x.id === v)?.label ?? 'Sem vínculo';
// Na lista e no cabeçalho, o vínculo Estágio diz quem é a pessoa.
export const vinculoSelo = (v) => (v === 'estagio' ? 'Estagiário' : vinculoTexto(v));

// A lista do Gestão 360, sem aposentadoria.
export const TIPOS_DESLIGAMENTO = Object.freeze([
  { id: 'pedido_demissao', label: 'Pedido de demissão' },
  { id: 'sem_justa_causa', label: 'Sem justa causa' },
  { id: 'justa_causa', label: 'Justa causa' },
  { id: 'acordo', label: 'Acordo' },
  { id: 'fim_contrato', label: 'Fim de contrato' },
  { id: 'outro', label: 'Outro' },
]);
const TIPO_IDS = new Set(TIPOS_DESLIGAMENTO.map((t) => t.id));
export const isTipoDesligamento = (v) => TIPO_IDS.has(v);
export const tipoDesligamentoTexto = (v) => TIPOS_DESLIGAMENTO.find((t) => t.id === v)?.label ?? 'Desligamento';

export const MOV = Object.freeze({ ADMISSAO: 'admissao', DESLIGAMENTO: 'desligamento', READMISSAO: 'readmissao' });
const ENTRADAS = new Set([MOV.ADMISSAO, MOV.READMISSAO]);

const DIA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export function isDia(v) {
  if (typeof v !== 'string' || !DIA_RE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const pad = (n) => String(n).padStart(2, '0');
// O dia de hoje no fuso do aparelho, em AAAA-MM-DD.
export const hojeIso = (agora = new Date()) => `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
export const dataBR = (iso) => (isDia(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

// "2 anos e 8 meses", "1 ano", "15 dias", "desde hoje". Vazio sem data.
export function tempoDeCasa(iso, agora = new Date()) {
  if (!isDia(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  let meses = (agora.getFullYear() - y) * 12 + (agora.getMonth() + 1 - m);
  if (agora.getDate() < d) meses -= 1;
  if (meses < 0) return '';
  if (meses < 1) {
    const dias = Math.round((new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()) - new Date(y, m - 1, d)) / 864e5);
    if (dias < 0) return '';
    if (dias === 0) return 'desde hoje';
    return `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  }
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes = [];
  if (anos) partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`);
  if (resto) partes.push(`${resto} ${resto === 1 ? 'mês' : 'meses'}`);
  return partes.join(' e ');
}

// Uma movimentação pronta para entrar na lista. registradoEm é texto ISO do
// relógio de quem grava, porque o Firestore não aceita serverTimestamp dentro
// de lista.
export function novaMovimentacao({ tipo, data, vinculo = null, tipoDesligamento = null, motivo = '', autor = null, agora = new Date() }) {
  const sai = tipo === MOV.DESLIGAMENTO;
  return {
    tipo,
    data,
    vinculo: !sai && isVinculo(vinculo) ? vinculo : null,
    tipoDesligamento: sai && isTipoDesligamento(tipoDesligamento) ? tipoDesligamento : null,
    motivo: sai ? String(motivo || '').trim().slice(0, 500) : '',
    registradoPor: { id: autor?.id ?? null, nome: autor?.nome ?? null },
    registradoEm: agora.toISOString(),
  };
}

const listaDe = (movs) => (Array.isArray(movs) ? movs : []);
export function indiceDaAdmissao(movs) {
  const lista = listaDe(movs);
  for (let i = lista.length - 1; i >= 0; i -= 1) if (ENTRADAS.has(lista[i]?.tipo)) return i;
  return -1;
}
export function admissaoDe(ficha) {
  const lista = listaDe(ficha?.movimentacoes);
  const i = indiceDaAdmissao(lista);
  return i >= 0 ? lista[i].data : null;
}

// A lista com a data da admissão de agora corrigida, ou com a primeira
// admissão quando não há nenhuma. Nunca apaga entrada.
export function comAdmissao(movs, data, { vinculo = null, autor = null, agora = new Date() } = {}) {
  const lista = listaDe(movs).slice();
  const i = indiceDaAdmissao(lista);
  if (i >= 0) {
    lista[i] = { ...lista[i], data };
    return lista;
  }
  return [novaMovimentacao({ tipo: MOV.ADMISSAO, data, vinculo, autor, agora }), ...lista];
}

// "Na equipe desde 12/03/2024, há 2 anos e 8 meses" ou "Na equipe desde hoje".
export function naEquipeTexto(iso, agora = new Date()) {
  const tempo = tempoDeCasa(iso, agora);
  if (!tempo) return '';
  return tempo === 'desde hoje' ? 'Na equipe desde hoje' : `Na equipe desde ${dataBR(iso)}, há ${tempo}`;
}

function ultimoDesligamento(ficha) {
  const lista = listaDe(ficha?.movimentacoes);
  for (let i = lista.length - 1; i >= 0; i -= 1) if (lista[i]?.tipo === MOV.DESLIGAMENTO) return lista[i];
  return null;
}
// { de, ate } da última passagem pela equipe: a última admissão e o último
// desligamento. Null sem desligamento.
export function periodoNaEquipe(ficha) {
  const saiu = ultimoDesligamento(ficha);
  return saiu ? { de: admissaoDe(ficha), ate: saiu.data } : null;
}
export function desligadoEmTexto(ficha) {
  const saiu = ultimoDesligamento(ficha);
  return saiu && dataBR(saiu.data) ? `Desligado em ${dataBR(saiu.data)}` : 'Desligado';
}

const tem = (v) => (typeof v === 'string' ? v.trim() !== '' : !!v);
const formadoProfessor = (pessoa) => pessoa?.funcao === 'professor' && pessoa?.ficha?.vinculo !== 'estagio';
// A foto do professor mora no cadastro do professor; a dos outros, na ficha.
export const fotoDe = (pessoa) => (pessoa?.professor ? pessoa.professor.photoUrl || null : pessoa?.ficha?.foto?.url || null);

// O anel e a linha "Falta:". Cada item diz o bloco onde é preenchido, e o id
// é o `name` do campo no formulário, para o atalho levar o cursor até ele.
export function faltasDaFicha(pessoa) {
  const f = pessoa?.ficha || {};
  const end = f.endereco || {};
  const itens = [
    ['foto', 'Foto', 'identidade', !!fotoDe(pessoa)],
    ['cpf', 'CPF', 'identidade', tem(f.cpf)],
    ['rg', 'RG', 'identidade', tem(f.rg)],
    ['nascimento', 'Nascimento', 'identidade', isDia(f.nascimento)],
    ['celular', 'Celular', 'contato', tem(f.celular)],
    ['emailPessoal', 'E-mail pessoal', 'contato', tem(f.emailPessoal)],
    ['endereco', 'Endereço', 'contato', tem(end.street) && tem(end.number) && tem(end.city)],
    ['vinculo', 'Vínculo', 'trabalho', isVinculo(f.vinculo)],
    ['admissao', 'Admissão', 'trabalho', !!admissaoDe(f)],
  ];
  if (formadoProfessor(pessoa)) itens.push(['cref', 'CREF', 'trabalho', tem(f.cref)]);
  return {
    total: itens.length,
    faltam: itens.filter((i) => !i[3]).map(([id, label, bloco]) => ({ id, label, bloco })),
  };
}

const ENDERECO = Object.freeze(['cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state']);

// O formulário de um bloco, lido da ficha (ou do login e do professor, para
// quem ainda não tem ficha).
export function formDoBloco(bloco, pessoa) {
  const f = pessoa?.ficha || {};
  if (bloco === 'identidade') {
    return { nome: f.nome || pessoa?.nome || '', cpf: f.cpf || '', rg: f.rg || '', nascimento: f.nascimento || '' };
  }
  if (bloco === 'contato') {
    const end = f.endereco || {};
    return {
      celular: f.celular || '', emailPessoal: f.emailPessoal || '',
      ...Object.fromEntries(ENDERECO.map((k) => [k, end[k] || ''])),
    };
  }
  return {
    vinculo: f.vinculo || '', admissao: admissaoDe(f) || '', cref: f.cref || '',
    modalidadeIds: pessoa?.professor?.modalidadeIds ? [...pessoa.professor.modalidadeIds] : [],
  };
}

const so = (v) => String(v ?? '').trim();
const digitos = (v) => String(v ?? '').replace(/\D/g, '');
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const recusa = (erro, campo) => ({ erro, campo });

// O que um bloco grava: { ficha, professor? } ou { erro, campo }. Cada bloco
// grava só as chaves dele, para uma aba não apagar o que a outra salvou.
// ctx: { pessoa, autor, agora, professores }.
export function patchDoBloco(bloco, form, ctx = {}) {
  const { pessoa = null, autor = null, agora = new Date(), professores = [] } = ctx;
  const hoje = hojeIso(agora);

  if (bloco === 'identidade') {
    const nome = so(form.nome).replace(/\s+/g, ' ');
    if (!nome) return recusa('Escreva o nome completo.', 'nome');
    if (nome.length > 120) return recusa('O nome passa de 120 letras.', 'nome');
    if (pessoa?.professor) {
      const igual = (professores || []).find((p) => p?.id !== pessoa.professor.id && so(p?.nome).toLowerCase() === nome.toLowerCase());
      if (igual) return recusa(`Já existe um professor com o nome "${nome}".`, 'nome');
    }
    const cpf = digitos(form.cpf);
    if (cpf && !isValidCpf(cpf)) return recusa('CPF inválido.', 'cpf');
    const nascimento = so(form.nascimento);
    if (nascimento && (!isDia(nascimento) || nascimento > hoje || nascimento < '1900-01-01')) {
      return recusa('Data de nascimento inválida.', 'nascimento');
    }
    return { ficha: { nome, cpf, rg: so(form.rg).slice(0, 30), nascimento } };
  }

  if (bloco === 'contato') {
    const celular = digitos(form.celular);
    if (celular && (celular.length < 10 || celular.length > 11)) return recusa('Celular com DDD, 10 ou 11 números.', 'celular');
    const emailPessoal = so(form.emailPessoal).toLowerCase();
    if (emailPessoal && !EMAIL_RE.test(emailPessoal)) return recusa('E-mail inválido.', 'emailPessoal');
    const endereco = Object.fromEntries(ENDERECO.map((k) => [k, so(form[k])]));
    const vazio = ENDERECO.every((k) => !endereco[k]);
    return { ficha: { celular, emailPessoal, endereco: vazio ? null : endereco } };
  }

  if (bloco === 'trabalho') {
    const vinculo = so(form.vinculo);
    if (vinculo && !isVinculo(vinculo)) return recusa('Escolha o vínculo.', 'vinculo');
    const admissao = so(form.admissao);
    if (admissao && (!isDia(admissao) || admissao > hoje)) return recusa('A admissão precisa ser hoje ou antes.', 'admissao');
    // Só regrava a lista quando a data mudou, para não gravar uma cópia velha por cima.
    const antes = admissaoDe(pessoa?.ficha);
    const mexeAdmissao = admissao && admissao !== antes;
    const professor = pessoa?.funcao === 'professor';
    const cref = professor && vinculo !== 'estagio' ? so(form.cref).slice(0, 20) || null : null;
    const ficha = { vinculo: vinculo || null, cref };
    if (mexeAdmissao) ficha.movimentacoes = comAdmissao(pessoa?.ficha?.movimentacoes, admissao, { vinculo: vinculo || null, autor, agora });
    return {
      ficha,
      professor: pessoa?.professor && Array.isArray(form.modalidadeIds) ? { modalidadeIds: [...form.modalidadeIds] } : null,
    };
  }

  return recusa('Bloco desconhecido.', null);
}
