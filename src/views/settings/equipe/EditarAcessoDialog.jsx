import { useState } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { auth, appId, USERS_PATH } from '../../../lib/firebase.js';
import { passwordPolicyError, PASSWORD_RULE_TEXT, generateTemporaryPassword } from '../../../lib/passwordPolicy.js';
import { isGestor, isProfessor, roleLabel, roleOf, ROLES } from '../../../lib/acesso.js';
import { hasModule, MODULES } from '../../../lib/modules.js';
import { availableProfessors, planRoleChange, PROFESSOR_LINK_MESSAGES, SET_ROLE_ACTION } from '../../../lib/teamRoles.js';
import { planLoginEmailChange, loginEmailConfirmText, LOGIN_EMAIL_FAILED_MESSAGE } from '../../../lib/loginEmail.js';
import { cn } from '../../../lib/utils.js';
import { useGeneralConfig } from '../../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { DialogField, FIELD_INPUT, FormDialog, SettingsBtn } from '../settingsBits.jsx';
import { ProfessorPicker } from './ProfessorPicker.jsx';

const normalizeUid = (v) => String(v || '').trim();
const formDe = (user) => ({
  email: user?.email || '', password: '', shiftStart: user?.shiftStart || '', shiftEnd: user?.shiftEnd || '',
  dailyVolumeTarget: user?.dailyVolumeTarget != null ? String(user.dailyVolumeTarget) : '',
  role: roleOf(user), professorId: user?.professorId || ''
});

