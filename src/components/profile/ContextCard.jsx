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
// falar com a pessoa. Quem grava é a ficha (onSave), um campo por vez, e devolve
// false quando não deu certo. Sem permissão de editar (canEdit falso), os campos
// são só leitura.
//
// Os cinco campos de escolha são listas do Radix, e a própria célula é o
// gatilho (ContextSelect). Etiquetas e observação abrem um editor no lugar. O
// editor aberto mora em `edit` ({ key, id, draft, opened, pending, saving }), que
// a ficha guarda (edit e setEdit) para o rascunho sobreviver à troca de aba; sem
// as duas props, o card guarda sozinho. `opened` é o valor da abertura: salvar
// sem mudar nada não grava, e as etiquetas gravam só a diferença. `pending` é a
// etiqueta digitada e ainda sem Enter. Com `saving`, o texto fica só para
// leitura: o que fosse digitado depois do Salvar sumiria quando o editor fecha.
const CELLS = [
  { key: 'dor', label: 'Dor', cls: '', emptyLabel: 'Sem dor' },
  { key: 'modalidade', label: 'Modalidade', cls: '', emptyLabel: 'Sem modalidade' },
  { key: 'source', label: 'Origem', cls: '' },
  { key: 'consultantId', label: 'Consultor', cls: '' },
  { key: 'professorId', label: 'Professor', cls: 'col-span-2 md:col-span-1', emptyLabel: 'Sem professor' },
  { key: 'tags', label: 'Etiquetas', cls: 'col-span-2', text: true },
  { key: 'observation', label: 'Observação', cls: 'col-span-2 md:col-span-3', text: true },
];

const CELL_BOX = 'min-w-0 border-l border-t border-border px-4 py-3.5 lg:px-6';
// Rótulo em cima e valor embaixo, presos no topo: o botão centraliza o conteúdo
// na vertical, e uma célula mais alta desalinhava os rótulos da linha. A palavra
// longa quebra com hífen (o index.html declara pt-BR).
const CELL_BODY = 'relative flex flex-col justify-start text-left hyphens-auto';
const EDITABLE = 'group transition hover:bg-slate-50 dark:hover:bg-white/[0.03] focus-visible:outline-none focus-visible:anel-foco focus-visible:ring-inset';
const LABEL = 'text-[12.5px] font-medium text-muted-foreground';
const valueClass = (empty, plain) =>
  cn('mt-1 block min-w-0 break-words text-[14px]', empty ? 'text-muted-foreground' : plain ? 'text-foreground' : 'font-semibold');

const pencil = (
  <Pencil
    size={13}
    aria-hidden="true"
    className="absolute right-3 top-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100 lg:right-4"
  />
);

// O valor gravado entra na lista mesmo fora do catálogo, senão o campo abriria em
// branco e a primeira escolha apagaria um dado que a pessoa nem viu.
const withCurrent = (list, current, label = current) =>
  (current && !list.some((o) => o.value === current) ? [...list, { value: current, label }] : list);

// Cada abertura de editor ganha um número. A resposta de uma gravação lenta só
// fecha o editor que a pediu, nunca um aberto depois, nem o mesmo campo reaberto.
let openSeq = 0;

