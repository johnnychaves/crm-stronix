import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Copy, Mail, Plus, Shield } from 'lucide-react';
import { collection, doc, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, appId, EQUIPE_PATH, PROFESSORS_PATH } from '../../lib/firebase.js';
import { leadsWhere } from '../../lib/settingsLeads.js';
import { generateTemporaryPassword, passwordPolicyError, PASSWORD_RULE_TEXT } from '../../lib/passwordPolicy.js';
import { isGestor, isProfessor, roleOf, ROLES } from '../../lib/acesso.js';
import { hasModule, MODULES } from '../../lib/modules.js';
import { availableProfessors, inviteRoleOptions, PROFESSOR_LINK_MESSAGES } from '../../lib/teamRoles.js';
import { montarEquipe } from '../../lib/equipe/equipe.js';
import { hrefFor } from '../../lib/routes.js';
import { screenParamsQuery } from '../../lib/screenParams.js';
import { cn } from '../../lib/utils.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useSeatLimits } from '../../hooks/useSeatLimits.js';
import { useEquipeFichas } from '../../hooks/useEquipeFichas.js';
import { useMinuteClock } from '../../hooks/useMinuteClock.js';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { SettingsSectionHeader } from '../../components/ui/SettingsCard.jsx';
import { DialogField, FIELD_INPUT, FormDialog, SettingsBtn } from './settingsBits.jsx';
import { EditarAcessoDialog } from './equipe/EditarAcessoDialog.jsx';
import { ProfessorPicker } from './equipe/ProfessorPicker.jsx';
import { EquipeLista } from './equipe/EquipeLista.jsx';
import { EquipeFicha } from './equipe/EquipeFicha.jsx';

// Equipe & acessos: a lista de pessoas e a ficha de cada uma (endereço
// /configuracoes/equipe[/<id>[/<aba>]]). Com o módulo Professor e faltosos
// ligado (appUser.tenantModules), o professor do cadastro pode ganhar login
// com o papel Professor (src/lib/teamRoles.js).
//
// Os caminhos de escrita são os mesmos de antes do redesign (/api/admin-*,
// /api/invite-create e o doc do usuário): mudou a casca, não a regra. O papel
// e o professor ligado só mudam pelo servidor (set-role), nunca pelo cliente.

const emptyForm = {
  name: '', email: '', password: '', shiftStart: '', shiftEnd: '', dailyVolumeTarget: '',
  role: ROLES.CONSULTOR, professorId: ''
};

const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

