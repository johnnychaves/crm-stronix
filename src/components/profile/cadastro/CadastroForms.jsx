import { useId, useState } from 'react';
import { AlertTriangle, Baby, Briefcase, Calendar, IdCard, Mail, Phone, User, Users } from 'lucide-react';
import { zapMatchKey } from '../../../../api/_zapPhone.js';
import { isCepComplete, isCpfComplete, isValidCpf, lookupCep } from '../../../lib/brazilLookups.js';
import { MARITAL_STATUS_OPTIONS } from '../../../lib/clientRegistration.js';
import { fromDateInputValue, toDateInputValue } from '../../../lib/dates.js';
import { GUARDIAN_RELATIONSHIPS, adultSince } from '../../../lib/guardian.js';
import { sameContactPhone } from '../../../lib/leadDerived.js';
import { formatCPF, formatPhone } from '../../../lib/masks.js';
import { phoneNoticeLines } from '../../../lib/phoneNotice.js';
import { cn } from '../../../lib/utils.js';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { useDuplicateLead } from '../../../hooks/useDuplicateLead.js';
import { useGuardianMatches } from '../../../hooks/useGuardianMatches.js';
import { StyledInput, StyledSelect } from '../../ui/Field.jsx';
import { Switch } from '../../ui/switch.jsx';

// Os formulários das quatro seções do Cadastro da ficha. Cada controle leva
// `name` com a chave do formulário: é por ele que a aba (CadastroTab) acha o
// campo onde o cursor cai ao abrir a seção. O rótulo é em frase normal: o
// `Field` antigo escreve em caixa alta. A grade quebra pelo espaço do cartão
// (`@container` no corpo da seção), e não pela largura da janela.
const GRID = 'grid grid-cols-1 gap-3.5 @xs:grid-cols-6';

// `msgId` é o id da dica ou do erro, para o campo apontar com aria-describedby.
function Fld({ label, required, hint, error, msgId, className, children }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted-foreground">
          {label}
          {required && <span aria-hidden="true" className="ml-0.5 text-accent-600 dark:text-accent-400">*</span>}
        </span>
        {children}
      </label>
      {hint && !error && <span id={msgId} className="text-[12px] text-muted-foreground">{hint}</span>}
      {error && <span id={msgId} className="text-[12px] text-rose-700 dark:text-rose-300">{error}</span>}
    </div>
  );
}

const digitsOf = (v) => String(v || '').replace(/\D/g, '');

