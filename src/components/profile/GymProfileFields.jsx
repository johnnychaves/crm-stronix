import { useEffect, useState } from 'react';
import { FileText, MapPin, User } from 'lucide-react';
import { lookupCep, lookupCnpj, isCepComplete, isCnpjComplete, isCpfComplete, isValidCpf } from '../../lib/brazilLookups.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { SettingsCard } from '../ui/SettingsCard.jsx';
import { Field, StyledInput } from '../ui/Field.jsx';

// Campos do "Perfil da academia", isolados pra serem reusados em 3 telas:
// Perfil da academia (cliente), criação e edição no superadmin. Dono dos
// lookups (BrasilAPI/ViaCEP) e da validação de CPF. Controlado por value/onChange.
//
// Props:
//   value            form plano (ver EMPTY_PROFILE em lib/gymProfile.js)
//   onChange(patch)  recebe um objeto parcial pra mesclar no form
//   wrapInCards      true = cada bloco num SettingsCard (default); false = grid
//                    solto com título leve (pra usar dentro de outro card)
//   onValidityChange(bool) opcional — chamado com true quando o CPF é inválido

// Título leve para o modo "solto". Fica no escopo do módulo (não dentro do
// componente) — se fosse recriado a cada render, os inputs perderiam o foco a
// cada tecla no formulário controlado.
function Section({ icon, title, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300">{icon}{title}</div>
      {children}
    </div>
  );
}

function GymProfileFields({ value, onChange, wrapInCards = true, onValidityChange }) {
  const toast = useToast();
  const [cnpjBusy, setCnpjBusy] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const set = (k, v) => onChange({ [k]: v });

  const cpfInvalid = isCpfComplete(value.responsibleCpf) && !isValidCpf(value.responsibleCpf);
  useEffect(() => { onValidityChange?.(cpfInvalid); }, [cpfInvalid, onValidityChange]);

  // CNPJ completo → razão social + nome fantasia (BrasilAPI).
  const onCnpjBlur = async () => {
    if (!isCnpjComplete(value.cnpjCpf)) return;
    setCnpjBusy(true);
    const r = await lookupCnpj(value.cnpjCpf);
    setCnpjBusy(false);
    if (r) onChange({ legalName: r.legalName || value.legalName, tradeName: r.tradeName || value.tradeName });
    else toast.warning('CNPJ não encontrado na Receita — confira o número.');
  };
  // CEP completo → rua/bairro/cidade/UF (ViaCEP). Não toca número/complemento.
  const onCepBlur = async () => {
    if (!isCepComplete(value.cep)) return;
    setCepBusy(true);
    const r = await lookupCep(value.cep);
    setCepBusy(false);
    if (r) onChange({ street: r.street || value.street, neighborhood: r.neighborhood || value.neighborhood, city: r.city || value.city, state: r.state || value.state });
    else toast.warning('CEP não encontrado — confira o número.');
  };

  const identity = (
    <div className="space-y-4">
      <Field label="CNPJ" hint={cnpjBusy ? 'Buscando na Receita…' : 'Preenche razão social e nome fantasia'}>
        <StyledInput value={value.cnpjCpf} onChange={(e) => set('cnpjCpf', e.target.value)} onBlur={onCnpjBlur} placeholder="00.000.000/0000-00" />
      </Field>
      <Field label="Razão social"><StyledInput value={value.legalName} onChange={(e) => set('legalName', e.target.value)} placeholder="Nome empresarial" /></Field>
      <Field label="Nome fantasia (opcional)"><StyledInput value={value.tradeName} onChange={(e) => set('tradeName', e.target.value)} placeholder="Como a academia é conhecida" /></Field>
    </div>
  );

  const contact = (
    <div className="space-y-4">
      <Field label="Nome do responsável"><StyledInput value={value.responsibleName} onChange={(e) => set('responsibleName', e.target.value)} placeholder="Nome completo" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CPF" error={cpfInvalid ? 'CPF inválido' : undefined}><StyledInput value={value.responsibleCpf} onChange={(e) => set('responsibleCpf', e.target.value)} placeholder="000.000.000-00" /></Field>
        <Field label="Data de nascimento"><StyledInput type="date" value={value.responsibleBirth} onChange={(e) => set('responsibleBirth', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="WhatsApp"><StyledInput value={value.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="55 51 99999-9999" /></Field>
        <Field label="Telefone"><StyledInput value={value.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(51) 3333-3333" /></Field>
      </div>
      <Field label="E-mail comercial"><StyledInput type="email" value={value.email} onChange={(e) => set('email', e.target.value)} placeholder="contato@academia.com" /></Field>
    </div>
  );

  const address = (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
      <div className="sm:col-span-3">
        <Field label="CEP" hint={cepBusy ? 'Buscando endereço…' : undefined}>
          <StyledInput value={value.cep} onChange={(e) => set('cep', e.target.value)} onBlur={onCepBlur} placeholder="00000-000" />
        </Field>
      </div>
      <div className="sm:col-span-7"><Field label="Rua / logradouro"><StyledInput value={value.street} onChange={(e) => set('street', e.target.value)} placeholder="Av. Exemplo" /></Field></div>
      <div className="sm:col-span-2"><Field label="Número"><StyledInput value={value.number} onChange={(e) => set('number', e.target.value)} placeholder="123" /></Field></div>
      <div className="sm:col-span-5"><Field label="Complemento"><StyledInput value={value.complement} onChange={(e) => set('complement', e.target.value)} placeholder="Sala, andar…" /></Field></div>
      <div className="sm:col-span-7"><Field label="Bairro"><StyledInput value={value.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Centro" /></Field></div>
      <div className="sm:col-span-9"><Field label="Cidade"><StyledInput value={value.city} onChange={(e) => set('city', e.target.value)} placeholder="Cidade" /></Field></div>
      <div className="sm:col-span-3"><Field label="UF"><StyledInput value={value.state} maxLength={2} onChange={(e) => set('state', e.target.value.toUpperCase())} placeholder="UF" /></Field></div>
    </div>
  );

  if (wrapInCards) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SettingsCard title="Identidade & fiscal" hint="Dados oficiais da empresa" icon={<FileText size={16} />}>{identity}</SettingsCard>
        <SettingsCard title="Contato & responsável" hint="Quem responde pela academia" icon={<User size={16} />}>{contact}</SettingsCard>
        <SettingsCard className="order-last lg:col-span-2" title="Endereço" hint="Onde a academia funciona" icon={<MapPin size={16} />}>{address}</SettingsCard>
      </div>
    );
  }

  // Modo "solto": títulos leves, sem card (o pai já é um card/modal).
  return (
    <div className="space-y-5">
      <Section icon={<FileText size={14} className="text-brand-600" />} title="Identidade & fiscal">{identity}</Section>
      <Section icon={<User size={14} className="text-brand-600" />} title="Contato & responsável">{contact}</Section>
      <Section icon={<MapPin size={14} className="text-brand-600" />} title="Endereço">{address}</Section>
    </div>
  );
}

export { GymProfileFields };