// A faixa das vagas de consultor do plano, mais a linha dos professores com
// acesso, que não ocupam vaga. As vagas só aparecem com o limite de consultor
// do plano (sem limite, ou com a /api/asaas fora do ar, o useSeatLimits não
// traz). A linha dos professores não depende do plano: com professor e sem
// limite, a faixa mostra só ela. Sem professor e sem limite, não há faixa.
function SeatBand({ seats, consultantCount, professorCount = 0 }) {
  const limited = seats != null && seats.maxConsultants != null;
  if (!limited && professorCount === 0) return null;
  const used = limited ? Math.min(consultantCount, seats.maxConsultants) : 0;
  const extra = limited ? Math.max(0, consultantCount - seats.maxConsultants) : 0;
  const dashes = limited ? Array.from({ length: seats.maxConsultants }, (_, i) => i < used) : [];
  const professorLine = professorCount > 0
    ? `${professorCount === 1 ? '1 professor com acesso' : `${professorCount} professores com acesso`}, fora das vagas de consultor.`
    : null;

  return (
    <div className="flex items-center gap-3.5 px-[18px] py-3.5 rounded-[14px] bg-muted/60 border border-border">
      <span className="size-[34px] rounded-[10px] grid place-items-center shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <Shield size={16} />
      </span>
      <div className="min-w-0 flex-1">
        {limited && (
          <div className="text-[13px] font-semibold">
            {seats.planName ? `Plano ${seats.planName} · ` : ''}{used} de {seats.maxConsultants} consultores inclusos
            {extra > 0 && ` · +${extra} extra${extra === 1 ? '' : 's'}`}
          </div>
        )}
        {limited && seats.extraUserPrice != null && (
          <div className="text-[12px] text-muted-foreground mt-0.5">
            O {seats.maxConsultants + 1}º consultor entra como extra: +R$ {Number(seats.extraUserPrice).toLocaleString('pt-BR')}/mês, válido a partir da próxima fatura.
          </div>
        )}
        {professorLine && (
          <div className={cn(limited ? 'text-[12px] text-muted-foreground mt-0.5' : 'text-[13px] font-semibold')}>
            {professorLine}
          </div>
        )}
      </div>
      {limited && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {dashes.map((on, i) => (
            <span key={i} className={cn('w-[26px] h-1.5 rounded-full', on ? 'bg-brand-600' : 'bg-border')} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamAccessSection({ db, appUser, usersList, leads, focusId, onFocusHandled, onLeadsChanged, listenersActive = true, pessoaId = null, pessoaAba = null }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { professores, modalities } = useGeneralConfig();
  const seats = useSeatLimits();
  const { tenantId } = appUser || {};
  // Módulos da academia, lidos no login e guardados no appUser
  // (src/lib/modules.js). Sem o Professor e faltosos, a tela fica como sempre.
  const tenantModules = appUser?.tenantModules;
  const professorEnabled = hasModule(tenantModules, MODULES.FALTOSOS);

  const [memberDialog, setMemberDialog] = useState(null); // null | {mode:'create', papelFixo?}
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editandoAcesso, setEditandoAcesso] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(ROLES.CONSULTOR);
  const [inviteProfessorId, setInviteProfessorId] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviting, setInviting] = useState(false);

  const [profOpen, setProfOpen] = useState(false);
  const [profName, setProfName] = useState('');
  const [profMods, setProfMods] = useState([]);
  const [busca, setBusca] = useState('');
  const topoRef = useRef(null);

  const users = useMemo(() => usersList || [], [usersList]);
  const { fichas, pronto, erro } = useEquipeFichas({ db, enabled: listenersActive, tenantId });
  const agora = useMinuteClock();
  const pessoas = useMemo(() => montarEquipe({ fichas, users, professores, agora }), [fichas, users, professores, agora]);
  const ctxFiltros = useMemo(() => ({}), []);
  const [filtros, setFiltros] = useScreenParams('settings', ctxFiltros);
  // Os filtros da lista vão junto para a ficha e voltam com ela.
  const qFiltros = screenParamsQuery('settings', filtros, ctxFiltros);
  const listaHref = hrefFor(tenantId, 'settings', { sub: 'team' }) + qFiltros;
  const hrefDe = (id, aba) => hrefFor(tenantId, 'settings', { sub: 'team', pessoaId: id, pessoaAba: aba }) + qFiltros;
  // O id da pessoa muda quando ela ganha login ou ficha (do professor para o
  // login, do login para a ficha): o endereço antigo continua achando a pessoa.
  const acharPessoa = (id) => pessoas.find((p) => p.id === id)
    ?? pessoas.find((p) => p.professor?.id === id || p.user?.id === id) ?? null;
  const pessoa = pessoaId ? acharPessoa(pessoaId) : null;

  // Só consultor ocupa vaga de consultor do plano: o gestor tem a vaga dele e
  // o professor não ocupa nenhuma (a mesma conta do api/_plans.js).
  const consultantCount = users.filter(u => roleOf(u) === ROLES.CONSULTOR).length;
  const professorCount = users.filter(u => isProfessor(u)).length;
  const createLabel = professorEnabled ? 'Cadastrar pessoa' : 'Cadastrar consultor';

  // No cadastro, o papel aparece com o módulo ligado.
  const showRoleField = professorEnabled;
  const creatingProfessor = memberDialog?.mode === 'create' && form.role === ROLES.PROFESSOR;
  const memberProfessorOptions = availableProfessors(professores, users);
  const inviteProfessorOptions = availableProfessors(professores, users);

  // Abrir a ficha não remonta a tela (a chave continua `settings`): a rolagem
  // ficaria onde a lista estava. Só mexe no DOM.
  useEffect(() => {
    if (pessoaId) topoRef.current?.scrollIntoView?.({ block: 'start' });
  }, [pessoaId]);

  // O link clicado some com a troca de tela: o foco vai ao título da ficha e,
  // na volta, ao link da pessoa de onde veio (ou à busca, se ela saiu da lista).
  const pessoaAnterior = useRef(pessoaId);
  useEffect(() => {
    const de = pessoaAnterior.current;
    pessoaAnterior.current = pessoaId;
    const topo = topoRef.current;
    if (de === pessoaId || !topo) return;
    if (pessoaId) {
      (topo.querySelector('h1') || topo.querySelector('a'))?.focus({ preventScroll: true });
      return;
    }
    const link = [...topo.querySelectorAll('a[href]')].find((a) => new URL(a.href, window.location.href).pathname.endsWith(`/equipe/${de}`));
    (link || topo.querySelector('input'))?.focus({ preventScroll: true });
  }, [pessoaId]);

  // Abrir o cadastro já preenchido (o "Dar acesso" da ficha).
  // papelFixo: o "Dar acesso" da ficha não deixa trocar o papel nem o
  // professor, porque o login novo só se liga à ficha pelo professor dela.
  const openCreate = (inicio = {}, { papelFixo = false } = {}) => {
    setForm({ ...emptyForm, ...inicio, password: generateTemporaryPassword() });
    setMemberDialog({ mode: 'create', papelFixo });
  };

  // Atalho da Visão geral: 'new' abre o cadastro; o id de um login sem acesso
  // vinculado abre a ficha dessa pessoa em Acesso ao app.
  useEffect(() => {
    if (!focusId) return;
    onFocusHandled?.();
    if (focusId === 'new') {
      setForm({ ...emptyForm, password: generateTemporaryPassword() });
      setMemberDialog({ mode: 'create' });
      return;
    }
    navigate(hrefFor(tenantId, 'settings', { sub: 'team', pessoaId: focusId, pessoaAba: 'acesso' }), { replace: true, state: location.state });
  }, [focusId, onFocusHandled, navigate, tenantId, location.state]);

  // Consultor extra é cobrado além da mensalidade: nunca cobra sem avisar.
  const confirmExtra = (price) => window.confirm(
    `Os consultores inclusos no seu plano já foram usados.\n\nEste consultor entra como extra: +R$ ${Number(price).toLocaleString('pt-BR')}/mês na mensalidade (vale a partir da próxima fatura).\n\nConfirmar?`
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
    const passwordProblem = passwordPolicyError(form.password);
    if (passwordProblem) { toast.warning(passwordProblem); return; }
    // Professor nasce ligado a um professor do cadastro. O servidor confere de
    // novo: módulo ligado, professor ativo e sem outro login.
    const asProfessor = form.role === ROLES.PROFESSOR;
    if (asProfessor && !form.professorId) { toast.warning(PROFESSOR_LINK_MESSAGES.missing); return; }
    const noun = asProfessor ? 'professor' : 'consultor';
    if (!appUser?.authUid) { toast.error('Sessão sem authUid. Reentre no sistema.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({
          action: 'create', name: form.name.trim(), email: normalizeEmail(form.email), password: form.password, allowExtra,
          ...(asProfessor ? { role: ROLES.PROFESSOR, professorId: form.professorId } : {})
        })
      });
      const data = await res.json();
      if (res.status === 409 && data?.requiresExtraConfirmation) {
        setSaving(false);
        if (confirmExtra(data.extraUserPrice)) return createMember(true);
        return;
      }
      if (!res.ok) { toast.error(data.error || `Erro ao cadastrar ${noun}.`); return; }

      // O consultor recebe a frase de sempre, para nada mudar na academia sem
      // o módulo Professor e faltosos.
      const created = asProfessor
        ? `Acesso de professor criado para ${form.name.trim()}. Senha temporária: ${form.password}`
        : `Consultor ${form.name.trim()} cadastrado. Senha temporária: ${form.password}`;
      toast.success(created, { duration: 8000, title: 'Cadastrado com sucesso' });
      if (data.isExtra) toast.info('Este consultor entrou como extra. A mensalidade foi ajustada a partir da próxima fatura.', { duration: 8000 });
      setMemberDialog(null);
    } catch (err) {
      console.error(err);
      toast.error(`Falha de rede ao cadastrar ${noun}.`);
    } finally {
      setSaving(false);
    }
  };

  const deleteMember = async (pessoa) => {
    const user = pessoa.user;
    if (isGestor(user)) { toast.warning('O gestor não pode ser excluído por aqui.'); return; }
    if (!window.confirm(`Tirar o acesso de "${user.name}"?\n\nA conta de login é apagada e não dá para desfazer.`)) return;
    if (!appUser?.authUid) { toast.error('Sessão sem authUid. Reentre no sistema.'); return; }
    try {
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ action: 'delete', userDocId: user.id, targetAuthUid: user.authUid || null })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Não deu para tirar o acesso.'); return; }
      toast.success('Acesso removido.');
      setMemberDialog(null);
      // O botão some com o login: o foco fica no bloco Acesso ao app.
      if (pessoa.ficha) topoRef.current?.querySelector('section[aria-label="Acesso ao app"]')?.focus();
      // Sem ficha, o id da pessoa era o do login, que deixou de existir: o
      // professor continua na equipe pelo cadastro dele, o consultor sai.
      if (!pessoa.ficha) {
        const destino = pessoa.professor ? hrefDe(pessoa.professor.id, 'acesso') : listaHref;
        navigate(destino, { replace: true, state: location.state });
      }
    } catch (err) {
      console.error(err);
      toast.error('Falha de rede ao tirar o acesso.');
    }
  };

  const createInvite = async (allowExtra = false) => {
    const email = normalizeEmail(inviteEmail);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.warning('E-mail inválido.'); return; }
    const asProfessor = inviteRole === ROLES.PROFESSOR;
    if (asProfessor && !inviteProfessorId) { toast.warning(PROFESSOR_LINK_MESSAGES.missing); return; }
    setInviting(true);
    setInviteLink('');
    try {
      const res = await fetch('/api/invite-create', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ email, role: inviteRole, allowExtra, ...(asProfessor ? { professorId: inviteProfessorId } : {}) })
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

  const saveProfessor = async () => {
    const trimmed = profName.trim();
    if (!trimmed) { toast.warning('Informe o nome do professor.'); return; }
    const dup = (professores || []).some(p => (p.nome || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) { toast.warning(`O professor "${trimmed}" já existe.`); return; }

    setSaving(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH), {
        nome: trimmed, modalidadeIds: profMods, ativo: true,
        order: (professores || []).length, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      toast.success('Professor cadastrado.');
      setProfOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o professor.');
    } finally {
      setSaving(false);
    }
  };

  // Para cadastro feito por engano: sem login e com no máximo uma movimentação.
  const excluirCadastro = async (p) => {
    if (p.user || (p.ficha?.movimentacoes || []).length > 1) return;
    if (p.professor) {
      let emUso;
      try {
        const [aulas, alunos] = await Promise.all([
          leadsWhere(db, 'appointmentProfessorId', '==', p.professor.id),
          leadsWhere(db, 'professorId', '==', p.professor.id),
        ]);
        emUso = aulas.length + alunos.length;
      } catch (err) {
        console.error(err);
        toast.error('Não deu para conferir as aulas e os alunos. Tente de novo.');
        return;
      }
      if (emUso > 0) { toast.warning(`"${p.nome}" tem aulas ou alunos registrados, então o cadastro não pode ser excluído.`); return; }
    }
    if (!window.confirm(`Excluir o cadastro de "${p.nome}"? Use só para cadastro feito por engano.`)) return;
    try {
      // Num lote só: apagar um e falhar no outro deixaria uma pessoa sem cadastro na lista.
      const lote = writeBatch(db);
      if (p.professor) lote.delete(doc(db, 'artifacts', appId, 'public', 'data', PROFESSORS_PATH, p.professor.id));
      if (p.ficha) lote.delete(doc(db, 'artifacts', appId, 'public', 'data', EQUIPE_PATH, p.ficha.id));
      await lote.commit();
      toast.success('Cadastro excluído.');
      navigate(listaHref, { replace: true, state: location.state });
    } catch (err) {
      console.error(err);
      toast.error('Não deu para excluir o cadastro.');
    }
  };

  const toggleProfMod = (id) => setProfMods(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const dialogos = (
    <>
      {/* Cadastro de membro */}
      <FormDialog
        open={Boolean(memberDialog)}
        onOpenChange={(v) => !v && setMemberDialog(null)}
        title={creatingProfessor ? 'Cadastrar acesso de professor' : 'Cadastrar consultor'}
        description={`Cria a conta no Firebase Auth e o cadastro interno numa operação só. Anote a senha temporária para entregar ao ${creatingProfessor ? 'professor' : 'consultor'}.`}
        submitLabel="Cadastrar"
        submitting={saving}
        onSubmit={() => createMember()}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DialogField label="Nome">
            <input className={FIELD_INPUT} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Ana Duarte" required />
          </DialogField>
          <DialogField label="E-mail de login">
            <input className={FIELD_INPUT} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ana@academia.com.br" required />
          </DialogField>
        </div>

        {showRoleField && (
          <div className="grid gap-4 sm:grid-cols-2">
            <DialogField label="Papel" hint="Professor não ocupa vaga de consultor do plano.">
              <select className={FIELD_INPUT} value={form.role} disabled={Boolean(memberDialog?.papelFixo)} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value={ROLES.CONSULTOR}>Consultor</option>
                <option value={ROLES.PROFESSOR}>Professor</option>
              </select>
            </DialogField>
            {form.role === ROLES.PROFESSOR && (
              <ProfessorPicker
                value={form.professorId}
                options={memberProfessorOptions}
                disabled={!professorEnabled || Boolean(memberDialog?.papelFixo)}
                onChange={(id) => setForm({ ...form, professorId: id })}
              />
            )}
          </div>
        )}

        <DialogField
          label="Senha temporária"
          hint={PASSWORD_RULE_TEXT}
        >
          <div className="flex gap-2">
            <input
              className={FIELD_INPUT}
              type="text"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Digite ou clique em Gerar"
              required
            />
            <SettingsBtn size={36} type="button" onClick={() => setForm({ ...form, password: generateTemporaryPassword() })}>Gerar</SettingsBtn>
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
      </FormDialog>

      {/* Convite por e-mail */}
      <FormDialog
        open={inviteOpen}
        onOpenChange={(v) => { setInviteOpen(v); if (!v) { setInviteEmail(''); setInviteLink(''); setInviteProfessorId(''); } }}
        title="Convidar por e-mail"
        description="O convidado define a própria senha pelo link. Envie o link gerado por e-mail ou WhatsApp. O link vale 7 dias."
        submitLabel={inviting ? 'Gerando…' : 'Gerar convite'}
        submitting={inviting}
        onSubmit={() => createInvite()}
      >
        <DialogField label="E-mail do convidado">
          <input className={FIELD_INPUT} type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@convidado.com" required />
        </DialogField>
        <DialogField label="Papel">
          <select className={FIELD_INPUT} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
            {inviteRoleOptions(tenantModules).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </DialogField>
        {inviteRole === ROLES.PROFESSOR && (
          <ProfessorPicker value={inviteProfessorId} options={inviteProfessorOptions} onChange={setInviteProfessorId} />
        )}
        {inviteLink && (
          <div className="flex items-center gap-2 p-2.5 rounded-[10px] bg-muted/60 border border-border">
            <span className="flex-1 text-[12px] text-muted-foreground truncate num">{inviteLink}</span>
            <SettingsBtn size={34} type="button" icon={<Copy size={13} />} onClick={copyInviteLink}>Copiar</SettingsBtn>
          </div>
        )}
      </FormDialog>

      {/* Professor novo */}
      <FormDialog
        open={profOpen}
        onOpenChange={setProfOpen}
        title="Novo professor"
        description={professorEnabled
          ? 'Professores aparecem na lista ao agendar uma aula experimental. O acesso ao app é dado na ficha da pessoa, em Acesso ao app.'
          : 'Professores aparecem na lista ao agendar uma aula experimental. Não têm login no app.'}
        submitLabel="Cadastrar professor"
        submitting={saving}
        onSubmit={saveProfessor}
      >
        <DialogField label="Nome">
          <input className={FIELD_INPUT} value={profName} onChange={e => setProfName(e.target.value)} placeholder="Ex: Rafael Menezes" required />
        </DialogField>
        <DialogField label="Modalidades em que atua">
          {(modalities || []).length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Nenhuma modalidade cadastrada. Adicione em Agendamento.</p>
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
    </>
  );

  if (pessoaId) {
    const voltar = (
      <AppLink to={listaHref} className="w-fit rounded text-[13px] font-semibold text-muted-foreground outline-none hover:text-brand-700 focus-visible:anel-foco">Equipe & acessos</AppLink>
    );
    let corpo;
    if (erro || !pronto) {
      // Gravar sem a leitura das fichas poderia criar uma ficha duplicada.
      corpo = (
        <div className="flex flex-col gap-4">
          {voltar}
          <p role={erro ? 'alert' : 'status'} className="rounded-2xl border border-border bg-card p-6 text-[13px] text-muted-foreground">
            {erro ? 'Não deu para ler as fichas da equipe.' : 'Abrindo a ficha…'}
          </p>
        </div>
      );
    } else if (!pessoa) {
      corpo = (
        <div className="flex flex-col gap-4">
          {voltar}
          <p className="rounded-2xl border border-border bg-card p-6 text-[13px] text-muted-foreground">Não achamos essa pessoa na equipe.</p>
        </div>
      );
    } else {
      corpo = (
        <>
          <EquipeFicha
            db={db} appUser={appUser} tenantId={tenantId} pessoa={pessoa} aba={pessoaAba || 'dados'}
            onAba={(aba) => navigate(hrefDe(pessoa.id, aba), { replace: true, state: location.state })}
            voltarHref={listaHref} modalities={modalities} professores={professores} leads={leads}
            professorEnabled={professorEnabled} agora={agora}
            onEditarAcesso={() => setEditandoAcesso(true)}
            onTirarAcesso={() => deleteMember(pessoa)}
            onDarAcesso={() => openCreate({
              name: pessoa.nome, email: pessoa.ficha?.emailPessoal || '',
              role: pessoa.funcao === 'professor' ? ROLES.PROFESSOR : ROLES.CONSULTOR, professorId: pessoa.professor?.id || '',
            }, { papelFixo: true })}
            onLeadsChanged={onLeadsChanged}
            acoesDaFicha={!pessoa.user && (pessoa.ficha?.movimentacoes || []).length <= 1
              ? <SettingsBtn size={36} onClick={() => excluirCadastro(pessoa)}>Excluir cadastro</SettingsBtn> : null}
          />
          {pessoa.user && (
            <EditarAcessoDialog db={db} appUser={appUser} user={pessoa.user} usersList={users} open={editandoAcesso} onOpenChange={setEditandoAcesso} />
          )}
        </>
      );
    }
    return <div ref={topoRef} className="scroll-mt-4 md:scroll-mt-8">{corpo}{dialogos}</div>;
  }

  return (
    <div ref={topoRef} className="flex scroll-mt-4 flex-col gap-5 md:scroll-mt-8">
      <SettingsSectionHeader
        title="Equipe & acessos"
        hint="Quem trabalha na academia: a ficha, o vínculo e o acesso ao app de cada pessoa."
      >
        <SettingsBtn size={38} icon={<Mail size={14} />} onClick={() => { setInviteOpen(true); setInviteLink(''); }}>
          Convidar por e-mail
        </SettingsBtn>
        <SettingsBtn size={38} icon={<Plus size={14} />} onClick={() => { setProfName(''); setProfMods([]); setProfOpen(true); }}>
          Cadastrar professor
        </SettingsBtn>
        <SettingsBtn kind="primary" size={38} icon={<Plus size={14} />} onClick={() => openCreate()}>
          {createLabel}
        </SettingsBtn>
      </SettingsSectionHeader>

      <SeatBand seats={seats} consultantCount={consultantCount} professorCount={professorCount} />

      {erro && <p role="alert" className="rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">Não deu para ler as fichas da equipe.</p>}

      <EquipeLista pessoas={pessoas} filtros={filtros} setFiltros={setFiltros} busca={busca} setBusca={setBusca}
        hrefDe={(id) => hrefDe(id)} modalities={modalities} leads={leads} agora={agora} />
      {dialogos}
    </div>
  );
}

export { TeamAccessSection };
