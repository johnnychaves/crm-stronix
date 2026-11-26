// src/lib/__tests__/fichaVisitante.sweep.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../views/LeadProfileView.jsx', import.meta.url), 'utf8');

describe('ficha e Visitante', () => {
  it('a etiqueta sai do visitorOf', () => {
    expect(src).toMatch(/visitorOf\(lead, bandNow\)/);
    expect(src).toMatch(/Visitante · \{visitor\.shortText\}/);
  });
  it('lançar e encerrar passam pela ação e pelas gravações do freepass', () => {
    expect(src).toMatch(/can\(appUser, ACTIONS\.FREEPASS_LANCAR\)/);
    expect(src).toMatch(/writeFreepassLaunch\(/);
    expect(src).toMatch(/writeFreepassEnd\(/);
  });
  it('a aba Contratos recebe os freepass da pessoa', () => {
    expect(src).toMatch(/useLeadFreepasses\(\{ db, leadId: lead\?\.id, active: listenersActive \}\)/);
    expect(src).toMatch(/freepasses=\{freepasses\}/);
  });
});
