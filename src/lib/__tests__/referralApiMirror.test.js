// Paridade FRONT ↔ API do sistema de indicações. api/ não importa src/
// (fronteira de bundle da Vercel), então api/_referral.js ESPELHA as regras
// puras que a função pública precisa — e este teste trava a deriva: mudou um
// lado sem o outro, quebra aqui (mesmo pacto do _profile.js ↔ gymProfile.js).

import { describe, it, expect } from 'vitest';
import * as apiMirror from '../../../api/_referral.js';
import { buildLeadSearchFields } from '../leadDerived.js';
import { normalize } from '../globalSearch.js';
import { getDefaultFunnel } from '../funnels.js';
import {
  getReferralFunnel,
  getReferralEntryStage,
  referralIndicadoText,
  referralIndicouText
} from '../referrals.js';

describe('espelho api/_referral.js ↔ src/lib', () => {
  it('buildLeadSearchFields idêntico (acentos, máscara de fone e CPF, vazio)', () => {
    const cases = [
      { name: 'João da Silva Júnior', whatsapp: '(51) 9 9812-3344', cpf: '123.456.789-01' },
      { name: '  ÉRICA  Ávila ', whatsapp: '51998123344', cpf: '' },
      {}
    ];
    cases.forEach((c) => expect(apiMirror.buildLeadSearchFields(c)).toEqual(buildLeadSearchFields(c)));
  });

  it('normalize idêntico', () => {
    ['Indicação', ' AGUARDANDO AÇÃO ', 'çãõ ÊÎ'].forEach((s) =>
      expect(apiMirror.normalize(s)).toBe(normalize(s)));
  });

  it('textos de timeline idênticos', () => {
    expect(apiMirror.referralIndicadoText('Maria')).toBe(referralIndicadoText('Maria'));
    expect(apiMirror.referralIndicouText('João')).toBe(referralIndicouText('João'));
  });

  it('escolha do funil de indicações idêntica (systemKind + createdAt mais antigo)', () => {
    const funnels = [
      { id: 'u', name: 'Indicações' },
      { id: 'b', systemKind: 'referral', createdAt: { toMillis: () => 100_000 } },
      { id: 'a', systemKind: 'referral', createdAt: { seconds: 200 } }
    ];
    expect(apiMirror.pickReferralFunnel(funnels)?.id).toBe(getReferralFunnel(funnels)?.id);
    expect(apiMirror.pickReferralFunnel([])).toBe(getReferralFunnel([]));
  });

  it('escolha do funil default idêntica (isDefault → primeiro da lista)', () => {
    const funnels = [{ id: 'x' }, { id: 'y', isDefault: true }];
    expect(apiMirror.pickDefaultFunnel(funnels)?.id).toBe(getDefaultFunnel(funnels)?.id);
    expect(apiMirror.pickDefaultFunnel([{ id: 'only' }])?.id).toBe('only');
    expect(apiMirror.pickDefaultFunnel([])).toBe(getDefaultFunnel([]));
  });

  it('etapa de entrada idêntica (isEntry → isSystem+nome → menor order)', () => {
    const FID = 'f1';
    const byFlag = [
      { id: 's2', funnelId: FID, name: 'Meio', order: 1 },
      { id: 's1', funnelId: FID, name: 'Aguardando ação', isEntry: true, order: 3 }
    ];
    const byName = [
      { id: 's1', funnelId: FID, name: ' AGUARDANDO AÇÃO ', isSystem: true, order: 2 },
      { id: 's0', funnelId: FID, name: 'Negociação', isSystem: true, order: 0 }
    ];
    const byOrder = [
      { id: 'b', funnelId: FID, name: 'B', order: 5 },
      { id: 'a', funnelId: FID, name: 'A', order: 1 }
    ];
    [byFlag, byName, byOrder].forEach((sts) =>
      expect(apiMirror.pickEntryStage(sts, FID)?.id).toBe(getReferralEntryStage(sts, FID)?.id));
  });
});
