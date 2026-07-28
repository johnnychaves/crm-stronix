import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Dumbbell, Mail, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { collection, doc, addDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { auth, appId, LEADS_PATH, PROFESSORS_PATH, USERS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { isClientLead } from '../../lib/leads.js';
import { professorModalityNames } from '../../lib/professores.js';
import { cn } from '../../lib/utils.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useSeatLimits } from '../../hooks/useSeatLimits.js';
import { settingsColorTone } from '../../components/ui/ColorPicker.jsx';
import { SettingsPanel, SettingsSectionHeader } from '../../components/ui/SettingsCard.jsx';
import {
  DialogField, EmptyState, FIELD_INPUT, FormDialog,
  RowAction, SettingsBtn, TableHeadRow
} from './settingsBits.jsx';

// Equipe & acessos — quem entra no app, com qual papel, turno e piso de
// prospecção; e, num card à parte, os professores que conduzem aula
// experimental (catálogo simples, sem login).
//
// Os caminhos de escrita são os mesmos de antes do redesign (/api/admin-*,
// /api/invite-create e o doc do usuário): mudou a casca, não a regra.

const MEMBERS_GRID = '1.6fr .8fr .9fr .9fr 1fr 84px';
const MEMBERS_COLUMNS = [
  { key: 'member', label: 'Membro' },
  { key: 'role', label: 'Papel' },
  { key: 'shift', label: 'Turno' },
  { key: 'target', label: 'Prospecção' },
  { key: 'access', label: 'Acesso' },
  { key: 'actions', label: '' }
];

// Professores usam a MESMA tabela dos membros — as larguras espelham as de
// MEMBERS_GRID (a coluna da barra ocupa duas) para as duas listas lerem como
// uma coisa só, mesmo sendo cadastros diferentes.
const PROFESSORS_GRID = '1.6fr .8fr 1.8fr 1fr 84px';
const PROFESSORS_COLUMNS = [
  { key: 'professor', label: 'Professor' },
  { key: 'aulas', label: 'Aulas' },
  { key: 'share', label: 'Participação' },
  { key: 'conversion', label: 'Matrícula' },
  { key: 'actions', label: '' }
];

const initialsOf = (name) => (name || '?')
  .trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const emptyForm = { name: '', email: '', authUid: '', password: '', shiftStart: '', shiftEnd: '', dailyVolumeTarget: '' };

const normalizeEmail = (v) => String(v || '').trim().toLowerCase();
const normalizeUid = (v) => String(v || '').trim();

// Senha temporária legível: sem caracteres ambíguos (0/O, 1/l).
const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const buf = new Uint32Array(12);
  window.crypto.getRandomValues(buf);
  return Array.from(buf, n => chars[n % chars.length]).join('');
};

function MemberAvatar({ name, size = 32 }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      className="rounded-full grid place-items-center font-bold shrink-0 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
    >
      {initialsOf(name)}
    </span>
  );
}

