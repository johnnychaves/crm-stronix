// src/lib/__tests__/fichaVisitante.sweep.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../views/LeadProfileView.jsx', import.meta.url), 'utf8');

describe('ficha e Visitante', () => {
  it('a etiqueta sai do visitorOf', () => {
    expect(src).toMatch(/visitorOf\(running \? \{ \.\.\.lead, \.\.\.freepassSummaryPatch\(running, bandNow\) \} : lead, bandNow\)/);
    expect(src).toMatch(/Visitante · \{visitor\.shortText\}/);
  });
  it('lançar e encerrar passam pela ação e pelas gravações do freepass', () => {
    expect(src).toMatch(/can\(appUser, ACTIONS\.FREEPASS_LANCAR\)/);
    expect(src).toMatch(/writeFreepassLaunch\(/);
    expect(src).toMatch(/writeFreepassEnd\(/);
  });
  it('a aba Contratos recebe os freepass da pessoa', () => {
    expect(src).toMatch(/useLeadFreepasses\(\{ db, leadId: lead\?\.id, active: listenersActive \}\)/);
    expect(src).toMatch(/freepasses=\{freepasses \?\? \[\]\}/);
  });
  it('lead em Perda não recebe freepass e os gravadores conferem a leitura e a regra', () => {
    expect(src).toMatch(/canFreepass=\{canFreepass && lead\.status !== 'Perda'\}/);
    expect(src).toMatch(/Reative o lead antes de lançar o freepass\./);
    expect(src).toMatch(/launchCheck\(\{ type, freepasses, modalidadeName, gestor: isGestor\(appUser\) \}\)/);
    expect(src).toMatch(/freepassesLoading=\{freepasses === null\}/);
  });
});
