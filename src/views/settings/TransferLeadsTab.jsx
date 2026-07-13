import { useState, useMemo } from 'react';
import { AlertCircle, ArrowRightLeft, Search } from 'lucide-react';
import { collection, doc, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Btn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { StyledSelect } from '../../components/ui/Field.jsx';

// Busca sem acento/caixa.
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function TransferLeadsTab({ db, usersList, appUser, leads }) {
  const toast = useToast();
  const [mode, setMode] = useState('all'); // 'all' = carteira inteira · 'pick' = leads específicos
  const [fromUser, setFromUser] = useState('');
  const [toUser, setToUser] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pickQuery, setPickQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const orphanedConsultants = useMemo(() => {
    if (!leads || !usersList) return [];
    const activeIds = new Set(usersList.map(u => u.id));
    const orphans = new Map();
    leads.forEach(l => {
      if (l.consultantId && !activeIds.has(l.consultantId) && !orphans.has(l.consultantId)) {
        orphans.set(l.consultantId, {
          id: l.consultantId,
          name: l.consultantName ? `${l.consultantName} (Excluído)` : `Consultor Excluído (${l.consultantId.substring(0, 4)})`,
        });
      }
    });
    return Array.from(orphans.values());
  }, [leads, usersList]);

  const allFromConsultants = [...(usersList || []), ...orphanedConsultants];

  // Trocar a origem limpa a seleção individual (evita arrastar IDs de outro consultor).
  const changeFrom = (id) => { setFromUser(id); setSelectedIds(new Set()); };

  // Leads do consultor de origem (modo "específicos"): toda a carteira dele.
  const fromLeads = useMemo(
    () => (fromUser ? (leads || []).filter(l => l.consultantId === fromUser) : []),
    [leads, fromUser],
  );
  const visibleLeads = useMemo(() => {
    const q = norm(pickQuery.trim());
    return fromLeads
      .filter(l => !q || norm(l.name).includes(q))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [fromLeads, pickQuery]);

  const toggleLead = (id) => setSelectedIds(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const allVisibleSelected = visibleLeads.length > 0 && visibleLeads.every(l => selectedIds.has(l.id));
  const toggleAllVisible = () => setSelectedIds(prev => {
    const n = new Set(prev);
    if (allVisibleSelected) visibleLeads.forEach(l => n.delete(l.id));
    else visibleLeads.forEach(l => n.add(l.id));
    return n;
  });

  // Núcleo da migração: move os leads informados (+ as interações vinculadas)
  // para o consultor de destino e registra uma nota. Usado pelos dois modos.
  const doMigrate = async (movedLeadIds, targetUser, noteText) => {
    const leadOps = movedLeadIds.map(id => ({
      ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, id),
      data: { consultantId: toUser, consultantName: targetUser?.name || 'Consultor', consultantAuthUid: targetUser?.authUid || null },
    }));
    await commitOpsInChunks(db, leadOps);

    if (movedLeadIds.length > 0) {
      const movedSet = new Set(movedLeadIds);
      const interactionsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH));
      const interactionOps = [];
      interactionsSnap.forEach(interactionDoc => {
        const item = interactionDoc.data();
        if (!item.leadId || !movedSet.has(item.leadId)) return;
        interactionOps.push({
          ref: doc(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH, interactionDoc.id),
          data: { leadConsultantId: toUser, leadConsultantAuthUid: targetUser?.authUid || null },
        });
      });
      await commitOpsInChunks(db, interactionOps);
    }

    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
      text: noteText, consultantName: appUser.name, type: 'note', createdAt: serverTimestamp(),
      actorId: appUser?.id || null, actorAuthUid: appUser?.authUid || null,
    });
  };

  // Carteira inteira: move TODA a base do consultor de origem (query no Firestore,
  // pega ativos + Venda + Perda, não só os carregados na tela).
  const handleTransferAll = async () => {
    if (!fromUser || !toUser) { toast.warning('Selecione consultor de origem e de destino.'); return; }
    if (fromUser === toUser) { toast.warning('Origem e destino são os mesmos.'); return; }
    const fromObjLocal = allFromConsultants.find(u => u.id === fromUser);
    const targetUser = (usersList || []).find(u => u.id === toUser);
    const total = (leads || []).filter(l => l.consultantId === fromUser).length;
    if (!window.confirm(
      `Migrar ${total} lead(s) de "${fromObjLocal?.name || 'origem'}" para "${targetUser?.name || 'destino'}"?\n\n` +
      'Inclui toda a base (ativos, Venda e Perda) e as interações vinculadas. Esta ação não pode ser desfeita.'
    )) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
        where('consultantId', '==', fromUser),
      ));
      const ids = snap.docs.map(d => d.id);
      await doMigrate(ids, targetUser, `MIGRAÇÃO MASTER: ${ids.length} leads movidos para [${targetUser?.name || 'Novo Consultor'}].`);
      toast.success(`${ids.length} lead(s) migrado(s) com sucesso.`);
      setFromUser(''); setToUser('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao migrar leads. Tente novamente.');
    }
    setLoading(false);
  };

  // Leads específicos: move só os selecionados na lista.
  const handleTransferSelected = async () => {
    if (!fromUser || !toUser) { toast.warning('Selecione consultor de origem e de destino.'); return; }
    if (fromUser === toUser) { toast.warning('Origem e destino são os mesmos.'); return; }
    if (selectedIds.size === 0) { toast.warning('Selecione ao menos um lead para migrar.'); return; }
    const fromObjLocal = allFromConsultants.find(u => u.id === fromUser);
    const targetUser = (usersList || []).find(u => u.id === toUser);
    const ids = [...selectedIds];
    if (!window.confirm(
      `Migrar ${ids.length} lead(s) selecionado(s) de "${fromObjLocal?.name || 'origem'}" para "${targetUser?.name || 'destino'}"?\n\n` +
      'Inclui as interações vinculadas. Esta ação não pode ser desfeita.'
    )) return;
    setLoading(true);
    try {
      await doMigrate(ids, targetUser, `MIGRAÇÃO: ${ids.length} lead(s) movido(s) para [${targetUser?.name || 'Novo Consultor'}].`);
      toast.success(`${ids.length} lead(s) migrado(s) com sucesso.`);
      setSelectedIds(new Set()); setFromUser(''); setToUser('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao migrar leads. Tente novamente.');
    }
    setLoading(false);
  };

  const fromObj = allFromConsultants.find(u => u.id === fromUser);
  const toObj = (usersList || []).find(u => u.id === toUser);
  const fromLeadsCount = fromUser ? (leads || []).filter(l => l.consultantId === fromUser && l.status !== 'Venda' && l.status !== 'Perda').length : 0;
  const toLeadsCount = toUser ? (leads || []).filter(l => l.consultantId === toUser && l.status !== 'Venda' && l.status !== 'Perda').length : 0;
  const totalFromBase = fromUser ? (leads || []).filter(l => l.consultantId === fromUser).length : 0;
  const canSubmitAll = fromUser && toUser && fromUser !== toUser && !loading;
  const canSubmitPick = canSubmitAll && selectedIds.size > 0;

  return (
    <SettingsCard title="Migrar leads" hint="Transfira leads de um consultor para outro" icon={<ArrowRightLeft size={16} />}>
      {/* Modo: carteira inteira x leads específicos */}
      <div className="flex justify-center mb-5">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] text-[12.5px] font-semibold">
          {[['all', 'Carteira inteira'], ['pick', 'Leads específicos']].map(([k, lbl]) => (
            <button key={k} type="button" onClick={() => setMode(k)} className={`px-4 h-9 rounded-lg transition ${mode === k ? 'bg-white dark:bg-white/[0.12] text-brand-700 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Origem / Destino */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
        <div className="rounded-xl border border-border bg-slate-50/60 dark:bg-white/[0.02] p-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">Origem</div>
          <StyledSelect value={fromUser} onChange={e => changeFrom(e.target.value)}>
            <option value="">Selecione o consultor de origem...</option>
            {(allFromConsultants || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </StyledSelect>
          {fromObj && (
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={fromObj.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[13.5px] truncate">{fromObj.name}</div>
                {fromObj.email && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{fromObj.email}</div>}
              </div>
              <div className="ml-auto text-right shrink-0">
                <div className="num text-[20px] font-semibold tracking-tight leading-none">{fromLeadsCount}</div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">leads ativos</div>
              </div>
            </div>
          )}
        </div>

        <div className="hidden lg:flex flex-col items-center justify-center px-2">
          <div className="w-10 h-10 rounded-full bg-brand-600 text-white grid place-items-center shadow-card">
            <ArrowRightLeft size={16} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-slate-50/60 dark:bg-white/[0.02] p-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">Destino</div>
          <StyledSelect value={toUser} onChange={e => setToUser(e.target.value)}>
            <option value="">Selecione o consultor de destino...</option>
            {(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </StyledSelect>
          {toObj && (
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={toObj.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[13.5px] truncate">{toObj.name}</div>
                {toObj.email && <div className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">{toObj.email}</div>}
              </div>
              <div className="ml-auto text-right shrink-0">
                <div className="num text-[20px] font-semibold tracking-tight leading-none">{toLeadsCount}</div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">leads ativos</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modo "específicos": lista de leads do consultor de origem */}
      {mode === 'pick' && fromUser && (
        <div className="mt-5 rounded-xl border border-border bg-slate-50/60 dark:bg-white/[0.02] p-4">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
              Leads de {fromObj?.name} <span className="text-slate-400 dark:text-slate-500 font-normal">· {selectedIds.size} selecionado(s)</span>
            </div>
            {visibleLeads.length > 0 && (
              <button type="button" onClick={toggleAllVisible} className="text-[12px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300">
                {allVisibleSelected ? 'Limpar seleção' : 'Selecionar todos'}
              </button>
            )}
          </div>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={pickQuery}
              onChange={e => setPickQuery(e.target.value)}
              placeholder="Buscar lead pelo nome…"
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] placeholder:text-slate-400 transition"
            />
          </div>
          {visibleLeads.length === 0 ? (
            <div className="text-center text-[12.5px] text-slate-400 italic py-6">{fromLeads.length === 0 ? 'Este consultor não tem leads.' : 'Nenhum lead encontrado.'}</div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.05]">
              {visibleLeads.map(l => (
                <label key={l.id} className="flex items-center gap-3 px-1 py-2 cursor-pointer rounded-md hover:bg-white/70 dark:hover:bg-white/[0.03]">
                  <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleLead(l.id)} className="size-4 accent-brand-600 shrink-0" />
                  <span className="text-[13px] text-slate-800 dark:text-slate-100 flex-1 truncate">{l.name || 'Sem nome'}</span>
                  {l.status && <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-300 shrink-0">{l.status}</span>}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resumo */}
      {mode === 'all' && fromObj && toObj && (
        <div className="mt-6 p-4 rounded-xl bg-amber-50/70 dark:bg-amber-500/[0.06] border border-amber-200/70 dark:border-amber-500/20 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-300 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-amber-900 dark:text-amber-200">
              <span className="num font-semibold">{totalFromBase}</span> {totalFromBase === 1 ? 'lead será migrado' : 'leads serão migrados'} de <span className="font-semibold">{fromObj.name}</span> para <span className="font-semibold">{toObj.name}</span>.
            </p>
            <p className="text-[12px] text-amber-800/80 dark:text-amber-200/80 mt-0.5">
              Inclui toda a base do consultor de origem (ativos, Venda e Perda) + todas as interações vinculadas.
            </p>
          </div>
        </div>
      )}
      {mode === 'pick' && fromObj && toObj && selectedIds.size > 0 && (
        <div className="mt-6 p-4 rounded-xl bg-amber-50/70 dark:bg-amber-500/[0.06] border border-amber-200/70 dark:border-amber-500/20 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-300 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-amber-900 dark:text-amber-200">
              <span className="num font-semibold">{selectedIds.size}</span> {selectedIds.size === 1 ? 'lead selecionado será migrado' : 'leads selecionados serão migrados'} de <span className="font-semibold">{fromObj.name}</span> para <span className="font-semibold">{toObj.name}</span>.
            </p>
            <p className="text-[12px] text-amber-800/80 dark:text-amber-200/80 mt-0.5">Inclui as interações vinculadas a esses leads.</p>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <Btn kind="soft" onClick={() => { setFromUser(''); setToUser(''); setSelectedIds(new Set()); }}>Cancelar</Btn>
        {mode === 'all' ? (
          <Btn kind="brand" icon={<ArrowRightLeft size={13} />} onClick={handleTransferAll} disabled={!canSubmitAll}>
            {loading ? 'Migrando...' : 'Confirmar migração'}
          </Btn>
        ) : (
          <Btn kind="brand" icon={<ArrowRightLeft size={13} />} onClick={handleTransferSelected} disabled={!canSubmitPick}>
            {loading ? 'Migrando...' : (selectedIds.size > 0 ? `Migrar ${selectedIds.size} selecionado${selectedIds.size === 1 ? '' : 's'}` : 'Migrar selecionados')}
          </Btn>
        )}
      </div>
    </SettingsCard>
  );
}
export { TransferLeadsTab };
