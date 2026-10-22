import { BookOpen, Building2, Calendar, Copy, MessageCircle, Phone } from 'lucide-react';
import { CONTRACT_STATUS } from '../../lib/contracts.js';
import { stageText } from '../../lib/profileBand.js';
import { getTone } from '../../lib/leadState.js';
import { cn } from '../../lib/utils.js';
import { Avatar } from '../ui/Avatar.jsx';

// A faixa de baixo do cabeçalho da ficha: Próximo passo, Etapa (ou Contrato),
// Contato e Equipe, com o rótulo em frase normal. O que cada célula diz vem de
// src/lib/profileBand.js (`band`); aqui só o desenho. `tone` é o tom da etapa
// do lead (getTone da fase), usado na régua do funil. Abaixo de lg são duas
// colunas sem régua entre elas; a partir de lg, quatro, separadas por régua.
// Ícone e tom do próximo passo, os mesmos do "A seguir" (UpNextList).
const KIND_ICON = { class: BookOpen, visit: Building2, call: Phone, msg: MessageCircle };
const KIND_TONE = { class: 'teal', visit: 'violet', call: 'amber', msg: 'emerald' };

function Cell({ label, children }) {
  return (
    <div className="min-w-0 py-0.5 lg:px-5 lg:first:pl-0">
      <div className="text-[12.5px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1.5 min-w-0">{children}</div>
    </div>
  );
}

function NextCell({ next, onGoNext }) {
  if (!next.item) {
    return (
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 flex-none place-items-center rounded-lg border border-dashed border-slate-300 text-slate-400 dark:border-white/15 dark:text-slate-500">
          <Calendar size={15} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <b className="block text-[13.5px] font-semibold text-slate-600 dark:text-slate-300">{next.title}</b>
          <span className="block text-[12.5px] text-muted-foreground">{next.detail}</span>
        </span>
      </div>
    );
  }
  const tone = getTone(KIND_TONE[next.item.kind] || 'brand');
  const Icon = KIND_ICON[next.item.kind] || Calendar;
  return (
    <button
      type="button"
      onClick={onGoNext}
      aria-label={`Ver o próximo passo no A seguir: ${next.title}`}
      className="-m-1 flex w-[calc(100%+0.5rem)] items-start gap-2.5 rounded-lg p-1 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:anel-foco dark:hover:bg-white/[0.04]"
    >
      <span className={cn('grid size-8 flex-none place-items-center rounded-lg', tone.soft, tone.text, tone.darkSoft, tone.darkText)}>
        <Icon size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <b className="block truncate text-[13.5px] font-semibold">{next.title}</b>
        {next.detail && <span className="block truncate text-[12.5px] text-muted-foreground">{next.detail}</span>}
        {next.overdue && <span className="block text-[12px] font-semibold text-amber-700 dark:text-amber-300">Atrasado</span>}
      </span>
    </button>
  );
}

function StageCell({ mid, tone }) {
  if (!mid) return <span className="text-[13px] text-muted-foreground">Sem etapa</span>;
  const text = stageText(mid);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold">
        <span className="size-2 flex-none rounded-full" style={{ background: tone.hex }} aria-hidden="true" />
        <span className="truncate">{mid.name}</span>
      </div>
      {mid.total > 0 && mid.index >= 0 && (
        <div className="mt-2 flex gap-[3px]" aria-hidden="true">
          {Array.from({ length: mid.total }, (_, i) => (
            <i
              key={i}
              data-seg
              className={cn('h-1.5 flex-1 rounded-full', i > mid.index && 'bg-slate-200 dark:bg-white/10')}
              style={i <= mid.index ? { background: tone.hex } : undefined}
            />
          ))}
        </div>
      )}
      {text && <p className="mt-1.5 text-[12.5px] text-muted-foreground">{text}</p>}
    </div>
  );
}

function ContractCell({ mid }) {
  if (!mid) return <span className="text-[13px] text-muted-foreground">Sem contrato registrado</span>;
  const bar = mid.status === CONTRACT_STATUS.A_VENCER ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="min-w-0">
      <b className="block truncate text-[13.5px] font-semibold">{mid.planName}</b>
      {mid.pct != null && (
        <div
          role="progressbar"
          aria-label="Quanto da vigência já passou"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={mid.pct}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
        >
          <i className={cn('block h-full rounded-full', bar)} style={{ width: `${mid.pct}%` }} />
        </div>
      )}
      <p className="mt-1.5 text-[12.5px] text-muted-foreground">{mid.text}</p>
    </div>
  );
}

function ContactCell({ contact, contactText, studentPhone, onCopyPhone }) {
  const copy = (phone, label) => (
    <button
      type="button"
      onClick={() => onCopyPhone(phone)}
      title={label}
      aria-label={label}
      className="grid size-5 shrink-0 place-items-center rounded text-slate-400 transition hover:text-brand-600 focus-visible:outline-none focus-visible:anel-foco dark:hover:text-brand-300"
    >
      <Copy size={12} aria-hidden="true" />
    </button>
  );
  if (contact.viaGuardian) {
    return (
      <div className="flex min-w-0 flex-col gap-0.5 text-[13.5px] font-semibold">
        {/* O número nunca trunca: é o dado que o consultor precisa discar, e
            "(mãe)" pode ceder espaço antes dele. */}
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="num whitespace-nowrap">{contact.phone || '—'}</span>
          {contact.phone && copy(contact.phone, 'Copiar número do responsável')}
        </span>
        <span className="truncate text-[12.5px] font-normal text-muted-foreground" title={contactText}>{contactText}</span>
        {studentPhone && (
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-normal text-muted-foreground">
            {/* Uma string só: com dois filhos de texto o renderToString põe um
                comentário no meio. */}
            <span className="num whitespace-nowrap">{`Aluno · ${studentPhone}`}</span>
            {copy(studentPhone, 'Copiar número do aluno')}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold">
      <span className="num truncate">{contact.phone || '—'}</span>
      {contact.phone && copy(contact.phone, 'Copiar número')}
    </div>
  );
}

function Person({ name, role, empty }) {
  if (!name) return <span className="text-[13px] text-muted-foreground">{empty}</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Avatar name={name} size={20} />
      <span className="truncate text-[13.5px] font-semibold" title={name}>{name}</span>
      <span className="shrink-0 text-[12.5px] text-muted-foreground">{role}</span>
    </span>
  );
}

export function ProfileHeaderBand({ band, isClient, tone, contact, contactText, studentPhone, onGoNext, onCopyPhone }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 lg:grid-cols-[1.25fr_1.1fr_1fr_1.1fr] lg:gap-x-0 lg:divide-x lg:divide-border">
      <Cell label="Próximo passo"><NextCell next={band.next} onGoNext={onGoNext} /></Cell>
      <Cell label={isClient ? 'Contrato' : 'Etapa'}>
        {isClient ? <ContractCell mid={band.mid} /> : <StageCell mid={band.mid} tone={tone} />}
      </Cell>
      <Cell label={contact.viaGuardian ? 'Contato (responsável)' : 'Contato'}>
        <ContactCell contact={contact} contactText={contactText} studentPhone={studentPhone} onCopyPhone={onCopyPhone} />
      </Cell>
      <Cell label="Equipe">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Person name={band.team.consultant} role="consultor" empty="Sem responsável" />
          <Person name={band.team.professor} role={band.team.professorRole} empty="Sem professor" />
        </div>
      </Cell>
    </div>
  );
}
