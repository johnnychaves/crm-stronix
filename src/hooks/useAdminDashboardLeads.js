// Fonte de leads das MÉTRICAS DE PERÍODO dos dashboards ADMIN (G1c). O admin
// agrega todos os leads da academia num período; em vez de depender do prop
// global (a assinatura da coleção inteira, cortada só no G-flip), busca a UNIÃO
// de quatro janelas de campo (createdAt/convertedAt/appointmentScheduledFor/
// lostAt) sobre o span [startMs, endMs] — superconjunto do período atual +
// anterior + sparkline (computeAdminDashboardSpan). Cada janela é range de campo
// único → índice AUTOMÁTICO, sem composto nem publicação manual. Dedupe por id +
// normalizeLeadDoc (o MESMO shape do prop global, senão dashboardMetrics diverge).
//
// Não é ao vivo (getDocs): rebusca quando o span muda (troca de período no
// seletor) ou via reload(). ADITIVO — não substitui a assinatura global até o
// flip. Uma guarda de corrida garante que só o pedido mais recente escreva
// (troca rápida de preset).
//
// ESCOPO G1c: cobre só as métricas de PERÍODO. A Meta diária por consultor
// (useTeamGoals) e o board do Operacional usam a base CRUA de leads (categorias
// sem janela: follow-up atrasado, renovação) — seguem no prop global até o G1d.

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { appId } from '../lib/firebase.js';
import { specToConstraints } from './usePagedLeads.js';
import { adminDashboardWindowSpecs } from '../lib/leadQueries.js';
import { normalizeLeadDoc } from '../lib/leads.js';

// useAdminDashboardLeads({ db, path, startMs, endMs, enabled })
//   path            : coleção sob artifacts/{appId}/public/data/ (ex.: LEADS_PATH)
//   startMs, endMs  : limites do span (computeAdminDashboardSpan) em ms
//   enabled         : liga a busca (ex.: só no caminho admin)
export function useAdminDashboardLeads({ db, path, startMs, endMs, enabled = true }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const reqIdRef = useRef(0);

  const active = enabled && !!db && Number.isFinite(startMs) && Number.isFinite(endMs);

  const fetchLeads = useCallback(async () => {
    if (!active) {
      setLeads([]);
      setLoading(false);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', path);
      const specs = adminDashboardWindowSpecs(startMs, endMs);
      const snaps = await Promise.all(
        specs.map((spec) => getDocs(query(colRef, ...specToConstraints(spec))))
      );
      // Só o pedido mais recente escreve (o usuário pode trocar de preset antes
      // do getDocs anterior resolver).
      if (reqId !== reqIdRef.current) return;
      const byId = new Map();
      snaps.forEach((snap) => {
        snap.docs.forEach((d) => { if (!byId.has(d.id)) byId.set(d.id, d); });
      });
      setLeads(Array.from(byId.values()).map(normalizeLeadDoc));
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      console.error('useAdminDashboardLeads', path, e);
      setError(e);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [db, path, startMs, endMs, active]);

  // Rebusca quando o span (startMs/endMs) ou o gate mudam — o padrão
  // "refresh on param change" do usePagedLeads.
  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const reload = useCallback(() => fetchLeads(), [fetchLeads]);

  return { leads, loading, error, reload };
}