// O diálogo de editar o acesso (papel, e-mail de login, senha, turno e meta de
// prospecção), aberto pela aba Acesso ao app da ficha. A regra é a de antes do
// cadastro da equipe; o nome saiu daqui e mora no bloco Identidade.
export function EditarAcessoDialog({ db, appUser, user, usersList, open, onOpenChange }) {
  const toast = useToast();
  const { professores } = useGeneralConfig();
  const professorEnabled = hasModule(appUser?.tenantModules, MODULES.FALTOSOS);
  const [abertoPara, setAbertoPara] = useState(null);
  const [form, setForm] = useState(() => formDe(user));
  const [saving, setSaving] = useState(false);
  const alvo = user?.id ?? null;
  if (open && abertoPara !== alvo) { setAbertoPara(alvo); setForm(formDe(user)); }
  if (!open && abertoPara !== null) setAbertoPara(null);
  if (!user) return null;

  const showRoleField = !isGestor(user) && (professorEnabled || isProfessor(user));
  const memberProfessorOptions = availableProfessors(professores, usersList || [], {
    exceptUserId: user.id,
    keepId: user.professorId ?? null
  });

  // Consultor extra é cobrado além da mensalidade: nunca cobra sem avisar.
  const confirmExtra = (price) => window.confirm(
    `Os consultores inclusos no seu plano já foram usados.\n\nEste consultor entra como extra: +R$ ${Number(price).toLocaleString('pt-BR')}/mês na mensalidade (vale a partir da próxima fatura).\n\nConfirmar?`
  );

  const authHeader = async () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await auth.currentUser.getIdToken()}`
  });

  // Papel e professor ligado mudam pelo servidor (set-role do
  // /api/admin-users), que confere o módulo, o professor do cadastro, a
  // carteira e a vaga de consultor. Devolve true quando o resto do cadastro
  // pode seguir.
  const changeRole = async (target, change, allowExtra = false) => {
    const res = await fetch('/api/admin-users', {
      method: 'POST',
      headers: await authHeader(),
      body: JSON.stringify({
        action: SET_ROLE_ACTION,
        userDocId: target.id,
        role: change.role,
        ...(change.role === ROLES.PROFESSOR ? { professorId: change.professorId } : {}),
        allowExtra
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data?.requiresExtraConfirmation) {
      return confirmExtra(data.extraUserPrice) ? changeRole(target, change, true) : false;
    }
    if (!res.ok) { toast.error(data.error || 'Não foi possível trocar o papel.'); return false; }
    if (data.changed !== false) {
      toast.success(change.role === roleOf(target)
        ? 'Professor do cadastro trocado.'
        : `O papel de ${target.name} agora é ${roleLabel({ role: change.role })}. O acesso novo vale quando a pessoa entrar de novo.`);
    }
    if (data.isExtra) toast.info('Este consultor entrou como extra. A mensalidade foi ajustada a partir da próxima fatura.', { duration: 8000 });
    return true;
  };

  const updateMember = async () => {
    const target = user;
    // A senha é conferida antes de gravar o cadastro. Se fosse recusada só no
    // fim, o resto das alterações já estaria salvo com o formulário aberto.
    if (form.password.trim()) {
      const passwordProblem = passwordPolicyError(form.password);
      if (passwordProblem) { toast.warning(passwordProblem); return; }
    }
    // O que muda no papel. Professor sem professor escolhido nem chega ao
    // servidor.
    const roleChange = planRoleChange(target, form);
    if (roleChange?.role === ROLES.PROFESSOR && !roleChange.professorId) {
      toast.warning(PROFESSOR_LINK_MESSAGES.missing);
      return;
    }
    // O e-mail de login de quem tem conta muda pelo servidor (set-email do
    // /api/admin-users), no Auth e no cadastro juntos, e as sessões da pessoa
    // caem. O cliente só grava o e-mail do cadastro sem conta, que não tem
    // login para trocar.
    const emailChange = planLoginEmailChange(target, form.email);
    if (emailChange.kind === 'invalid') { toast.warning(emailChange.error); return; }
    const ownEmail = emailChange.kind === 'account'
      && emailChange.body.targetAuthUid === normalizeUid(appUser?.authUid);
    // Trocar o próprio e-mail derruba a sessão de quem está salvando, e a troca
    // de senha que viria em seguida seria recusada pelo servidor.
    if (ownEmail && form.password.trim()) {
      toast.warning('Troque o seu e-mail e a sua senha em duas vezes: salve o e-mail, entre de novo e depois troque a senha.');
      return;
    }
    if (emailChange.kind === 'account'
      && !window.confirm(loginEmailConfirmText({ name: target.name, email: emailChange.email, self: ownEmail }))) return;

    setSaving(true);
    try {
      // A troca de papel vai primeiro: é o único passo que pode pedir a
      // confirmação do extra, e recusada, nada mais é salvo.
      if (roleChange && !(await changeRole(target, roleChange))) return;

      if (emailChange.kind === 'account') {
        const res = await fetch('/api/admin-users', {
          method: 'POST',
          headers: await authHeader(),
          body: JSON.stringify(emailChange.body)
        });
        const data = await res.json().catch(() => ({}));
        // Sem o e-mail trocado, nada mais é salvo: o formulário fica aberto com
        // o que foi digitado.
        if (!res.ok) { toast.error(data.error || LOGIN_EMAIL_FAILED_MESSAGE); return; }
        // changed: false é o e-mail que a conta já tinha. O login não mudou.
        if (data.changed !== false) {
          toast.success(ownEmail
            ? 'Seu e-mail de login mudou. Saia e entre de novo com o e-mail novo.'
            : 'E-mail de login trocado. A pessoa passa a entrar com o e-mail novo.');
        }
      }

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', USERS_PATH, target.id), {
        // O e-mail só entra aqui no cadastro sem conta. Com conta, quem grava é
        // o set-email, junto com o Auth.
        ...(emailChange.kind === 'record' ? { email: emailChange.email } : {}),
        // authUid não sai daqui: é a chave que liga o cadastro à conta do Auth,
        // e as rules agora recusam a troca. Ele nasce no /api/admin-users (ação
        // create) e no aceite de convite.
        shiftStart: form.shiftStart || null,
        shiftEnd: form.shiftEnd || null,
        // Vazio ou 0 = sem meta de prospecção. Não existe padrão de academia:
        // o piso é 100% individual. O professor não prospecta, então a meta
        // dele sai junto.
        dailyVolumeTarget: form.role !== ROLES.PROFESSOR && form.dailyVolumeTarget !== '' && Number(form.dailyVolumeTarget) > 0
          ? Math.min(500, Math.floor(Number(form.dailyVolumeTarget)))
          : deleteField(),
        password: deleteField()
      });

      if (form.password.trim()) {
        const targetUid = target.authUid;
        if (!targetUid) {
          toast.error('Cadastro sem authUid. Não é possível redefinir senha.');
        } else {
          const res = await fetch('/api/admin-users', {
            method: 'POST',
            headers: await authHeader(),
            body: JSON.stringify({ action: 'set-password', targetAuthUid: targetUid, password: form.password })
          });
          const data = await res.json();
          if (!res.ok) { toast.error(data.error || 'Erro ao redefinir senha.'); return; }
          toast.success(`Senha redefinida. Nova senha: ${form.password}`, { duration: 8000 });
        }
      }

      toast.success('Cadastro atualizado.');
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Editar o acesso de ${user.name}`}
      description="O authUid é gerado no cadastro e não muda. Preencha a nova senha só se quiser redefini-la."
      submitLabel="Salvar alterações"
      submitting={saving}
      onSubmit={updateMember}
    >
      <DialogField label="E-mail de login" hint="Trocar o e-mail muda o login da pessoa.">
        <input className={FIELD_INPUT} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ana@academia.com.br" required />
      </DialogField>

      {showRoleField && (
        <div className="grid gap-4 sm:grid-cols-2">
          <DialogField label="Papel" hint="Professor não ocupa vaga de consultor do plano.">
            <select className={FIELD_INPUT} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value={ROLES.CONSULTOR}>Consultor</option>
              <option value={ROLES.PROFESSOR}>Professor</option>
            </select>
          </DialogField>
          {form.role === ROLES.PROFESSOR && (
            <ProfessorPicker
              value={form.professorId}
              options={memberProfessorOptions}
              disabled={!professorEnabled}
              onChange={(id) => setForm({ ...form, professorId: id })}
            />
          )}
        </div>
      )}

      <DialogField label="Nova senha (opcional)" hint={`Em branco mantém a senha atual. ${PASSWORD_RULE_TEXT}`}>
        <div className="flex gap-2">
          <input
            className={FIELD_INPUT}
            type="text"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="Deixe em branco para não alterar"
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

      {form.role !== ROLES.PROFESSOR && (
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
  );
}
