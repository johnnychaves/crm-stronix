import { useState, useEffect } from 'react';
import { AlertCircle, Clock, Kanban, Mail, Pencil, Plus, Shield, Trash2, Users } from 'lucide-react';
import { collection, doc, getDocs, onSnapshot, query, where, updateDoc, deleteField } from 'firebase/firestore';
import { auth, appId, LEADS_PATH, USERS_PATH } from '../../lib/firebase.js';
import { commitOpsInChunks } from '../../lib/funnels.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Btn } from '../../components/ui/Btn.jsx';
import { SettingsCard } from '../../components/ui/SettingsCard.jsx';
import { StyledSelect } from '../../components/ui/Field.jsx';

function ManageUsersTab({ db, appUser }) {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', authUid: '', password: '', shiftStart: '', shiftEnd: '' });
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  // Convite por e-mail (alternativa ao cadastro direto: o convidado define a
  // própria senha via link /?invite=token&t=tenant).
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('consultant');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const createInvite = async (e) => {
    e.preventDefault();
    if (inviteLoading) return;
    const email = String(inviteEmail || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.warning('E-mail inválido.'); return; }
    setInviteLoading(true);
    setInviteLink('');
    try {
      const res = await fetch('/api/invite-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
        body: JSON.stringify({ email, role: inviteRole })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao criar convite.'); setInviteLoading(false); return; }
      const link = `${window.location.origin}/?invite=${encodeURIComponent(data.token)}&t=${encodeURIComponent(data.tenantId)}`;
      setInviteLink(link);
      toast.success('Convite criado. Copie o link e envie ao convidado.', { duration: 7000 });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar convite.');
    }
    setInviteLoading(false);
  };

  const copyInviteLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); toast.success('Link copiado!'); }
    catch { toast.info('Copie o link manualmente.'); }
  };

  useEffect(() => {
    return onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', USERS_PATH),
      snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [db]);

  const resetForm = () => {
    setForm({ name: '', email: '', authUid: '', password: '', shiftStart: '', shiftEnd: '' });
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const buf = new Uint32Array(12);
    window.crypto.getRandomValues(buf);
    return Array.from(buf, n => chars[n % chars.length]).join('');
  };

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const normalizeUid = (value) => String(value || '').trim();

  const isAuthLinked = (user) => Boolean(normalizeUid(user?.authUid));
  const shortUid = (uid) => {
    const raw = normalizeUid(uid);
    if (!raw) return 'Sem vínculo';
    if (raw.length <= 14) return raw;
    return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
  };

  const openNewForm = () => {
    setEditingUser(null);
    resetForm();
    setShowAdd(true);
  };

  const handleToggleAddEdit = () => {
    if (showAdd || editingUser) {
      setEditingUser(null);
      setShowAdd(false);
      resetForm();
    } else {
      openNewForm();
    }
  };

  const openEditForm = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name || '',
      email: user.email || '',
      authUid: user.authUid || '',
      password: '',
      shiftStart: user.shiftStart || '',
      shiftEnd: user.shiftEnd || ''
    });
    setShowAdd(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.warning('Preencha nome, e-mail e senha temporária.');
      return;
    }
    if (!appUser?.authUid) {
      toast.error('Sessão sem authUid. Reentre no sistema.');
      return;
    }

    setLoadingSubmit(true);
    try {
      const res = await fetch('/api/admin-create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: normalizeEmail(form.email),
          password: form.password
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao cadastrar consultor.');
        return;
      }

      toast.success(`Consultor ${form.name.trim()} cadastrado. Senha temporária: ${form.password}`, { duration: 8000, title: 'Cadastrado com sucesso' });
      resetForm();
      setShowAdd(false);
    } catch (err) {
      console.error(err);
      toast.error('Falha de rede ao cadastrar consultor.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  const update = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setLoadingSubmit(true);
    try {
      const newName = form.name.trim();
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, editingUser.id),
        {
          name: newName,
          email: normalizeEmail(form.email),
          authUid: normalizeUid(form.authUid) || null,
          shiftStart: form.shiftStart || null,
          shiftEnd: form.shiftEnd || null,
          password: deleteField()
        }
      );

      // Propaga a renomeação para a base do consultor. consultantName é
      // desnormalizado nos leads (aparece no Kanban, Agendamentos, lista de
      // Leads, CSV e ranking do Dashboard); sem isso, renomear o consultor
      // deixava todos esses lugares exibindo o nome antigo. Busca direto no
      // Firestore (não só os leads em memória) pra alcançar a base inteira.
      if (editingUser.name !== newName) {
        const leadsSnap = await getDocs(query(
          collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH),
          where('consultantId', '==', editingUser.id)
        ));
        if (!leadsSnap.empty) {
          const ops = leadsSnap.docs.map(d => ({
            ref: doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, d.id),
            data: { consultantName: newName }
          }));
          await commitOpsInChunks(db, ops, 400);
        }
      }

      if (form.password.trim()) {
        const targetUid = normalizeUid(form.authUid) || editingUser.authUid;
        if (!targetUid) {
          toast.error('Cadastro sem authUid. Não é possível redefinir senha.');
        } else {
          const res = await fetch('/api/admin-set-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
            },
            body: JSON.stringify({
              targetAuthUid: targetUid,
              password: form.password
            })
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error || 'Erro ao redefinir senha.');
            return;
          }
          toast.success(`Senha redefinida. Nova senha: ${form.password}`, { duration: 8000 });
        }
      }

      setEditingUser(null);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar alterações.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  const delUser = async (user) => {
    const target = typeof user === 'object' ? user : (users || []).find(u => u.id === user);
    if (!target) return;
    if (!window.confirm("⚠️ EXCLUIR ACESSO? Apaga a conta no Auth e o cadastro interno. Essa ação é irreversível.")) return;
    if (!appUser?.authUid) {
      toast.error('Sessão sem authUid. Reentre no sistema.');
      return;
    }

    try {
      const res = await fetch('/api/admin-delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          userDocId: target.id,
          targetAuthUid: target.authUid || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao excluir consultor.');
        return;
      }
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      toast.error('Falha de rede ao excluir consultor.');
    }
  };

  return (
    <SettingsCard
      title="Consultores"
      hint="Cadastre e gerencie quem tem acesso ao CRM"
      icon={<Users size={16} />}
      action={
        <div className="flex items-center gap-2">
          <Btn
            kind={inviteOpen ? 'soft' : 'secondary'}
            icon={inviteOpen ? <X size={13} /> : <Mail size={13} />}
            onClick={() => { setInviteOpen(o => !o); setInviteLink(''); }}
          >
            {inviteOpen ? 'Fechar' : 'Convidar'}
          </Btn>
          <Btn
            kind={showAdd || editingUser ? 'soft' : 'brand'}
            icon={showAdd || editingUser ? <X size={13} /> : <Plus size={13} />}
            onClick={handleToggleAddEdit}
          >
            {showAdd || editingUser ? 'Cancelar' : 'Novo consultor'}
          </Btn>
        </div>
      }
    >
      {inviteOpen && (
        <div className="mb-8 p-5 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] animate-fade-in">
          <h4 className="text-[13px] font-bold text-gray-900 dark:text-white">Convidar por e-mail</h4>
          <p className="text-[11.5px] text-gray-500 dark:text-neutral-400 mt-0.5 mb-4">
            O convidado define a própria senha pelo link. Envie o link gerado por e-mail/WhatsApp (validade: 7 dias).
          </p>
          <form onSubmit={createInvite} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@convidado.com" required
              className="flex-1 h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-[13px] px-3 placeholder:text-slate-400 transition"
            />
            <StyledSelect value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="sm:w-44">
              <option value="consultant">Consultor</option>
              <option value="admin">Admin</option>
            </StyledSelect>
            <Btn kind="brand" type="submit" icon={<Mail size={13} />} disabled={inviteLoading}>
              {inviteLoading ? 'Gerando...' : 'Gerar convite'}
            </Btn>
          </form>
          {inviteLink && (
            <div className="mt-4 flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]">
              <span className="flex-1 text-[12px] text-slate-600 dark:text-slate-300 truncate num">{inviteLink}</span>
              <button type="button" onClick={copyInviteLink} className="shrink-0 text-[11.5px] font-semibold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 transition">
                Copiar
              </button>
            </div>
          )}
        </div>
      )}
      {(showAdd || editingUser) && (
        <form
          onSubmit={editingUser ? update : add}
          className="bg-white dark:bg-neutral-900/80 p-8 rounded-[2.5rem] border border-brand-100 dark:border-brand-800/30 animate-fade-in mb-10 space-y-8 shadow-2xl relative overflow-hidden"
        >
          
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-neutral-800 pb-5 mb-4">
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">
                {editingUser ? `Editando: ${editingUser.name}` : 'Novo Cadastro'}
              </h4>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest mt-1">
                {editingUser ? 'Atualize as informações do consultor' : 'Preencha os dados do novo membro da equipe'}
              </p>
            </div>

            {editingUser && editingUser.role !== 'admin' && (
              <button
                type="button"
                onClick={() => delUser(editingUser.id)}
                className="text-[10px] font-bold text-red-500 flex items-center gap-2 hover:text-red-600 transition-colors uppercase tracking-widest bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 px-4 py-2.5 rounded-xl active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                Nome do Consultor
              </label>
              <input
                placeholder="Ex: Maria Vendas"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                E-mail de Login
              </label>
              <input
                type="email"
                placeholder="maria@stronilead.com.br"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                {editingUser ? 'Auth UID' : 'Senha temporária'}
              </label>
              {editingUser ? (
                <input
                  type="text"
                  placeholder="Auth UID (somente leitura)"
                  value={form.authUid}
                  readOnly
                  className="w-full bg-gray-100/50 dark:bg-neutral-900/50 px-5 py-4 rounded-2xl text-gray-400 dark:text-neutral-600 outline-none border border-transparent text-xs font-bold cursor-not-allowed"
                />
              ) : (
                <div className="flex gap-2 relative">
                  <input
                    type="text"
                    placeholder="Mín. 6 caracteres"
                    required
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="flex-1 bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, password: generatePassword() })}
                    className="absolute right-2 top-2 bottom-2 bg-brand-600 hover:bg-brand-700 text-white px-4 rounded-xl text-[9px] font-bold shadow-md active:scale-95 transition-all uppercase tracking-widest"
                  >
                    Gerar
                  </button>
                </div>
              )}
            </div>
          </div>

          {editingUser && (
            <div className="space-y-2 max-w-sm">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                Nova senha (opcional)
              </label>
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  placeholder="Deixe em branco para não alterar"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="flex-1 bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm pr-20"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, password: generatePassword() })}
                  className="absolute right-2 top-2 bottom-2 bg-brand-600 hover:bg-brand-700 text-white px-4 rounded-xl text-[9px] font-bold shadow-md active:scale-95 transition-all uppercase tracking-widest"
                >
                  Gerar
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                Início do Turno
              </label>
              <input
                type="time"
                value={form.shiftStart}
                onChange={e => setForm({ ...form, shiftStart: e.target.value })}
                className="w-full bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest block">
                Fim do Turno
              </label>
              <input
                type="time"
                value={form.shiftEnd}
                onChange={e => setForm({ ...form, shiftEnd: e.target.value })}
                className="w-full bg-gray-50 dark:bg-neutral-950 px-5 py-4 rounded-2xl text-gray-900 dark:text-white outline-none border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-neutral-900 transition-all text-xs font-bold shadow-sm"
              />
            </div>
          </div>

          <div className="bg-brand-50/50 dark:bg-brand-800/10 border border-brand-100 dark:border-brand-800/30 rounded-2xl p-5 mt-4">
            <p className="text-[10px] font-bold text-brand-500 dark:text-brand-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
               <AlertCircle className="w-3.5 h-3.5" /> Observação operacional
            </p>
            <p className="text-xs text-gray-600 dark:text-neutral-400 font-medium leading-relaxed">
              {editingUser
                ? <>Para redefinir a senha, preencha o campo opcional. O <span className="text-gray-900 dark:text-white font-bold">authUid</span> é gerado automaticamente no cadastro e não pode ser alterado.</>
                : <>O cadastro cria a conta no Firebase Auth e o registro interno em uma única operação. Anote a senha temporária para entregar ao consultor.</>
              }
            </p>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleToggleAddEdit}
              className="flex-1 py-4 bg-gray-100 dark:bg-neutral-800 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-600 dark:text-neutral-300"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loadingSubmit}
              className="flex-[2] bg-brand-600 hover:bg-brand-700 text-white py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-brand-600/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {loadingSubmit ? 'PROCESSANDO...' : editingUser ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR NOVO'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(users || []).map(u => (
          <div
            key={u.id}
            className="group relative bg-white dark:bg-neutral-900 p-6 rounded-[2rem] border border-gray-100 dark:border-neutral-800 hover:border-brand-100 dark:hover:border-brand-800/50 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300 flex flex-col"
          >
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md p-1 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
              <button
                onClick={() => openEditForm(u)}
                className="p-2 text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-800/20 rounded-lg transition-colors"
                title="Editar"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              {u.role !== 'admin' && (
                <button
                  onClick={() => delUser(u.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-col items-center text-center mb-4 mt-2">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-full flex items-center justify-center font-bold text-2xl shadow-lg shadow-brand-500/20 mb-3 relative">
                {(u.name || 'C')[0]}
                {u.role === 'admin' && (
                  <div className="absolute -bottom-1 -right-1 bg-white dark:bg-neutral-900 rounded-full p-1 shadow-sm">
                    <Shield className="w-3.5 h-3.5 text-brand-500" />
                  </div>
                )}
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                {u.name}
              </h4>
              <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-medium mt-1 truncate w-full px-4">
                {u.email}
              </p>
            </div>

            <div className="mt-auto space-y-2 pt-4 border-t border-gray-50 dark:border-neutral-800/50">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Status Auth</span>
                <span
                  className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${
                    isAuthLinked(u)
                      ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                      : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                  }`}
                >
                  {isAuthLinked(u) ? 'Vinculado' : 'Sem vínculo'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">UID</span>
                <span className="text-[10px] font-medium text-gray-600 dark:text-neutral-400 font-mono">
                  {shortUid(u.authUid)}
                </span>
              </div>

              {(u.shiftStart && u.shiftEnd) && (
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Turno</span>
                  <span className="px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {u.shiftStart} - {u.shiftEnd}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

export { ManageUsersTab };