function SeatBand({ seats, consultantCount }) {
  if (!seats || seats.maxConsultants == null) return null;
  const used = Math.min(consultantCount, seats.maxConsultants);
  const extra = Math.max(0, consultantCount - seats.maxConsultants);
  const dashes = Array.from({ length: seats.maxConsultants }, (_, i) => i < used);

  return (
    <div className="flex items-center gap-3.5 px-[18px] py-3.5 rounded-[14px] bg-muted/60 border border-border">
      <span className="size-[34px] rounded-[10px] grid place-items-center shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <Shield size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">
          {seats.planName ? `Plano ${seats.planName} · ` : ''}{used} de {seats.maxConsultants} consultores inclusos
          {extra > 0 && ` · +${extra} extra${extra === 1 ? '' : 's'}`}
        </div>
        {seats.extraUserPrice != null && (
          <div className="text-[12px] text-muted-foreground mt-0.5">
            O {seats.maxConsultants + 1}º consultor entra como extra: +R$ {Number(seats.extraUserPrice).toLocaleString('pt-BR')}/mês, válido a partir da próxima fatura.
          </div>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-1 shrink-0">
        {dashes.map((on, i) => (
          <span key={i} className={cn('w-[26px] h-1.5 rounded-full', on ? 'bg-brand-600' : 'bg-border')} />
        ))}
      </div>
    </div>
  );
}

function ProfessorRow({ professor, modalities, aulas, share, conversion, last, onEdit, onDelete }) {
  const mods = professorModalityNames(professor, modalities);
  // Cor da primeira modalidade: identifica o professor no avatar e na barra,
  // como no card do handoff.
  const modality = (modalities || []).find(m => (professor.modalidadeIds || []).includes(m.id));
  const tone = settingsColorTone(modality?.color || 'slate');

  return (
    <div
      className={cn('grid gap-3 items-center px-5 py-3.5 transition hover:bg-muted/50', !last && 'border-b border-border')}
      style={{ gridTemplateColumns: PROFESSORS_GRID }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={cn(
          'size-8 rounded-full grid place-items-center text-[11px] font-bold shrink-0',
          tone.soft, tone.text, tone.darkSoft, tone.darkText
        )}>
          {initialsOf(professor.nome)}
        </span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold truncate">{professor.nome}</div>
          <div className="text-[11.5px] text-muted-foreground truncate">{mods.length ? mods.join(' · ') : 'Sem modalidade'}</div>
        </div>
      </div>

      <div className="text-[12.5px] font-semibold num">{aulas}</div>

      <div className="flex items-center">
        <div className="w-full h-[5px] rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full', tone.strong)} style={{ width: `${share}%` }} />
        </div>
      </div>

      <div className={cn('text-[12.5px] num', conversion == null && 'text-slate-400 dark:text-slate-500')}>
        {conversion == null ? 'sem aula' : `${conversion}%`}
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <RowAction icon={<Pencil size={13} />} title={`Editar ${professor.nome}`} onClick={onEdit} />
        <RowAction kind="danger" icon={<Trash2 size={13} />} title={`Excluir ${professor.nome}`} onClick={onDelete} />
      </div>
    </div>
  );
}

function TeamAccessSection({ db, appUser, usersList, leads, focusId, onFocusHandled }) {
  const toast = useToast();
  const { professores, modalities } = useGeneralConfig();
  const seats = useSeatLimits();

  const [memberDialog, setMemberDialog] = useState(null); // null | {mode:'create'|'edit', user}
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('consultant');
  const [inviteLink, setInviteLink] = useState('');
  const [inviting, setInviting] = useState(false);

  const [profDialog, setProfDialog] = useState(null); // null | {professor}
  const [profName, setProfName] = useState('');
  const [profMods, setProfMods] = useState([]);

  const rowRefs = useRef({});

  const users = useMemo(() => usersList || [], [usersList]);
  const consultantCount = users.filter(u => u.role !== 'admin').length;

  const openCreate = () => { setForm({ ...emptyForm, password: generatePassword() }); setMemberDialog({ mode: 'create' }); };
  const openEdit = (user) => {
    setForm({
      name: user.name || '',
      email: user.email || '',
      authUid: user.authUid || '',
      password: '',
      shiftStart: user.shiftStart || '',
      shiftEnd: user.shiftEnd || '',
      dailyVolumeTarget: user.dailyVolumeTarget != null ? String(user.dailyVolumeTarget) : ''
    });
    setMemberDialog({ mode: 'edit', user });
  };

  // Atalho da Visão geral: 'new' abre o cadastro, um id destaca a linha.
  useEffect(() => {
    if (!focusId) return;
    if (focusId === 'new') {
      setForm({ ...emptyForm, password: generatePassword() });
      setMemberDialog({ mode: 'create' });
      onFocusHandled?.();
      return;
    }
    rowRefs.current[focusId]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusId, onFocusHandled]);

  // Consultor EXTRA é cobrado além da mensalidade — nunca cobra sem avisar.
  const confirmExtra = (price) => window.confirm(
    `Os consultores inclusos no seu plano já foram usados.\n\nEste consultor entra como EXTRA: +R$ ${Number(price).toLocaleString('pt-BR')}/mês na mensalidade (vale a partir da próxima fatura).\n\nConfirmar?`
  );

  const authHeader = async () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
  });

  const createMember = async (allowExtra = false) => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.warning('Preencha nome, e-mail e senha temporária.');
      return;
    }
    if (!appUser?.authUid) { toast.error('Sessão sem authUid. Reentre no sistema.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/admin-create-user', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ name: form.name.trim(), email: normalizeEmail(form.email), password: form.password, allowExtra })
      });
      const data = await res.json();
      if (res.status === 409 && data?.requiresExtraConfirmation) {
        setSaving(false);
        if (confirmExtra(data.extraUserPrice)) return createMember(true);
        return;
      }
      if (!res.ok) { toast.error(data.error || 'Erro ao cadastrar consultor.'); return; }

      toast.success(`Consultor ${form.name.trim()} cadastrado. Senha temporária: ${form.password}`, { duration: 8000, title: 'Cadastrado com sucesso' });
      if (data.isExtra) toast.info('Este consultor entrou como extra — a mensalidade foi ajustada a partir da próxima fatura.', { duration: 8000 });
      setMemberDialog(null);
    } catch (err) {
      console.error(err);
      toast.error('Falha de rede ao cadastrar consultor.');
    } finally {
      setSaving(false);
    }
  };

  const updateMember = async () => {
    const target = memberDialog?.user;
    if (!target) return;
    setSaving(true);
    try {
      const newName = form.name.trim();
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, target.id), {
        name: newName,
        email: normalizeEmail(form.email),
        authUid: normalizeUid(form.authUid) || null,
        shiftStart: form.shiftStart || null,
        shiftEnd: form.shiftEnd || null,
        // Vazio ou 0 = sem meta de prospecção. Não existe padrão de academia:
        // o piso é 100% individual.
        dailyVolumeTarget: form.dailyVolumeTarget !== '' && Number(form.dailyVolumeTarget) > 0
          ? Math.min(500, Math.floor(Number(form.dailyVolumeTarget)))
          : deleteField(),
        password: deleteField()
      });

      // consultantName é desnormalizado nos leads (Kanban, Agendamentos, CSV,
      // ranking do Dashboard) — sem esta cascata tudo isso exibiria o nome
      // antigo. Busca direto no Firestore pra alcançar a base inteira.
      if (target.name !== newName) {
        const leadsSnap = await getDocs(query(
          collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
          where('consultantId', '==', target.id)
        ));
        if (!leadsSnap.empty) {
          await commitOpsInChunks(db, leadsSnap.docs.map(d => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, d.id),
            data: { consultantName: newName }
          })), 400);
        }
      }

      if (form.password.trim()) {
        const targetUid = normalizeUid(form.authUid) || target.authUid;
        if (!targetUid) {
          toast.error('Cadastro sem authUid. Não é possível redefinir senha.');
        } else {
          const res = await fetch('/api/admin-set-password', {
            method: 'POST',
            headers: await authHeader(),
            body: JSON.stringify({ targetAuthUid: targetUid, password: form.password })
          });
          const data = await res.json();
          if (!res.ok) { toast.error(data.error || 'Erro ao redefinir senha.'); return; }
          toast.success(`Senha redefinida. Nova senha: ${form.password}`, { duration: 8000 });
        }
      }

      toast.success('Cadastro atualizado.');
      setMemberDialog(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMember = async (user) => {
    if (user.role === 'admin') { toast.warning('O gestor não pode ser excluído por aqui.'); return; }
    if (!window.confirm(`Excluir o acesso de "${user.name}"?\n\nApaga a conta no Auth e o cadastro interno. Essa ação é irreversível.`)) return;
    if (!appUser?.authUid) { toast.error('Sessão sem authUid. Reentre no sistema.'); return; }
    try {
      const res = await fetch('/api/admin-delete-user', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ userDocId: user.id, targetAuthUid: user.authUid || null })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao excluir consultor.'); return; }
      toast.success('Acesso excluído.');
      setMemberDialog(null);
    } catch (err) {
      console.error(err);
      toast.error('Falha de rede ao excluir consultor.');
    }
  };

  const createInvite = async (allowExtra = false) => {
    const email = normalizeEmail(inviteEmail);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.warning('E-mail inválido.'); return; }
    setInviting(true);
    setInviteLink('');
    try {
      const res = await fetch('/api/invite-create', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ email, role: inviteRole, allowExtra })
      });
      const data = await res.json();
      if (res.status === 409 && data?.requiresExtraConfirmation) {
        setInviting(false);
        if (confirmExtra(data.extraUserPrice)) return createInvite(true);
        return;
      }
      if (!res.ok) { toast.error(data.error || 'Erro ao criar convite.'); return; }
      setInviteLink(`${window.location.origin}/?invite=${encodeURIComponent(data.token)}&t=${encodeURIComponent(data.tenantId)}`);
      toast.success('Convite criado. Copie o link e envie ao convidado.', { duration: 7000 });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar convite.');
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); toast.success('Link copiado!'); }
    catch { toast.info('Copie o link manualmente.'); }
  };

  // --- Professores ---------------------------------------------------------

  const professorStats = useMemo(() => {
    const rows = (professores || []).map(p => {
      const aulas = (leads || []).filter(l => l.appointmentProfessorId === p.id);
      const matriculas = aulas.filter(isClientLead).length;
      return {
        professor: p,
        aulas: aulas.length,
        conversion: aulas.length > 0 ? Math.round((matriculas / aulas.length) * 100) : null
      };
    });
    const max = rows.reduce((m, r) => Math.max(m, r.aulas), 0);
    return rows.map(r => ({ ...r, share: max > 0 ? Math.round((r.aulas / max) * 100) : 0 }));
  }, [professores, leads]);

  const openProfessor = (professor) => {
    setProfName(professor?.nome || '');
    setProfMods(professor?.modalidadeIds || []);
    setProfDialog({ professor: professor || null });
  };

  const saveProfessor = async () => {
    const trimmed = profName.trim();
    if (!trimmed) { toast.warning('Informe o nome do professor.'); return; }
    const editingId = profDialog?.professor?.id || null;
    const dup = (professores || []).some(p => p.id !== editingId && (p.nome || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) { toast.warning(`O professor "${trimmed}" já existe.`); return; }

    setSaving(true);
    try {
      if (editingId) {
        const old = profDialog.professor;
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH, editingId),
          { nome: trimmed, modalidadeIds: profMods, updatedAt: serverTimestamp() },
          { merge: true }
        );
        // Nome do professor é desnormalizado no lead (aparece na agenda e nos
        // relatórios de aula) — renomear tem que alcançar a base.
        if (old.nome !== trimmed) {
          const affected = (leads || []).filter(l => l.appointmentProfessorId === editingId);
          if (affected.length > 0) {
            await commitOpsInChunks(db, affected.map(l => ({
              ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, l.id),
              data: { appointmentProfessorName: trimmed }
            })), 400);
          }
        }
        toast.success('Professor atualizado.');
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH), {
          nome: trimmed, modalidadeIds: profMods, ativo: true,
          order: (professores || []).length, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        toast.success('Professor cadastrado.');
      }
      setProfDialog(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o professor.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProfessor = async (p) => {
    const inUse = (leads || []).filter(l => l.appointmentProfessorId === p.id).length;
    if (inUse > 0) {
      toast.warning(`"${p.nome}" está em ${inUse} ${inUse === 1 ? 'aula' : 'aulas'} já registradas. Não é possível excluí-lo.`);
      return;
    }
    if (!window.confirm(`Excluir o professor "${p.nome}"?`)) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH, p.id));
    toast.success('Professor excluído.');
  };

  const toggleProfMod = (id) => setProfMods(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Equipe & acessos"
        hint="Quem entra no app, com qual papel, turno e piso de prospecção."
      >
        <SettingsBtn size={38} icon={<Mail size={14} />} onClick={() => { setInviteOpen(true); setInviteLink(''); }}>
          Convidar por e-mail
        </SettingsBtn>
        <SettingsBtn kind="primary" size={38} icon={<Plus size={14} />} onClick={openCreate}>
          Cadastrar consultor
        </SettingsBtn>
      </SettingsSectionHeader>

      <SeatBand seats={seats} consultantCount={consultantCount} />

      <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <TableHeadRow columns={MEMBERS_COLUMNS} template={MEMBERS_GRID} />
        {users.length === 0 ? (
          <EmptyState>Nenhum membro cadastrado ainda — comece pelo botão “Cadastrar consultor”.</EmptyState>
        ) : users.map((u, i) => {
          const linked = Boolean(normalizeUid(u.authUid));
          const target = Number(u.dailyVolumeTarget) > 0 ? u.dailyVolumeTarget : null;
          return (
            <div
              key={u.id}
              ref={el => { rowRefs.current[u.id] = el; }}
              className={cn(
                'grid gap-3 items-center px-5 py-3.5 transition hover:bg-muted/50',
                i < users.length - 1 && 'border-b border-border',
                focusId === u.id && 'bg-brand-50/60 dark:bg-brand-500/10'
              )}
              style={{ gridTemplateColumns: MEMBERS_GRID }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <MemberAvatar name={u.name} />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">{u.name}</div>
                  <div className="text-[11.5px] text-muted-foreground truncate">{u.email}</div>
                </div>
              </div>

              <div>
                <span className={cn(
                  'inline-flex text-[11.5px] font-semibold px-2.5 py-1 rounded-[7px]',
                  u.role === 'admin'
                    ? 'bg-accent-500/[0.14] text-accent-600 dark:text-accent-400'
                    : 'bg-muted text-slate-600 dark:text-slate-300'
                )}>
                  {u.role === 'admin' ? 'Gestor' : 'Consultor'}
                </span>
              </div>

              <div className="text-[12.5px] text-slate-700 dark:text-slate-200 num">
                {u.shiftStart && u.shiftEnd ? `${u.shiftStart}–${u.shiftEnd}` : '—'}
              </div>

              <div className={cn('text-[12.5px] num', target ? 'font-semibold' : 'text-slate-400 dark:text-slate-500')}>
                {target ? `${target}/dia` : 'sem meta'}
              </div>

              <div className="flex items-center gap-2">
                <span className={cn('size-[7px] rounded-full shrink-0', linked ? 'bg-emerald-500' : 'bg-amber-500')} />
                <span className={cn('text-[12px] font-semibold', linked ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                  {linked ? 'Vinculado' : 'Sem vínculo'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-1.5">
                <RowAction icon={<Pencil size={13} />} title="Editar membro" onClick={() => openEdit(u)} />
                {u.role !== 'admin' && (
                  <RowAction kind="danger" icon={<Trash2 size={13} />} title="Excluir acesso" onClick={() => deleteMember(u)} />
                )}
              </div>
            </div>
          );
        })}
      </section>

      <SettingsPanel
        icon={<Dumbbell size={16} />}
        title="Professores"
        hint="Quem conduz aulas experimentais — não têm login no app."
        action={
          <SettingsBtn kind="primary" size={38} icon={<Plus size={14} />} onClick={() => openProfessor(null)}>
            Cadastrar professor
          </SettingsBtn>
        }
      >
        <TableHeadRow columns={PROFESSORS_COLUMNS} template={PROFESSORS_GRID} />
        {professorStats.length === 0 ? (
          <EmptyState>Nenhum professor cadastrado — quem conduzir a aula experimental aparece aqui.</EmptyState>
        ) : professorStats.map(({ professor, aulas, share, conversion }, i) => (
          <ProfessorRow
            key={professor.id}
            professor={professor}
            modalities={modalities}
            aulas={aulas}
            share={share}
            conversion={conversion}
            last={i === professorStats.length - 1}
            onEdit={() => openProfessor(professor)}
            onDelete={() => deleteProfessor(professor)}
          />
        ))}
      </SettingsPanel>

      {/* Cadastro / edição de membro */}
      <FormDialog
        open={Boolean(memberDialog)}
        onOpenChange={(v) => !v && setMemberDialog(null)}
        title={memberDialog?.mode === 'edit' ? `Editar ${memberDialog.user.name}` : 'Cadastrar consultor'}
        description={memberDialog?.mode === 'edit'
          ? 'O authUid é gerado no cadastro e não muda. Preencha a nova senha só se quiser redefini-la.'
          : 'Cria a conta no Firebase Auth e o cadastro interno numa operação só. Anote a senha temporária para entregar ao consultor.'}
        submitLabel={memberDialog?.mode === 'edit' ? 'Salvar alterações' : 'Cadastrar'}
        submitting={saving}
        onSubmit={() => (memberDialog?.mode === 'edit' ? updateMember() : createMember())}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DialogField label="Nome">
            <input className={FIELD_INPUT} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Ana Duarte" required />
          </DialogField>
          <DialogField label="E-mail de login">
            <input className={FIELD_INPUT} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ana@academia.com.br" required />
          </DialogField>
        </div>

        <DialogField
          label={memberDialog?.mode === 'edit' ? 'Nova senha (opcional)' : 'Senha temporária'}
          hint={memberDialog?.mode === 'edit' ? 'Em branco mantém a senha atual.' : 'Mínimo de 6 caracteres.'}
        >
          <div className="flex gap-2">
            <input
              className={FIELD_INPUT}
              type="text"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder={memberDialog?.mode === 'edit' ? 'Deixe em branco para não alterar' : 'Mín. 6 caracteres'}
              required={memberDialog?.mode === 'create'}
            />
            <SettingsBtn size={36} type="button" onClick={() => setForm({ ...form, password: generatePassword() })}>Gerar</SettingsBtn>
          </div>
        </DialogField>

        <div className="grid gap-4 sm:grid-cols-2">
          <DialogField label="Início do turno">
            <input className={FIELD_INPUT} type="time" value={form.shiftStart} onChange={e => setForm({ ...form, shiftStart: e.target.value })} />
          </DialogField>
          <DialogField label="Fim do turno">
            <input className={FIELD_INPUT} type="time" value={form.shiftEnd} onChange={e => setForm({ ...form, shiftEnd: e.target.value })} />
          </DialogField>
        </div>

        {memberDialog?.mode === 'edit' && (
          <DialogField label="Meta de prospecção (ações/dia)" hint="0 ou vazio desabilita a prospecção da pessoa.">
            <input
              className={cn(FIELD_INPUT, 'num')}
              type="number" min="0" max="500" placeholder="off"
              value={form.dailyVolumeTarget}
              onChange={e => setForm({ ...form, dailyVolumeTarget: e.target.value })}
            />
          </DialogField>
        )}
      </FormDialog>

      {/* Convite por e-mail */}
      <FormDialog
        open={inviteOpen}
        onOpenChange={(v) => { setInviteOpen(v); if (!v) { setInviteEmail(''); setInviteLink(''); } }}
        title="Convidar por e-mail"
        description="O convidado define a própria senha pelo link. Envie o link gerado por e-mail ou WhatsApp — validade de 7 dias."
        submitLabel={inviting ? 'Gerando…' : 'Gerar convite'}
        submitting={inviting}
        onSubmit={() => createInvite()}
      >
        <DialogField label="E-mail do convidado">
          <input className={FIELD_INPUT} type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@convidado.com" required />
        </DialogField>
        <DialogField label="Papel">
          <select className={FIELD_INPUT} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
            <option value="consultant">Consultor</option>
            <option value="admin">Gestor (admin)</option>
          </select>
        </DialogField>
        {inviteLink && (
          <div className="flex items-center gap-2 p-2.5 rounded-[10px] bg-muted/60 border border-border">
            <span className="flex-1 text-[12px] text-muted-foreground truncate num">{inviteLink}</span>
            <SettingsBtn size={34} type="button" icon={<Copy size={13} />} onClick={copyInviteLink}>Copiar</SettingsBtn>
          </div>
        )}
      </FormDialog>

      {/* Professor */}
      <FormDialog
        open={Boolean(profDialog)}
        onOpenChange={(v) => !v && setProfDialog(null)}
        title={profDialog?.professor ? `Editar ${profDialog.professor.nome}` : 'Novo professor'}
        description="Professores aparecem na lista ao agendar uma aula experimental. Não têm login no app."
        submitLabel={profDialog?.professor ? 'Salvar' : 'Cadastrar professor'}
        submitting={saving}
        onSubmit={saveProfessor}
      >
        <DialogField label="Nome">
          <input className={FIELD_INPUT} value={profName} onChange={e => setProfName(e.target.value)} placeholder="Ex: Rafael Menezes" required />
        </DialogField>
        <DialogField label="Modalidades em que atua">
          {(modalities || []).length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Nenhuma modalidade cadastrada — adicione em Agendamento.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(modalities || []).map(m => {
                const on = profMods.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleProfMod(m.id)}
                    aria-pressed={on}
                    className={cn(
                      'px-3 h-9 rounded-[10px] text-[12.5px] font-semibold transition border',
                      on ? 'bg-brand-600 text-white border-brand-600' : 'bg-card text-muted-foreground border-border hover:bg-muted'
                    )}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          )}
        </DialogField>
      </FormDialog>
    </div>
  );
}

export { TeamAccessSection };
