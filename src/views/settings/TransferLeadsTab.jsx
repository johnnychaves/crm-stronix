import { useState, useMemo } from 'react';
import { AlertCircle, ArrowRightLeft } from 'lucide-react';
import { collection, doc, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Btn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { StyledSelect } from '../../components/ui/Field.jsx';

function TransferLeadsTab({ db, usersList, appUser, leads }) {
  const toast = useToast();
  const [fromUser, setFromUser] = useState('');
  const [toUser, setToUser] = useState('');
  const [loading, setLoading] = useState(false);

  const orphanedConsultants = useMemo(() => {
    if (!leads || !usersList) return [];
    const activeIds = new Set(usersList.map(u => u.id));
    const orphans = new Map();
    leads.forEach(l => {
      if (l.consultantId && !activeIds.has(l.consultantId)) {
        if (!orphans.has(l.consultantId)) {
          orphans.set(l.consultantId, {
            id: l.consultantId,
            name: l.consultantName ? `${l.consultantName} (Excluído)` : `Consultor Excluído (${l.consultantId.substring(0, 4)})`
          });
        }
      }
    });
    return Array.from(orphans.values());
  }, [leads, usersList]);

  const allFromConsultants = [...(usersList || []), ...orphanedConsultants];

  const handleTransfer = async () => {
    if (!fromUser || !toUser) { toast.warning('Selecione consultor de origem e de destino.'); return; }
    if (fromUser === toUser) { toast.warning('Origem e destino são os mesmos.'); return; }
    // Confirmação informativa: operação em massa e irreversível. Mostra
    // quantos leads, de quem para quem, e o escopo (base inteira + interações).
    const fromObj = (allFromConsultants || []).find(u => u.id === fromUser);
    const toObj = (usersList || []).find(u => u.id === toUser);
    const totalToMove = (leads || []).filter(l => l.consultantId === fromUser).length;
    if (!window.confirm(
      `Migrar ${totalToMove} lead(s) de "${fromObj?.name || 'origem'}" para "${toObj?.name || 'destino'}"?\n\n` +
      `Inclui toda a base do consultor de origem (ativos, Venda e Perda) e todas as interações vinculadas. Esta ação não pode ser desfeita.`
    )) return;

    setLoading(true);

    try {
      const q = query(
        collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
        where("consultantId", "==", fromUser)
      );

      const snap = await getDocs(q);
      const targetUser = (usersList || []).find(u => u.id === toUser);

      const movedLeadIds = [];
      const leadOps = [];
      let count = 0;

      snap.forEach(l => {
        movedLeadIds.push(l.id);

        leadOps.push({
          ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, l.id),
          data: {
            consultantId: toUser,
            consultantName: targetUser?.name || "Consultor",
            consultantAuthUid: targetUser?.authUid || null
          }
        });

        count++;
      });

      await commitOpsInChunks(db, leadOps);

      if (movedLeadIds.length > 0) {
        const movedSet = new Set(movedLeadIds);
        const interactionsSnap = await getDocs(
          collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH)
        );

        const interactionOps = [];

        interactionsSnap.forEach(interactionDoc => {
          const item = interactionDoc.data();
          if (!item.leadId || !movedSet.has(item.leadId)) return;

          interactionOps.push({
            ref: doc(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH, interactionDoc.id),
            data: {
              leadConsultantId: toUser,
              leadConsultantAuthUid: targetUser?.authUid || null
            }
          });
        });

        await commitOpsInChunks(db, interactionOps);
      }

      await addDoc(
        collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH),
        {
          text: `MIGRAÇÃO MASTER: ${count} leads movidos para [${targetUser?.name || "Novo Consultor"}].`,
          consultantName: appUser.name,
          type: 'note',
          createdAt: serverTimestamp()
        }
      );

      toast.success(`${count} lead(s) migrado(s) com sucesso.`);
      setFromUser('');
      setToUser('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao migrar leads. Tente novamente.');
    }

    setLoading(false);
  };

  return (
    <SettingsCard
      title="Migrar leads"
      hint="Transfira a base de um consultor para outro"
      icon={<ArrowRightLeft size={16} />}
    >
      {(() => {
        const fromObj = (allFromConsultants || []).find(u => u.id === fromUser);
        const toObj = (usersList || []).find(u => u.id === toUser);
        const fromLeadsCount = fromUser ? (leads || []).filter(l => l.consultantId === fromUser && l.status !== 'Venda' && l.status !== 'Perda').length : 0;
        const toLeadsCount = toUser ? (leads || []).filter(l => l.consultantId === toUser && l.status !== 'Venda' && l.status !== 'Perda').length : 0;
        const totalFromBase = fromUser ? (leads || []).filter(l => l.consultantId === fromUser).length : 0;
        const canSubmit = fromUser && toUser && fromUser !== toUser && !loading;

        return (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
              {/* ORIGEM */}
              <div className="rounded-xl border border-border bg-slate-50/60 dark:bg-white/[0.02] p-4">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">Origem</div>
                <StyledSelect value={fromUser} onChange={e => setFromUser(e.target.value)}>
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

              {/* Arrow */}
              <div className="hidden lg:flex flex-col items-center justify-center px-2">
                <div className="w-10 h-10 rounded-full bg-brand-600 text-white grid place-items-center shadow-card">
                  <ArrowRightLeft size={16} />
                </div>
              </div>

              {/* DESTINO */}
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

            {/* Summary */}
            {fromObj && toObj && (
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

            <div className="mt-5 flex items-center justify-end gap-2">
              <Btn kind="soft" onClick={() => { setFromUser(''); setToUser(''); }}>Cancelar</Btn>
              <Btn kind="brand" icon={<ArrowRightLeft size={13} />} onClick={handleTransfer} disabled={!canSubmit}>
                {loading ? 'Migrando...' : 'Confirmar migração'}
              </Btn>
            </div>
          </>
        );
      })()}
    </SettingsCard>
  );
}
export { TransferLeadsTab };
