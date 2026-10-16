// @vitest-environment jsdom
// Planilha única do app (src/lib/csvExport.js): separador, aspas só quando o
// valor pede, proteção contra fórmula e o download com o BOM. O ambiente é o
// jsdom por causa do download, que precisa de document e Blob.
import { describe, it, expect, vi } from 'vitest';
import { csvCell, toCsv, downloadCsv } from '../csvExport.js';

const columns = [{ key: 'a', label: 'Coluna A' }, { key: 'b', label: 'Coluna B' }];
const bytesOf = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(new Uint8Array(reader.result));
  reader.readAsArrayBuffer(blob);
});

describe('planilha', () => {
  it('cabeçalho e linhas, com ; e a quebra de linha do Windows', () => {
    expect(toCsv([{ a: '1', b: '2' }, { a: '3', b: '4' }], columns)).toBe('Coluna A;Coluna B\r\n1;2\r\n3;4');
  });

  it('aspas só quando o valor pede', () => {
    expect(csvCell('Ana Lima')).toBe('Ana Lima');
    expect(csvCell('Nome; Sobrenome')).toBe('"Nome; Sobrenome"');
    expect(csvCell('Disse "oi"')).toBe('"Disse ""oi"""');
    expect(csvCell('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });

  it('valor que começa com fórmula ganha um apóstrofo na frente', () => {
    expect(csvCell('=SOMA(A1:A9)')).toBe("'=SOMA(A1:A9)");
    expect(csvCell('+5511999990000')).toBe("'+5511999990000");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('\tx')).toBe("'\tx");
    expect(csvCell('\r=1+1')).toBe(`"'\r=1+1"`);
    expect(csvCell('=A;B')).toBe(`"'=A;B"`);
  });

  it('valor ausente vira vazio', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(toCsv([{ a: null }], columns)).toBe('Coluna A;Coluna B\r\n;');
  });

  it('o download leva o nome e o BOM, e solta o endereço do arquivo um segundo depois', async () => {
    const blobs = [];
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = vi.fn((blob) => { blobs.push(blob); return 'blob:planilha'; });
    URL.revokeObjectURL = vi.fn();
    const seen = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function clickFake() {
      seen.push([this.download, this.getAttribute('href')]);
    });
    try {
      // Só o setTimeout fica falso: com todos os timers falsos, o FileReader do
      // jsdom (o bytesOf, mais abaixo) nunca termina.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      downloadCsv('leads-entrada.csv', 'Nome\r\nAna');
      expect(seen).toEqual([['leads-entrada.csv', 'blob:planilha']]);
      expect(document.querySelector('a[download]')).toBeNull();
      // Safari pode perder o download se o endereço sumir no clique.
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:planilha');
      const bytes = await bytesOf(blobs[0]);
      expect([...bytes.slice(0, 3)]).toEqual([0xEF, 0xBB, 0xBF]);
      expect(new TextDecoder().decode(bytes.slice(3))).toBe('Nome\r\nAna');
    } finally {
      vi.useRealTimers();
      click.mockRestore();
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    }
  });
});
