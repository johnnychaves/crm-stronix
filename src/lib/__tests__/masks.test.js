import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatCPF, formatPhone, phoneDigits } from '../masks.js';
import { buildGuardianSearchFields, buildLeadSearchFields } from '../leadDerived.js';
import { telHref, whatsappHref } from '../guardian.js';
import { zapMatchKey } from '../../../api/_zapPhone.js';

describe('formatCPF', () => {
  it('mascara progressivamente e limita a 11 dígitos', () => {
    expect(formatCPF('034')).toBe('034');
    expect(formatCPF('03456')).toBe('034.56');
    expect(formatCPF('0345678')).toBe('034.567.8');
    expect(formatCPF('03456789012')).toBe('034.567.890-12');
    expect(formatCPF('034567890129999')).toBe('034.567.890-12');
    expect(formatCPF('')).toBe('');
  });
});

describe('formatPhone', () => {
  it('celular com DDD, 11 dígitos: (DD) N NNNN-NNNN', () => {
    expect(formatPhone('51981244710')).toBe('(51) 9 8124-4710');
    expect(formatPhone('51995304633')).toBe('(51) 9 9530-4633');
    expect(formatPhone('')).toBe('');
  });

  it('fixo com DDD, 10 dígitos: (DD) NNNN-NNNN', () => {
    expect(formatPhone('5133334444')).toBe('(51) 3333-4444');
    expect(formatPhone('5133224455')).toBe('(51) 3322-4455');
    // Com 10 dígitos, "55" na frente é o DDD de Santa Maria (regra de phoneDigits).
    expect(formatPhone('5532221111')).toBe('(55) 3222-1111');
    // Celular antigo, sem o nono dígito: a máscara não inventa o 9.
    expect(formatPhone('5181244710')).toBe('(51) 8124-4710');
  });

  it('tira o 55 de DDI colado (13 dígitos, ou 12 com "+"), sem mexer no DDD 55', () => {
    expect(formatPhone('+55 51 99530-4633')).toBe('(51) 9 9530-4633');
    expect(formatPhone('5551995304633')).toBe('(51) 9 9530-4633');
    expect(formatPhone('51995304633')).toBe('(51) 9 9530-4633');
  });

  it('DDD 55 digitado até um dígito a mais não perde o próprio DDD', () => {
    // 12 dígitos, sem "+": uma tecla a mais no número de Santa Maria, não um
    // DDI colado. O dígito extra é só ignorado, igual a qualquer DDD.
    expect(formatPhone('(55) 9 9999-88889')).toBe('(55) 9 9999-8888');
  });

  it('DDI colado num fixo (12 dígitos com "+")', () => {
    expect(formatPhone('+55 51 3322-4455')).toBe('(51) 3322-4455');
  });

  it('fixo gravado com a máscara antiga volta certo quando é formatado de novo', () => {
    // Até 29/09/2026 o fixo saía no desenho do celular, com o último dígito
    // depois do traço faltando: "(51) 3 3334-444". Os dígitos estavam certos.
    expect(formatPhone('(51) 3 3334-444')).toBe('(51) 3333-4444');
    expect(formatPhone('(51) 3 3224-455')).toBe('(51) 3322-4455');
  });

  it('formatar o que já está formatado não muda nada', () => {
    // O campo devolve o próprio valor para a máscara a cada tecla.
    for (const v of ['5', '51', '519812', '5198124', '5133334444', '51981244710', '+55 51 3322-4455', '5551995304633', '(55) 9 9999-88889', '5532221111']) {
      const uma = formatPhone(v);
      expect(formatPhone(uma)).toBe(uma);
    }
  });
});

// Digita no campo como a pessoa digita: a cada tecla o campo recebe o texto
// que já estava nele mais o dígito novo, e guarda a máscara disso. Devolve o
// que aparece no campo depois de cada tecla.
const digitar = (numero) => {
  const telas = [];
  let campo = '';
  for (const tecla of numero) {
    campo = formatPhone(campo + tecla);
    telas.push(campo);
  }
  return telas;
};
const soDigitos = (v) => v.replace(/\D/g, '');

describe('formatPhone enquanto a pessoa digita', () => {
  it('celular: fica no desenho do fixo até o 10º dígito e vira celular no 11º', () => {
    expect(digitar('51981244710')).toEqual([
      '(5', '(51', '(51) 9', '(51) 98', '(51) 981', '(51) 9812',
      '(51) 9812-4', '(51) 9812-44', '(51) 9812-447', '(51) 9812-4471',
      '(51) 9 8124-4710',
    ]);
  });

  it('fixo: chega ao 10º dígito sem trocar de desenho no caminho', () => {
    expect(digitar('5133334444')).toEqual([
      '(5', '(51', '(51) 3', '(51) 33', '(51) 333', '(51) 3333',
      '(51) 3333-4', '(51) 3333-44', '(51) 3333-444', '(51) 3333-4444',
    ]);
  });

  it('nenhuma tecla perde dígito, e até o 10º cada tecla só acrescenta no fim', () => {
    const numero = '51981244710';
    const telas = digitar(numero);
    telas.forEach((tela, i) => expect(soDigitos(tela)).toBe(numero.slice(0, i + 1)));
    for (let i = 1; i < 10; i += 1) expect(telas[i].startsWith(telas[i - 1])).toBe(true);
  });

  it('o 12º dígito é ignorado, como antes', () => {
    expect(formatPhone('(51) 9 8124-47109')).toBe('(51) 9 8124-4710');
  });

  it('apagar do fim volta pelo mesmo caminho, sem travar no traço', () => {
    let campo = '(51) 9 8124-4710';
    const telas = [];
    while (campo) {
      campo = formatPhone(campo.slice(0, -1));
      telas.push(campo);
    }
    expect(telas).toEqual([
      '(51) 9812-4471', '(51) 9812-447', '(51) 9812-44', '(51) 9812-4', '(51) 9812',
      '(51) 981', '(51) 98', '(51) 9', '(51', '(5', '',
    ]);
  });
});

