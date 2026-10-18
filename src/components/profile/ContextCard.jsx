import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { isSeller } from '../../lib/acesso.js';
import { cn } from '../../lib/utils.js';
import { Btn } from '../ui/Btn.jsx';
import { TagBadge } from '../ui/Badges.jsx';
import { TagsInput } from '../ui/TagsInput.jsx';
import { ContextSelect } from './ContextSelect.jsx';

// O Contexto comercial da ficha: o que o consultor precisa ter em mente antes de
// falar com a pessoa. Cada campo é um botão que troca pelo editor no lugar. Quem
// grava é a ficha (onSave), um campo por vez, e devolve false quando não deu
// certo: o editor fica aberto, com o que foi digitado. Sem permissão de editar
// (canEdit falso), os campos são só leitura.
const CELLS = [
  { key: 'dor', label: 'Dor', cls: '', emptyLabel: 'Sem dor' },
  { key: 'modalidade', label: 'Modalidade', cls: '', emptyLabel: 'Sem modalidade' },
  { key: 'source', label: 'Origem', cls: '' },
  { key: 'consultantId', label: 'Consultor', cls: '' },
  { key: 'professorId', label: 'Professor', cls: 'col-span-2 md:col-span-1', emptyLabel: 'Sem professor' },
  { key: 'tags', label: 'Etiquetas', cls: 'col-span-2' },
  { key: 'observation', label: 'Observação', cls: 'col-span-2 md:col-span-3' },
];

// O valor gravado entra na lista mesmo fora do catálogo, senão o campo abriria em
// branco e a primeira escolha apagaria um dado que a pessoa nem viu.
const CELL_BOX = 'min-w-0 border-l border-t border-border px-4 py-3.5 lg:px-6';

const withCurrent = (list, current, label = current) =>
  (current && !list.some((o) => o.value === current) ? [...list, { value: current, label }] : list);

