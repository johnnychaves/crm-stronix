// O relatório impresso (mockup aprovado em
// docs/superpowers/specs/mockups/2026-10-15-relatorios-impressao.html): A4 em
// pé, só com a lista. No topo, a academia, o título, a pergunta e a ficha do que
// a folha mostra (período ou retrato, filtros da barra e o filtro da lista);
// depois a lista inteira, com o filtro da lista, nas mesmas colunas da tela.
//
// A folha só existe enquanto imprime: o botão Imprimir preenche o
// ReportPrintContext com a ficha (printSheetOf, em
// src/lib/relatorios/leads/impressao.js), o ReportList de cada submenu desenha
// a folha num portal em document.body, e o afterprint desmonta. O CSS de impressão (src/index.css,
// "Relatório impresso") esconde o resto da página só quando a folha está no
// body, então as outras telas imprimem como antes. O rodapé de cada folha (quem
// gerou e "Folha X de Y") vai nas caixas de margem do @page, que só o Chrome
// desenha; nos outros navegadores a folha sai sem rodapé.
//
// Nada de contato pessoal: as colunas são as da lista da tela, que não levam
// telefone nem CPF (a planilha leva, o papel fica na recepção).
import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { fmtNum } from '../../lib/format.js';
import { ReportPrintContext } from '../../lib/relatorios/leads/impressao.js';
import { SurgeMark } from '../../components/brand/SurgeMark.jsx';

// Texto de CSS entre aspas: tudo que não é letra, número ou pontuação simples
// vira escape, então nome nenhum fecha a string nem a regra.
const cssString = (s) => `"${String(s).replace(/[^\p{L}\p{N} .,:/()]/gu, (c) => `\\${c.codePointAt(0).toString(16)} `)}"`;
const BOX = "font-family: 'Geist', ui-sans-serif, sans-serif; font-size: 6.9pt; color: #7A8496; vertical-align: top; padding-top: 2mm; border-top: 0.6pt solid #C9D1DE;";
// O @page vai aqui, e não no index.css, porque só vale enquanto a folha existe.
const pageCss = (generated) => `@page { size: A4; margin: 12mm 14mm 15mm;
  @bottom-left { content: ${cssString(generated)}; ${BOX} }
  @bottom-center { content: ""; ${BOX} }
  @bottom-right { content: "Folha " counter(page) " de " counter(pages); text-align: right; ${BOX} } }`;

// O peso de cada coluna na largura da folha (a tabela é de largura fixa, para o
// texto cortar com reticências). Coluna sem peso vale 1.
const WEIGHT = Object.freeze({
  nome: 1.6, origem: 0.95, consultor: 1.2, etapa: 1.1, cadastro: 0.7, contato: 1.3, agendou: 0.6, veio: 0.5,
  desfecho: 1.75, situacao: 1.1, tipo: 0.7, diaHora: 1.1, unidade: 1.15, professor: 1.15, motivo: 1.5, perda: 0.75,
  ha: 0.6, naEtapa: 0.95, registro: 1.5, proximo: 1.3,
});

/**
 * A folha impressa, num portal em document.body. Só desenha durante a
 * impressão (com o ReportPrintContext preenchido).
 *
 * @param {object} props
 * @param {{ title: string, question: string }} props.heading O título e a pergunta do submenu.
 * @param {number} props.total O número da lista.
 * @param {string} props.noun O nome da lista ("leads da safra").
 * @param {Array} props.columns As colunas da lista da tela.
 * @param {Array} props.rows Todas as linhas, com o filtro da lista.
 */
export function ReportPrint({ heading, total, noun, columns, rows }) {
  const sheet = useContext(ReportPrintContext);
  if (!sheet || !heading) return null;
  const sum = columns.reduce((s, c) => s + (WEIGHT[c.key] ?? 1), 0);
  return createPortal(
    <div data-relatorio-impresso="">
      <style>{pageCss(sheet.generated)}</style>
      <div className="ri-topo">
        <span className="ri-academia">{sheet.academy}</span>
        <span className="ri-marca"><SurgeMark size={14} />Stronilead</span>
      </div>
      <h1 className="ri-titulo">{heading.title}</h1>
      <p className="ri-pergunta">{heading.question}</p>
      <dl className="ri-ficha">
        {sheet.fields.map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}{f.note && <span className="ri-fraco">{` (${f.note})`}</span>}</dd>
          </div>
        ))}
        {sheet.cutLine && (
          <div className="ri-linha2">
            <dt>Lista filtrada por</dt>
            <dd>{sheet.cutLine.value}<span className="ri-fraco">{` (${sheet.cutLine.note})`}</span></dd>
          </div>
        )}
      </dl>
      <div className="ri-lista-cab">
        <h2><span className="ri-num">{fmtNum(total)}</span> {noun}</h2>
        <span>{sheet.listNote}</span>
      </div>
      <table className="ri-nomes">
        <colgroup>
          {columns.map((c) => <col key={c.key} style={{ width: `${((WEIGHT[c.key] ?? 1) * 100) / sum}%` }} />)}
        </colgroup>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>{columns.map((c) => <td key={c.key}>{c.render(r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <p className="ri-fim">{`Fim da lista: ${fmtNum(total)} ${noun}`}</p>
    </div>,
    document.body
  );
}