// Helper único de dígitos, usado por formatPhone. Mesmos casos de formatPhone
// acima, na versão crua (sem parênteses/traço).
describe('phoneDigits', () => {
  it('mantém plano com 11 e 10 dígitos como estão', () => {
    expect(phoneDigits('51995304633')).toBe('51995304633');
    expect(phoneDigits('5133224455')).toBe('5133224455');
  });

  it('tira o 55 de DDI colado (13 dígitos, ou 12 com "+"), sem mexer no DDD 55', () => {
    expect(phoneDigits('+55 51 99530-4633')).toBe('51995304633');
    expect(phoneDigits('5551995304633')).toBe('51995304633');
    expect(phoneDigits('+55 51 3322-4455')).toBe('5133224455');
  });

  it('DDD 55 digitado até um dígito a mais não perde o próprio DDD', () => {
    expect(phoneDigits('(55) 9 9999-88889')).toBe('55999998888');
  });
});

// O lead guarda o texto do campo. O casamento com o Stronizap, o aviso de
// duplicado, a busca e os botões Ligar e WhatsApp usam só os dígitos. A
// correção muda o texto do fixo e nenhum dígito.
describe('fixo com a máscara antiga e com a nova tem os mesmos dígitos', () => {
  const ANTIGO = '(51) 3 3334-444';
  const NOVO = '(51) 3333-4444';

  it('phoneDigits e zapMatchKey', () => {
    expect(phoneDigits(ANTIGO)).toBe('5133334444');
    expect(phoneDigits(NOVO)).toBe('5133334444');
    expect(zapMatchKey(ANTIGO)).toBe('5133334444');
    expect(zapMatchKey(NOVO)).toBe('5133334444');
  });

  it('campos de busca do lead e do responsável', () => {
    expect(buildLeadSearchFields({ name: 'Ana', whatsapp: NOVO })).toEqual(buildLeadSearchFields({ name: 'Ana', whatsapp: ANTIGO }));
    expect(buildGuardianSearchFields({ phone: NOVO })).toEqual(buildGuardianSearchFields({ phone: ANTIGO }));
  });

  it('botões Ligar e WhatsApp', () => {
    expect(telHref(NOVO)).toBe('tel:5133334444');
    expect(telHref(ANTIGO)).toBe('tel:5133334444');
    expect(whatsappHref(NOVO)).toBe('https://wa.me/555133334444');
    expect(whatsappHref(ANTIGO)).toBe('https://wa.me/555133334444');
  });
});

// O Novo lead e a página pública de indicação tinham cada um a sua cópia da
// máscara, com o mesmo defeito do fixo. Agora os dois usam formatPhone, e esta
// varredura impede que a cópia volte.
describe('a máscara de telefone é uma só', () => {
  const fonte = (caminho) => readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8');
  const TELAS = ['../../modals/AddLeadModal.jsx', '../../views/public/ReferralLandingScreen.jsx'];
  const IMPORTA_FORMATPHONE = /import \{[^}]*\bformatPhone\b[^}]*\} from '(?:\.\.\/)+lib\/masks\.js'/;
  // O "(DD" montado na mão com os dois primeiros dígitos.
  const MASCARA_LOCAL = /\(\$\{\w+\.slice\(0,\s*2\)\}/;

  it.each(TELAS)('%s usa formatPhone de masks.js e não monta máscara própria', (caminho) => {
    const texto = fonte(caminho);
    expect(texto).toMatch(IMPORTA_FORMATPHONE);
    expect(texto).not.toMatch(MASCARA_LOCAL);
  });

  it('a varredura enxerga a máscara montada na mão', () => {
    expect('return `(${d.slice(0, 2)}) ${d.slice(2)}`;').toMatch(MASCARA_LOCAL);
  });

  it('a página de indicação guarda o número já mascarado', () => {
    // Ela guardava o texto cru do campo e mandava esse texto para a api. Com o
    // desenho do fixo até o 10º dígito, o 11º chegaria como "(51) 9812-44710".
    expect(fonte('../../views/public/ReferralLandingScreen.jsx')).toMatch(/set\(\{\s*whatsapp:\s*formatPhone\(e\.target\.value\)\s*\}\)/);
  });
});