function IdentityForm({ form, set, lead, db }) {
  const ids = useId();
  const cpfMsgId = `${ids}-cpf`;
  const zapMsgId = `${ids}-zap`;
  const guardianDigits = digitsOf(form.guardianPhone);
  const guardianTooShort = guardianDigits.length > 0 && guardianDigits.length < 10;
  const guardianMatches = useGuardianMatches({ db, phoneDigits: form.isMinor ? guardianDigits : '', excludeId: lead.id });
  const guardianNotice = phoneNoticeLines({ field: 'guardian', ...guardianMatches });
  // O WhatsApp do aluno pode ser o número de um responsável de outro menor
  // (irmãos, ou o adulto que cadastra os filhos). Só avisa, não barra.
  // withOwner: false porque o dono do número é o useDuplicateLead que procura.
  const studentDigits = digitsOf(form.whatsapp);
  const ownMatches = useGuardianMatches({ db, phoneDigits: studentDigits, excludeId: lead.id, withOwner: false });
  // Número trocado para o de outro lead não salva, como no Novo lead. Foi pela
  // edição que nasceu a cópia da Maria Fernanda na Shape One (29/09/2026). Só
  // confere quando a chave do telefone mudou: o par que já divide um número
  // continua salvando, e pôr o nono dígito no mesmo número não é troca. A
  // conferência fresca, que barra o Salvar, é da aba (CadastroTab).
  const numberChanged = zapMatchKey(form.whatsapp) !== zapMatchKey(lead.whatsapp);
  const { duplicate } = useDuplicateLead({ db, phoneDigits: numberChanged ? studentDigits : '', excludeId: lead.id });
  const ownNotice = duplicate ? [] : phoneNoticeLines({ field: 'own', ...ownMatches });
  // O aluno não pode ter o mesmo número do responsável: recriaria o problema que
  // a chave de menor resolve. O Salvar fica barrado por sectionIssue; aqui é o aviso.
  const sameAsGuardian = form.isMinor && sameContactPhone(form.whatsapp, form.guardianPhone);
  const cpfInvalid = isCpfComplete(form.cpf) && !isValidCpf(form.cpf);
  // form.adultSince só diz que a chave estava ligada na abertura e a pessoa já
  // tinha 18 anos; a data mostrada sai do nascimento ATUAL do campo.
  const currentAdultSince = form.adultSince ? adultSince(fromDateInputValue(form.birthDate)) : null;
  // `new Date()` e não `Date.now()`: o eslint react-hooks/purity barra o segundo no render.
  const stillAdultByDate = Boolean(currentAdultSince) && new Date() >= currentAdultSince;
  const adultNote = !currentAdultSince
    ? null
    : stillAdultByDate
      ? `Fez 18 anos em ${toDateInputValue(currentAdultSince).split('-').reverse().join('/')}.`
      : (form.isMinor ? null : 'Pela data, é menor. Ligue a chave se o contato for o responsável.');

  return (
    <div className={GRID}>
      <Fld label="Nome completo" required className="@xs:col-span-6">
        <StyledInput autoComplete="off" name="name" aria-required="true" icon={<User size={15} />} value={form.name}
          onChange={(e) => set('name', e.target.value)} placeholder="Nome e sobrenome" />
      </Fld>

      <div className="min-w-0 @xs:col-span-3">
        <Fld label={form.isMinor ? 'WhatsApp do aluno' : 'WhatsApp'} required={!form.isMinor} hint={form.isMinor ? 'Opcional' : undefined}>
          <StyledInput autoComplete="off" name="whatsapp" icon={<Phone size={15} />} inputMode="numeric" value={form.whatsapp}
            aria-invalid={duplicate ? 'true' : undefined}
            aria-describedby={duplicate || sameAsGuardian || ownNotice.length > 0 ? zapMsgId : undefined}
            onChange={(e) => set('whatsapp', formatPhone(e.target.value))} placeholder="(51) 9 0000-0000"
            className={duplicate ? '!border-rose-400 focus:!ring-rose-400/15' : (sameAsGuardian ? '!border-amber-400' : '')} />
        </Fld>
        {/* Região viva desde a montagem: o aviso que chega depois do debounce é lido. */}
        <div id={zapMsgId} aria-live="polite">
          {duplicate ? (
            <div className="mt-1.5 flex items-start gap-1.5 text-[12px] text-rose-700 dark:text-rose-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>Já existe: <strong>{duplicate.name}</strong>{duplicate.consultantName ? ` · ${duplicate.consultantName}` : ''}{duplicate.status ? ` (${duplicate.status})` : ''}</span>
            </div>
          ) : sameAsGuardian ? (
            <div className="mt-1.5 flex items-start gap-1.5 text-[12px] text-amber-700 dark:text-amber-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>Esse é o telefone do responsável. Se o aluno não tem WhatsApp próprio, deixe em branco.</span>
            </div>
          ) : ownNotice.length > 0 ? (
            <div className="mt-1.5 text-[12px] text-muted-foreground">{ownNotice[0]}</div>
          ) : null}
        </div>
      </div>

      <Fld label="CPF" error={cpfInvalid ? 'CPF inválido' : undefined} msgId={cpfMsgId} className="@xs:col-span-3">
        <StyledInput autoComplete="off" name="cpf" icon={<IdCard size={15} />} inputMode="numeric" value={form.cpf}
          aria-invalid={cpfInvalid ? 'true' : undefined}
          aria-describedby={cpfInvalid ? cpfMsgId : undefined}
          onChange={(e) => set('cpf', formatCPF(e.target.value))} placeholder="000.000.000-00" />
      </Fld>

      <div className="flex flex-col gap-3 rounded-xl border border-border p-3 @xs:col-span-6">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/[0.12] dark:text-brand-300">
              <Baby size={16} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-tight text-foreground">Menor de idade</span>
              <span className="block text-[12px] text-muted-foreground">{adultNote || 'O contato passa a ser o responsável'}</span>
            </span>
          </span>
          <Switch checked={form.isMinor} onCheckedChange={(on) => set('isMinor', on)} />
        </label>
        {form.isMinor && (
          <div className="grid grid-cols-1 gap-3.5 @xs:grid-cols-2">
            <Fld label="Nome do responsável" required className="@xs:col-span-2">
              <StyledInput autoComplete="off" name="guardianName" aria-required="true" icon={<Users size={15} />} value={form.guardianName}
                onChange={(e) => set('guardianName', e.target.value)} placeholder="Nome de quem responde pelo aluno" />
            </Fld>
            <div className="min-w-0">
              <Fld label="Telefone do responsável" required>
                <StyledInput autoComplete="off" name="guardianPhone" aria-required="true" icon={<Phone size={15} />} inputMode="numeric" value={form.guardianPhone}
                  onChange={(e) => set('guardianPhone', formatPhone(e.target.value))} placeholder="(51) 9 0000-0000"
                  className={guardianTooShort ? '!border-amber-400' : ''} />
              </Fld>
              {guardianTooShort && (
                <div className="mt-1.5 text-[12px] text-amber-700 dark:text-amber-300">Número incompleto. Inclua DDD + 9 dígitos.</div>
              )}
            </div>
            <Fld label="Parentesco">
              <StyledSelect autoComplete="off" name="guardianRelation" value={form.guardianRelation} onChange={(e) => set('guardianRelation', e.target.value)}>
                <option value="">Selecione…</option>
                {GUARDIAN_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
              </StyledSelect>
            </Fld>
            {guardianNotice.length > 0 && (
              <div className="flex flex-col gap-0.5 text-[12px] text-muted-foreground @xs:col-span-2">
                {guardianNotice.map((linha) => <span key={linha}>{linha}</span>)}
              </div>
            )}
          </div>
        )}
      </div>

      <Fld label="RG" className="@xs:col-span-3">
        <StyledInput autoComplete="off" name="rg" value={form.rg} onChange={(e) => set('rg', e.target.value)} placeholder="Documento de identidade" />
      </Fld>
      <Fld label="Data de nascimento" className="@xs:col-span-3">
        <StyledInput autoComplete="off" name="birthDate" type="date" icon={<Calendar size={15} />} value={form.birthDate}
          onChange={(e) => set('birthDate', e.target.value)} />
      </Fld>
      <Fld label="Sexo" className="@xs:col-span-3">
        <StyledSelect autoComplete="off" name="sexo" value={form.sexo} onChange={(e) => set('sexo', e.target.value)}>
          <option value="">Selecione…</option>
          <option>Feminino</option>
          <option>Masculino</option>
          <option>Outro</option>
        </StyledSelect>
      </Fld>
      <Fld label="E-mail" className="@xs:col-span-6">
        <StyledInput autoComplete="off" name="email" type="email" icon={<Mail size={15} />} value={form.email}
          onChange={(e) => set('email', e.target.value)} placeholder="email@exemplo.com" />
      </Fld>
    </div>
  );
}

function AddressForm({ form, set, setForm }) {
  const toast = useToast();
  const [cepBusy, setCepBusy] = useState(false);
  const onCepBlur = async () => {
    if (!isCepComplete(form.cep)) return;
    setCepBusy(true);
    const r = await lookupCep(form.cep);
    setCepBusy(false);
    if (r) {
      setForm((f) => ({
        ...f, street: r.street || f.street, neighborhood: r.neighborhood || f.neighborhood,
        city: r.city || f.city, state: r.state || f.state,
      }));
    } else {
      toast.warning('CEP não encontrado. Confira o número.');
    }
  };
  return (
    <div className={GRID}>
      <Fld label="CEP" hint={cepBusy ? 'Buscando…' : undefined} className="@xs:col-span-2">
        <StyledInput autoComplete="off" name="cep" inputMode="numeric" value={form.cep} onChange={(e) => set('cep', e.target.value)} onBlur={onCepBlur} placeholder="00000-000" />
      </Fld>
      <Fld label="Rua" className="@xs:col-span-4">
        <StyledInput autoComplete="off" name="street" value={form.street} onChange={(e) => set('street', e.target.value)} placeholder="Av. Exemplo" />
      </Fld>
      <Fld label="Número" className="@xs:col-span-2">
        <StyledInput autoComplete="off" name="number" value={form.number} onChange={(e) => set('number', e.target.value)} placeholder="123" />
      </Fld>
      <Fld label="Complemento" className="@xs:col-span-4">
        <StyledInput autoComplete="off" name="complement" value={form.complement} onChange={(e) => set('complement', e.target.value)} placeholder="Sala, andar…" />
      </Fld>
      <Fld label="Bairro" className="@xs:col-span-6">
        <StyledInput autoComplete="off" name="neighborhood" value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Centro" />
      </Fld>
      <Fld label="Cidade" className="@xs:col-span-4">
        <StyledInput autoComplete="off" name="city" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Cidade" />
      </Fld>
      <Fld label="UF" className="@xs:col-span-2">
        <StyledInput autoComplete="off" name="state" value={form.state} maxLength={2} onChange={(e) => set('state', e.target.value.toUpperCase())} placeholder="UF" />
      </Fld>
    </div>
  );
}

function EmergencyForm({ form, set }) {
  return (
    <div className={GRID}>
      <Fld label="Nome" className="@xs:col-span-6">
        <StyledInput autoComplete="off" name="emgName" icon={<User size={15} />} value={form.emgName} onChange={(e) => set('emgName', e.target.value)}
          placeholder="Quem acionar" />
      </Fld>
      <Fld label="Telefone" className="@xs:col-span-3">
        <StyledInput autoComplete="off" name="emgPhone" icon={<Phone size={15} />} inputMode="numeric" value={form.emgPhone}
          onChange={(e) => set('emgPhone', formatPhone(e.target.value))} placeholder="(51) 9 0000-0000" />
      </Fld>
      <Fld label="Parentesco" className="@xs:col-span-3">
        <StyledInput autoComplete="off" name="emgRelation" value={form.emgRelation} onChange={(e) => set('emgRelation', e.target.value)}
          placeholder="Cônjuge, pai, mãe, amigo…" />
      </Fld>
    </div>
  );
}

function PersonalForm({ form, set }) {
  return (
    <div className={GRID}>
      <Fld label="Estado civil" className="@xs:col-span-3">
        <StyledSelect autoComplete="off" name="maritalStatus" value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
          <option value="">Selecione…</option>
          {MARITAL_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </StyledSelect>
      </Fld>
      <Fld label="Profissão" className="@xs:col-span-3">
        <StyledInput autoComplete="off" name="profession" icon={<Briefcase size={15} />} value={form.profession}
          onChange={(e) => set('profession', e.target.value)} placeholder="Ex.: Fisioterapeuta" />
      </Fld>
    </div>
  );
}

export function SectionForm({ sectionId, form, setForm, lead, db }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  if (sectionId === 'identidade') return <IdentityForm form={form} set={set} lead={lead} db={db} />;
  if (sectionId === 'endereco') return <AddressForm form={form} set={set} setForm={setForm} />;
  if (sectionId === 'emergencia') return <EmergencyForm form={form} set={set} />;
  return <PersonalForm form={form} set={set} />;
}
