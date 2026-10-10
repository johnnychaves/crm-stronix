// Borda dos primitivos do shadcn (src/components/ui/, os arquivos com nome
// minúsculo). No Tailwind v4 a cor padrão da borda é a cor do texto
// (currentColor), e o index.css não tem a regra base que o shadcn costuma
// trazer (`* { border-color: var(--border) }`). Um `border` sem cor deixava o
// balão do Popover, a lista do Select, o menu e o diálogo com borda
// azul-marinho no claro e quase branca no escuro. Cada tela consertava por
// conta própria passando `border-border`, e quem esquecia ficava com a borda
// errada.
//
// A correção mora nos primitivos, e não numa regra global. A regra global
// vale para todo elemento com borda, inclusive os que montam a classe em
// outro arquivo, e só daria para conferir tela a tela. A varredura de
// 09/10/2026 não achou borda visível que dependa da cor do texto, mas a
// troca nos primitivos é a menor, e é a que este teste consegue travar.
//
// Este teste trava a correção: todo `border` (ou `border-t`, `border-2`...)
// de um primitivo precisa vir com uma cor de borda na mesma string de
// classes. Quem rodar `npx shadcn add` com sobrescrever e trouxer o `border`
// sozinho de volta vê o teste quebrar.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI = fileURLToPath(new URL('../../components/ui', import.meta.url));
// Primitivo do shadcn tem nome minúsculo (popover.jsx); os componentes
// próprios do app nesta pasta começam com maiúscula (Btn.jsx, Avatar.jsx).
const primitivos = readdirSync(UI)
  .filter((nome) => /^[a-z][a-z-]*\.jsx$/.test(nome))
  .map((nome) => [nome, readFileSync(join(UI, nome), 'utf8')]);

const ESTILOS = new Set(['solid', 'dashed', 'dotted', 'double', 'hidden', 'none']);

// Separa a variante (tudo antes do último `:` fora de colchete) do utilitário.
function separa(classe) {
  let fundo = 0;
  let corte = -1;
  for (let i = 0; i < classe.length; i++) {
    const c = classe[i];
    if (c === '[' || c === '(') fundo++;
    else if (c === ']' || c === ')') fundo--;
    else if (c === ':' && fundo === 0) corte = i;
  }
  const semImportante = (u) => u.replace(/^!|!$/g, '');
  return corte < 0
    ? { variante: '', util: semImportante(classe) }
    : { variante: classe.slice(0, corte), util: semImportante(classe.slice(corte + 1)) };
}

// Largura: border, border-2, border-[3px], border-t, border-x-0...
function largura(util) {
  const m = /^border(?:-(x|y|s|e|t|r|b|l))?(?:-(\d+|\[[^\]]+\]))?$/.exec(util);
  if (!m) return null;
  const valor = m[2];
  if (valor && valor.startsWith('[') && !/^\[\d/.test(valor)) return null; // border-[#fff] é cor
  return { lado: m[1] || 'todos', zero: valor === '0' };
}

// Cor: border-border, border-input, border-t-transparent, dark:border-white/10...
function cor(util) {
  if (!util.startsWith('border-') || largura(util)) return null;
  let resto = util.slice('border-'.length);
  let lado = 'todos';
  const m = /^(x|y|s|e|t|r|b|l)-(.+)$/.exec(resto);
  if (m) [, lado, resto] = m;
  if (ESTILOS.has(resto) || /^(collapse|separate|spacing)/.test(resto)) return null;
  return { lado };
}

function strings(fonte) {
  const out = [];
  const re = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\$]|\\.)*)`/g;
  let m;
  while ((m = re.exec(fonte))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

// Larguras de borda sem uma cor da mesma variante (ou sem variante) que cubra
// o mesmo lado, numa string de classes.
function bordasSemCor(texto) {
  const classes = texto.split(/\s+/).filter(Boolean).map(separa);
  const cores = classes.map((c) => ({ ...c, cor: cor(c.util) })).filter((c) => c.cor);
  return classes
    .map((c) => ({ ...c, largura: largura(c.util) }))
    .filter((c) => c.largura && !c.largura.zero)
    .filter((c) => !cores.some((k) => (k.variante === c.variante || k.variante === '')
      && (k.cor.lado === 'todos' || k.cor.lado === c.largura.lado)))
    .map((c) => (c.variante ? `${c.variante}:${c.util}` : c.util));
}

describe('borda dos primitivos do shadcn', () => {
  it('acha os primitivos que desenham balão, menu e diálogo', () => {
    const nomes = primitivos.map(([nome]) => nome);
    expect(nomes).toEqual(expect.arrayContaining(['popover.jsx', 'select.jsx', 'dropdown-menu.jsx', 'dialog.jsx', 'sheet.jsx', 'card.jsx', 'button.jsx']));
  });

  it('nenhum primitivo tem border sem cor de borda na mesma string de classes', () => {
    const achados = [];
    for (const [nome, fonte] of primitivos) {
      for (const texto of strings(fonte)) {
        for (const classe of bordasSemCor(texto)) achados.push(`${nome}: ${classe}`);
      }
    }
    expect(achados).toEqual([]);
  });

  it('as superfícies que tinham border sozinho levam border-border', () => {
    const fonte = Object.fromEntries(primitivos);
    const comBorda = (nome, trecho) => strings(fonte[nome]).filter((s) => s.includes(trecho));
    const casos = [
      ['popover.jsx', 'bg-popover text-popover-foreground'], // PopoverContent
      ['select.jsx', 'max-h-(--radix-select-content-available-height)'], // SelectContent
      ['dropdown-menu.jsx', 'max-h-(--radix-dropdown-menu-content-available-height)'], // DropdownMenuContent
      ['dropdown-menu.jsx', 'shadow-lg data-[side=bottom]'], // DropdownMenuSubContent
      ['dialog.jsx', 'translate-x-[-50%]'], // DialogContent
      ['card.jsx', 'bg-card py-6'], // Card
      ['button.jsx', 'bg-background shadow-xs'], // Button outline
    ];
    for (const [nome, trecho] of casos) {
      const achadas = comBorda(nome, trecho);
      expect(achadas, `${nome} · ${trecho}`).toHaveLength(1);
      expect(achadas[0].split(/\s+/), `${nome} · ${trecho}`).toEqual(expect.arrayContaining(['border', 'border-border']));
    }
  });

  it('a varredura enxerga o border sozinho, com variante e com lado', () => {
    expect(bordasSemCor('rounded-md border bg-popover p-4')).toEqual(['border']);
    expect(bordasSemCor('rounded-md border border-border bg-popover')).toEqual([]);
    expect(bordasSemCor('border-l border-border')).toEqual([]);
    expect(bordasSemCor('border-t-2 border-b-transparent')).toEqual(['border-t-2']);
    expect(bordasSemCor('md:border-r')).toEqual(['md:border-r']);
    expect(bordasSemCor('border dark:border-input')).toEqual(['border']);
    expect(bordasSemCor('file:border-0 border-[#fff]')).toEqual([]);
    expect(bordasSemCor('border border-transparent')).toEqual([]);
  });
});