function Shell({ cell, editable, onOpen, empty, plain, ref, children }) {
  const body = (
    <>
      <span className="text-[12.5px] font-medium text-muted-foreground">{cell.label}</span>
      <span className={cn('mt-1 block min-w-0 break-words text-[14px]', empty ? 'text-muted-foreground' : plain ? 'text-foreground' : 'font-semibold')}>
        {children}
      </span>
      {editable && (
        <Pencil
          size={13}
          aria-hidden="true"
          className="absolute right-3 top-3.5 text-muted-foreground lg:right-4 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100"
        />
      )}
    </>
  );
  const base = cn(CELL_BOX, 'relative text-left', cell.cls);
  if (!editable) return <div className={base}>{body}</div>;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Editar ${cell.label.toLowerCase()}`}
      onClick={onOpen}
      className={cn(base, 'group transition hover:bg-slate-50 dark:hover:bg-white/[0.03] focus-visible:outline-none focus-visible:anel-foco focus-visible:ring-inset')}
    >
      {body}
    </button>
  );
}

function EditArea({ cell, ref, onKeyDown, children }) {
  return (
    <div ref={ref} onKeyDown={onKeyDown} className={cn(CELL_BOX, cell.cls)}>
      <span className="text-[12.5px] font-medium text-muted-foreground">{cell.label}</span>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function ContextCard({ lead, sources = [], usersList = [], tagsCatalog = [], canEdit = false, onSave }) {
  const { dores, modalities, professores } = useGeneralConfig();
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  // O botão do campo some quando o editor abre, e o editor some ao fechar: sem
  // isto o foco cairia no body. Ao abrir as etiquetas, ele vai para o campo de
  // digitar (a observação usa autoFocus e a lista o Radix); ao fechar, volta ao
  // campo que estava aberto, para quem usa o teclado seguir de onde parou.
  const cellRefs = useRef({});
  const tagsRef = useRef(null);
  const returnFocusTo = useRef(null);
  useEffect(() => {
    if (editing === 'tags') { tagsRef.current?.querySelector('input')?.focus(); return; }
    if (editing !== null || !returnFocusTo.current) return;
    cellRefs.current[returnFocusTo.current]?.focus();
    returnFocusTo.current = null;
  }, [editing]);

  // Quem pode receber o lead: gente ativa, com login, que vende. É a mesma lista
  // do Consultor responsável do cadastro completo.
  const owners = useMemo(
    () => (usersList || []).filter((u) => u?.id && u.name && u.authUid && u.active !== false && !u.superAdminOnly && isSeller(u)),
    [usersList]
  );
  const options = {
    dor: withCurrent((dores || []).map((d) => ({ value: d.name, label: d.name })), lead.dor),
    modalidade: withCurrent((modalities || []).map((m) => ({ value: m.name, label: m.name })), lead.modalidade),
    source: withCurrent((sources || []).map((s) => ({ value: s.name, label: s.name })), lead.source),
    consultantId: withCurrent(owners.map((u) => ({ value: u.id, label: u.name })), lead.consultantId, lead.consultantName || 'Responsável atual'),
    professorId: withCurrent((professores || []).map((p) => ({ value: p.id, label: p.nome })), lead.professorId, lead.professorName || 'Professor atual'),
  };
  const current = {
    dor: lead.dor || '', modalidade: lead.modalidade || '', source: lead.source || '',
    consultantId: lead.consultantId || '', professorId: lead.professorId || '',
  };
  const shown = {
    dor: lead.dor, modalidade: lead.modalidade, source: lead.source,
    consultantId: lead.consultantName, professorId: lead.professorName,
  };

  // Campo vazio convida a adicionar só quem pode; para quem só lê (o professor)
  // seria um convite a uma ação que ele não tem.
  const emptyText = canEdit ? 'Adicionar' : 'Não informado';

  const open = (key) => {
    if (!canEdit) return;
    setDraft(key === 'tags' ? [...(lead.tags || [])] : key === 'observation' ? (lead.observation || '') : null);
    setEditing(key);
  };
  const close = () => {
    returnFocusTo.current = editing;
    setEditing(null);
    setDraft(null);
  };
  // Texto e etiquetas iguais aos gravados só fecham: nada mudou, nada a gravar.
  // Na lista, o Radix já não avisa quando a escolha é a mesma.
  const unchanged = (key, value) =>
    (key === 'observation' && String(value).trim() === (lead.observation || '').trim())
    || (key === 'tags' && JSON.stringify(value) === JSON.stringify(lead.tags || []));
  const save = async (key, value) => {
    if (unchanged(key, value)) { close(); return; }
    setSaving(true);
    const ok = await onSave(key, value);
    setSaving(false);
    if (ok !== false) close();
  };

  return (
    <section aria-label="Contexto comercial" className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pb-3 pt-4 lg:px-6">
        <h3 className="font-display text-[16px] font-semibold tracking-tight">Contexto comercial</h3>
        {canEdit && <span className="text-[12.5px] text-muted-foreground">Clique em um campo para editar</span>}
      </div>
      {/* As réguas são bordas das células, e não o fundo da grade: no escuro o
          card é translúcido, e o fundo apareceria através dele. O -ml-px esconde
          a borda esquerda da primeira coluna sob o overflow-hidden do card. */}
      <div className="-ml-px grid grid-cols-2 md:grid-cols-5">
        {CELLS.map((cell) => {
          const { key } = cell;
          const setRef = (el) => { cellRefs.current[key] = el; };
          if (editing === key && key === 'tags') {
            return (
              <EditArea key={key} cell={cell} ref={tagsRef} onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
                <TagsInput tags={draft} setTags={setDraft} suggestions={(tagsCatalog || []).map((t) => t.name)} />
                <div className="mt-2.5 flex justify-end gap-2">
                  <Btn kind="soft" size="sm" onClick={close} disabled={saving}>Cancelar</Btn>
                  <Btn kind="brand" size="sm" onClick={() => save(key, draft)} disabled={saving}>Salvar</Btn>
                </div>
              </EditArea>
            );
          }
          if (editing === key && key === 'observation') {
            return (
              <EditArea key={key} cell={cell}>
                <textarea
                  autoFocus
                  value={draft}
                  rows={3}
                  aria-label="Observação"
                  placeholder="Contexto, preferências, histórico relevante."
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') close();
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(key, draft); }
                  }}
                  className="w-full resize-none rounded-lg border border-border bg-card p-3 text-[13.5px] outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus-visible:anel-foco"
                />
                <div className="mt-2.5 flex items-center justify-end gap-2">
                  <span className="mr-auto text-[12px] text-muted-foreground">Ctrl e Enter salvam</span>
                  <Btn kind="soft" size="sm" onClick={close} disabled={saving}>Cancelar</Btn>
                  <Btn kind="brand" size="sm" onClick={() => save(key, draft)} disabled={saving}>Salvar</Btn>
                </div>
              </EditArea>
            );
          }
          if (editing === key) {
            return (
              <EditArea key={key} cell={cell}>
                <ContextSelect
                  label={cell.label}
                  value={current[key]}
                  options={options[key]}
                  emptyLabel={cell.emptyLabel || null}
                  onPick={(value) => save(key, value)}
                  onCancel={close}
                />
              </EditArea>
            );
          }
          if (key === 'tags') {
            const list = lead.tags || [];
            return (
              <Shell key={key} ref={setRef} cell={cell} editable={canEdit} onOpen={() => open(key)} empty={list.length === 0} plain>
                {list.length === 0 ? emptyText : (
                  <span className="flex flex-wrap gap-1.5">
                    {list.map((t) => <TagBadge key={t} tagName={t} tagsArray={tagsCatalog} />)}
                  </span>
                )}
              </Shell>
            );
          }
          if (key === 'observation') {
            return (
              <Shell key={key} ref={setRef} cell={cell} editable={canEdit} onOpen={() => open(key)} empty={!lead.observation} plain>
                {lead.observation ? <span className="whitespace-pre-wrap text-pretty">{lead.observation}</span> : emptyText}
              </Shell>
            );
          }
          return (
            <Shell key={key} ref={setRef} cell={cell} editable={canEdit} onOpen={() => open(key)} empty={!shown[key]}>
              {shown[key] || emptyText}
            </Shell>
          );
        })}
      </div>
    </section>
  );
}
