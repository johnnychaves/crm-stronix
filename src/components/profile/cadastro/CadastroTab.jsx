import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { zapMatchKey } from '../../../../api/_zapPhone.js';
import { LOCKED_HINT, capFirst, headlineOf, isComplete, missingOf, readSectionForm, sectionIssue } from '../../../lib/cadastroSections.js';
import { computeCompleteness, readClientRegistration } from '../../../lib/clientRegistration.js';
import { firstName } from '../../../lib/guardian.js';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { findDuplicateLeadRemote } from '../../../hooks/useDuplicateLead.js';
import { CadastroSection } from './CadastroSection.jsx';
import { SectionForm } from './CadastroForms.jsx';
import { CompletenessRing } from './CompletenessRing.jsx';

// A aba Cadastro da ficha. Abre na leitura: anel com a porcentagem, os itens
// que faltam como atalhos e quatro cartões. Uma seção abre por vez; cada uma lê
// o lead quando abre e entrega o formulário dela ao onSave(sectionId, form), que
// grava só as chaves da seção (cadastroWrites.js). O onSave devolve false quando
// não gravou, e a seção continua aberta com o que foi digitado.
//
// `request` ({ sectionId, field, at }) abre a aba já numa seção e num campo
// (lápis do cabeçalho, "Fez 18 anos"). Quem monta a aba põe `key` no `at`.
//
// Foco: abrir uma seção leva o cursor ao campo pedido (ou ao primeiro da seção),
// e fechar devolve o foco ao Editar dela. Os dois botões que abriram somem com a
// abertura, e sem isto o foco cairia no body.
export function CadastroTab({ lead, db, request = null, onSave }) {
  const toast = useToast();
  const [editing, setEditing] = useState(request?.sectionId ?? null);
  const [form, setForm] = useState(() => (request?.sectionId ? readSectionForm(lead, request.sectionId) : null));
  const [saving, setSaving] = useState(false);

  // Para onde o foco vai no próximo commit: { id, field } é um campo da seção
  // (ou o primeiro, sem field), e { id, edit: true } é o Editar dela. O número
  // pede a mudança, porque a seção pode continuar aberta (falha ao gravar).
  const sectionEls = useRef({});
  const focusNext = useRef(request?.sectionId ? { id: request.sectionId, field: request.field ?? null } : null);
  const [focusSeq, setFocusSeq] = useState(0);
  const moveFocus = (target) => { focusNext.current = target; setFocusSeq((n) => n + 1); };
  useEffect(() => {
    const next = focusNext.current;
    focusNext.current = null;
    const root = next && sectionEls.current[next.id];
    if (!root) return;
    const target = next.edit
      ? root.querySelector('[data-cadastro-edit]')
      : (next.field && root.querySelector(`[name="${next.field}"]`)) || root.querySelector('input, select, textarea');
    target?.focus();
  }, [focusSeq]);

  const whole = useMemo(() => readClientRegistration(lead), [lead]);
  const pct = computeCompleteness(whole);
  const missing = missingOf(whole);
  const busy = editing !== null;

  const startEdit = (sectionId, field = null) => {
    if (busy) return;
    setForm(readSectionForm(lead, sectionId));
    setEditing(sectionId);
    moveFocus({ id: sectionId, field });
  };
  const close = () => {
    const id = editing;
    setEditing(null);
    setForm(null);
    moveFocus({ id, edit: true });
  };

  const save = async () => {
    const id = editing;
    const issue = sectionIssue(id, form);
    if (issue) { toast.warning(issue); return; }
    setSaving(true);
    // Sem gravar, a seção fica aberta e o foco volta a ela: o Salvar desligado
    // durante a gravação o tinha soltado.
    let after = { id, field: null };
    try {
      if (id === 'identidade' && zapMatchKey(form.whatsapp) !== zapMatchKey(lead.whatsapp)) {
        // Conferência fresca: o aviso do campo tem debounce, e o número pode ter
        // virado de outro lead com a seção aberta.
        const dup = await findDuplicateLeadRemote({ db, phoneDigits: String(form.whatsapp || '').replace(/\D/g, ''), excludeId: lead.id });
        if (dup) {
          const ownerLabel = dup.consultantName ? ` (consultor: ${dup.consultantName})` : '';
          toast.warning(`Esse WhatsApp já é de outro lead: ${dup.name}${ownerLabel}.`);
          after = { id, field: 'whatsapp' };
          return;
        }
      }
      const ok = await onSave(id, form);
      if (ok !== false) after = null;
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar o cadastro. Tente novamente.');
    } finally {
      setSaving(false);
      if (after) moveFocus(after); else close();
    }
  };

  const card = (id) => (
    <CadastroSection
      id={id}
      whole={whole}
      editing={editing === id}
      locked={busy && editing !== id}
      saving={saving}
      canSave={id !== 'identidade' || Boolean(String(form?.name ?? '').trim())}
      onEdit={() => startEdit(id)}
      onAdd={(field) => startEdit(id, field)}
      onCancel={close}
      onSave={save}
      sectionRef={(el) => { sectionEls.current[id] = el; }}
    >
      {editing === id && form && (
        <SectionForm sectionId={id} form={form} setForm={setForm} lead={lead} db={db} />
      )}
    </CadastroSection>
  );

  return (
    <div className="@container flex flex-col gap-4">
      <section aria-label="Resumo do cadastro" className="flex items-center gap-5 rounded-2xl border border-border bg-card px-6 py-5 shadow-card">
        <CompletenessRing pct={pct} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] font-semibold tracking-tight">{headlineOf(whole)}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {isComplete(whole)
              ? `${firstName(lead.name) || 'O cadastro'} tem todos os dados que a academia pede.`
              : missing.length
                ? 'Clique em um item para preencher agora.'
                : 'Preencha o dado que falta na seção Identidade.'}
          </p>
          {missing.length > 0 && (
            <div role="group" aria-label="Dados que faltam" className="mt-3 flex flex-wrap gap-1.5">
              {missing.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={busy}
                  onClick={() => startEdit(m.section, m.field)}
                  title={busy ? LOCKED_HINT : undefined}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-brand-300 px-2.5 text-[12.5px] font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:anel-foco disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500/40 dark:text-brand-300 dark:hover:bg-brand-500/10"
                >
                  <Plus size={12} aria-hidden="true" />
                  {capFirst(m.label)}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Duas colunas explícitas: a identidade é longa e o resto se reparte, sem
          vão no meio. A quebra é pelo espaço da aba, e não pela janela. */}
      <div className="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">{card('identidade')}{card('emergencia')}</div>
        <div className="flex min-w-0 flex-col gap-4">{card('endereco')}{card('pessoais')}</div>
      </div>
    </div>
  );
}