export function ContextCard({ lead, sources = [], usersList = [], tagsCatalog = [], canEdit = false, onSave, edit: editProp, setEdit: setEditProp }) {
  const { dores, modalities, professores } = useGeneralConfig();
  const [ownEdit, setOwnEdit] = useState(null);
  const edit = setEditProp ? editProp : ownEdit;
  const setEdit = setEditProp || setOwnEdit;

  // O editor aberto, para quem roda depois de um await ler o de agora.
  const latest = useRef(edit);
  useEffect(() => { latest.current = edit; });

  // O botão do campo some quando o editor abre, e o editor some ao fechar: sem
  // isto o foco cairia no body. Ao abrir, o foco vai para o campo de digitar,
  // com o cursor no fim do texto; ao fechar, volta ao campo. Só ao abrir pelo
  // clique: o editor que reaparece na volta de outra aba não rouba o foco.
  const areaRef = useRef(null);
  const cellRefs = useRef({});
  const focusOnOpen = useRef(null);
  const returnFocusTo = useRef(null);
  const editKey = edit?.key ?? null;
  useEffect(() => {
    if (editKey && focusOnOpen.current === editKey) {
      focusOnOpen.current = null;
      const field = areaRef.current?.querySelector('textarea, input');
      field?.focus();
      if (field?.tagName === 'TEXTAREA') field.setSelectionRange(field.value.length, field.value.length);
      return;
    }
    if (!editKey && returnFocusTo.current) {
      cellRefs.current[returnFocusTo.current]?.focus();
      returnFocusTo.current = null;
    }
  }, [editKey]);

  // Quem pode receber o lead: gente ativa, com login, que vende. Passar para quem
  // saiu deixaria o lead órfão, e para um cadastro sem login, sem ninguém que o
  // edite. O professor não é dono de lead (isSeller, em src/lib/acesso.js).
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

  // A etiqueta digitada e ainda sem Enter entra no Salvar e conta como mudança.
  const withPending = (e, value) => {
    const p = e.key === 'tags' ? String(e.pending || '').trim() : '';
    return p && !value.includes(p) ? [...value, p] : value;
  };
  const sameAsOpened = (e, value) => (e.key === 'observation'
    ? String(value).trim() === String(e.opened).trim()
    : JSON.stringify(value) === JSON.stringify(e.opened));
  const focusField = () => areaRef.current?.querySelector('textarea, input')?.focus();

  const setDraft = (draft) => setEdit((cur) => (cur ? { ...cur, draft } : cur));
  const setPending = (pending) => setEdit((cur) => (cur ? { ...cur, pending } : cur));
  const open = (key) => {
    if (!canEdit) return;
    const cur = latest.current;
    // Trocar de campo com o rascunho mudado pergunta antes de descartar.
    if (cur && cur.key !== key && !sameAsOpened(cur, withPending(cur, cur.draft))) {
      const label = CELLS.find((c) => c.key === cur.key)?.label.toLowerCase();
      if (!window.confirm(`Descartar a alteração em ${label}?`)) { focusField(); return; }
    }
    const opened = key === 'tags' ? [...(lead.tags || [])] : (lead.observation || '');
    focusOnOpen.current = key;
    setEdit({ key, id: ++openSeq, draft: opened, opened });
  };
  const close = () => {
    returnFocusTo.current = latest.current?.key ?? null;
    setEdit(null);
  };
  const save = async (key) => {
    const cur = latest.current;
    if (!cur || cur.key !== key || cur.saving) return;
    const value = withPending(cur, cur.draft);
    if (sameAsOpened(cur, value)) { close(); return; }
    const mark = (saving) => setEdit((e) => (e?.id === cur.id ? { ...e, saving } : e));
    mark(true);
    const ok = await onSave(key, value, cur.opened);
    if (latest.current?.id !== cur.id) return;
    // Na falha, o editor fica aberto com o que foi digitado, e o foco volta a
    // ele: o Salvar desligado durante a gravação o tinha soltado.
    if (ok === false) { mark(false); focusField(); return; }
    close();
  };

  const editor = (cell) => {
    const { key } = cell;
    const footer = (hint) => (
      <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-[12px] text-muted-foreground">{hint}</span>
        <Btn kind="soft" size="sm" onClick={close} disabled={edit.saving}>Cancelar</Btn>
        <Btn kind="brand" size="sm" onClick={() => save(key)} disabled={edit.saving}>Salvar</Btn>
      </div>
    );
    return (
      <div
        key={key}
        ref={areaRef}
        onKeyDown={key === 'tags' ? (e) => { if (e.key === 'Escape') close(); } : undefined}
        className={cn(CELL_BOX, cell.cls)}
      >
        <span className={LABEL}>{cell.label}</span>
        <div className="mt-1.5">
          {key === 'tags' ? (
            <>
              <TagsInput
                tags={edit.draft}
                setTags={setDraft}
                pending={edit.pending}
                setPending={setPending}
                readOnly={Boolean(edit.saving)}
                suggestions={(tagsCatalog || []).map((t) => t.name)}
              />
              {footer('Enter acrescenta a etiqueta')}
            </>
          ) : (
            <>
              <textarea
                value={edit.draft}
                readOnly={Boolean(edit.saving)}
                rows={3}
                aria-label="Observação"
                placeholder="Contexto, preferências, histórico relevante."
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') close();
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(key); }
                }}
                className="w-full resize-none rounded-lg border border-border bg-card p-3 text-[13.5px] outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus-visible:anel-foco"
              />
              {footer('Ctrl e Enter salvam')}
            </>
          )}
        </div>
      </div>
    );
  };

  const readValue = (key) => {
    if (key === 'tags') {
      const list = lead.tags || [];
      return list.length === 0 ? null : (
        <span className="flex flex-wrap gap-1.5">
          {list.map((t) => <TagBadge key={t} tagName={t} tagsArray={tagsCatalog} />)}
        </span>
      );
    }
    if (key === 'observation') return lead.observation ? <span className="whitespace-pre-wrap text-pretty">{lead.observation}</span> : null;
    return shown[key] || null;
  };

  return (
    <section id="ficha-contexto" aria-label="Contexto comercial" className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
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
          const value = readValue(key);
          const plain = Boolean(cell.text);
          if (!canEdit) {
            return (
              <div key={key} className={cn(CELL_BOX, CELL_BODY, cell.cls)}>
                <span className={LABEL}>{cell.label}</span>
                <span className={valueClass(!value, plain)}>{value || emptyText}</span>
              </div>
            );
          }
          if (cell.text && edit?.key === key) return editor(cell);
          if (cell.text) {
            return (
              <button
                key={key}
                ref={(el) => { cellRefs.current[key] = el; }}
                type="button"
                onClick={() => open(key)}
                className={cn(CELL_BOX, CELL_BODY, EDITABLE, cell.cls)}
              >
                <span className="sr-only">Editar </span>
                <span className={LABEL}>{cell.label}</span>{' '}
                <span className={valueClass(!value, plain)}>{value || emptyText}</span>
                {pencil}
              </button>
            );
          }
          return (
            <ContextSelect
              key={key}
              label={cell.label}
              labelClassName={LABEL}
              display={value}
              valueClassName={valueClass(!value, false)}
              emptyText={emptyText}
              value={current[key]}
              options={options[key]}
              emptyLabel={cell.emptyLabel || null}
              onPick={(picked) => onSave(key, picked)}
              className={cn(CELL_BOX, CELL_BODY, EDITABLE, cell.cls)}
            >
              {pencil}
            </ContextSelect>
          );
        })}
      </div>
    </section>
  );
}
