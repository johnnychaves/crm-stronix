import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Calendar, Check, IdCard, Pencil, Phone, Plus, User, X } from 'lucide-react';
import { appId, LEADS_PATH } from '../lib/firebase.js';
import { isAdminUser } from '../lib/leads.js';
import { buildLeadSearchFields } from '../lib/leadDerived.js';
import { fromDateInputValue, toDateInputValue } from '../lib/dates.js';
import { cn } from '../lib/utils.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.jsx';
import { StyledInput, StyledSelect } from '../components/ui/Field.jsx';
import { Btn } from '../components/ui/Btn.jsx';

// Origens fixas do design (README seção 4). Mantém ordem do protótipo.
const SOURCES = ['Instagram', 'Indicação', 'Site', 'WhatsApp', 'Facebook', 'Google', 'Passou na porta', 'Outro'];

// ── Máscaras (dígitos internamente, formatação progressiva na UI) ──
// CPF: 000.000.000-00 (máx. 11 dígitos).
const formatCPF = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
};
// Telefone: (51) 9 0000-0000 (máx. 11 dígitos).
const formatPhone = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};

// Label de campo do protótipo (atoms.jsx → Field): sentence-case + asterisco
// laranja para obrigatório. Espelha o markup do handoff fielmente.
function FieldLabel({ children, required }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">{children}</span>
      {required && <span className="text-accent-500 text-[12px] leading-none">*</span>}
    </div>
  );
}

// Seção do formulário (protótipo: FormSection) — rótulo uppercase + borda inferior.
function FormSection({ label, children, last }) {
  return (
    <div className={cn('px-5 sm:px-6 py-5', !last && 'border-b border-slate-100 dark:border-white/[0.05]')}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3.5">{label}</div>
      {children}
    </div>
  );
}

// Chip de etiqueta selecionável (protótipo: TagChip).
function TagChip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-200 whitespace-nowrap">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="text-slate-400 hover:text-slate-700 dark:hover:text-white -mr-0.5">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

// Input de etiquetas (protótipo: TagsInput) — chips digitáveis + sugestões.
// Trabalha sobre um array de nomes (string[]), igual ao protótipo.
function TagsInput({ tags, setTags, suggestions }) {
  const [val, setVal] = useState('');
  const add = () => {
    const v = val.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setVal('');
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 min-h-11 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] px-2.5 py-2 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 transition">
        {tags.map(t => <TagChip key={t} onRemove={() => setTags(tags.filter(x => x !== t))}>{t}</TagChip>)}
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); add(); }
            if (e.key === 'Backspace' && !val && tags.length) setTags(tags.slice(0, -1));
          }}
          placeholder={tags.length ? '' : 'Digite e pressione Enter…'}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-[13px] h-7 placeholder:text-slate-400"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.filter(s => !tags.includes(s)).slice(0, 5).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setTags([...tags, s])}
              className="text-[11px] font-medium px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 text-slate-500 hover:text-brand-600 hover:border-brand-300 dark:text-slate-400 dark:hover:text-brand-300 transition inline-flex items-center gap-1"
            >
              <Plus size={10} />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Modal autocontido de edição de cadastro do lead/cliente.
 * Extrai a lógica de gravação que vivia inline em LeadProfileView.renderEditDialog.
 *
 * Props: { open, onClose, lead, appUser, db, usersList, tags }
 * (appUser é usado para liberar a reatribuição de consultor apenas a admins —
 * a gravação resolve consultantName/consultantAuthUid via usersList.)
 */
function EditLeadModal({ open, onClose, lead, appUser, db, usersList, tags }) {
  const toast = useToast();
  // Só admin pode reatribuir o consultor responsável — a regra do Firestore só
  // permite trocar o dono (consultantAuthUid) sendo admin. Para os demais o
  // seletor vira leitura.
  const isAdmin = isAdminUser(appUser);
  // Estado inicializado DIRETO do lead (sem useEffect de re-sync: o modal é
  // remontado quando o lead muda, pois `lead` é prop e o modal só renderiza
  // quando aberto).
  const [editData, setEditData] = useState({
    name: lead.name || '',
    whatsapp: formatPhone(lead.whatsapp),
    source: lead.source || SOURCES[0],
    observation: lead.observation || '',
    tags: lead.tags || [],
    consultantId: lead.consultantId || '',
    birthDate: toDateInputValue(lead.birthDate),
    cpf: lead.cpf ? formatCPF(lead.cpf) : ''
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setEditData(prev => ({ ...prev, [k]: v }));

  // Sugestões de etiquetas: nomes cadastrados no tenant ainda não aplicados.
  const tagSuggestions = (tags || []).map(t => t.name);

  // Gravação byte-a-byte do antigo renderEditDialog: resolve consultantName a
  // partir do consultantId, converte birthDate (Timestamp/null) e cpf
  // (string mascarada / null), grava via updateDoc no doc do lead.
  const handleSave = async () => {
    setLoading(true);
    try {
      const finalData = { ...editData };
      // Reatribuição de consultor (só admin): grava os TRÊS campos juntos.
      // consultantAuthUid é a chave de permissão/atribuição (regras do Firestore,
      // ranking, contrato da matrícula) — gravar só consultantId/consultantName
      // deixaria o lead "split-brain" (dono visível ≠ dono real).
      if (isAdmin && finalData.consultantId) {
        const c = (usersList || []).find(u => u.id === finalData.consultantId);
        if (c) {
          finalData.consultantName = c.name;
          finalData.consultantAuthUid = c.authUid || null;
        }
      } else {
        // Não-admin não reatribui: descarta o consultantId do form para não
        // gravar um valor divergente do consultantAuthUid (que ele não pode trocar).
        delete finalData.consultantId;
      }
      finalData.birthDate = fromDateInputValue(editData.birthDate);
      finalData.cpf = (editData.cpf || '').trim() || null;
      // Dual-write: recomputa os campos de busca a partir dos valores que serão
      // efetivamente gravados (a edição pode ter mudado name/whatsapp/cpf).
      // finalData sempre carrega os três campos, então usamos seus valores
      // diretos — inclusive cpf: null quando o usuário limpou o CPF (um
      // `?? lead.cpf` restauraria os dígitos antigos e deixaria cpf/cpfDigits
      // inconsistentes). Sem withBucket: este patch não toca
      // status/lifecycleStage/isConverted, logo o lifecycleBucket não muda.
      const searchFields = buildLeadSearchFields({
        name: finalData.name,
        whatsapp: finalData.whatsapp,
        cpf: finalData.cpf,
      });
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id),
        { ...finalData, ...searchFields }
      );
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar as alterações. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="z-[210] max-w-2xl max-h-[88vh] overflow-y-auto p-0 gap-0"
        overlayClassName="z-[210]"
      >
        {/* Cabeçalho sticky (protótipo: ModalHeader, tone=brand) */}
        <DialogHeader className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] sticky top-0 bg-white/90 dark:bg-ink-900/90 backdrop-blur z-10 sm:rounded-t-2xl">
          <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <Pencil size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[17px] font-bold tracking-tight leading-tight font-display">Editar cadastro</DialogTitle>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate">{lead.name}</p>
          </div>
        </DialogHeader>

        {/* ── Identidade ── */}
        <FormSection label="Identidade">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldLabel required>Nome completo</FieldLabel>
              <StyledInput
                icon={<User size={15} />}
                value={editData.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Nome e sobrenome"
              />
            </div>
            <div>
              <FieldLabel>Data de nascimento</FieldLabel>
              <StyledInput
                type="date"
                icon={<Calendar size={15} />}
                value={editData.birthDate}
                onChange={e => set('birthDate', e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>CPF</FieldLabel>
              <StyledInput
                icon={<IdCard size={15} />}
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={editData.cpf}
                onChange={e => set('cpf', formatCPF(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel required>WhatsApp</FieldLabel>
              <StyledInput
                type="tel"
                icon={<Phone size={15} />}
                inputMode="numeric"
                placeholder="(51) 9 0000-0000"
                value={editData.whatsapp}
                onChange={e => set('whatsapp', formatPhone(e.target.value))}
              />
            </div>
          </div>
        </FormSection>

        {/* ── Relacionamento ── */}
        <FormSection label="Relacionamento">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Origem</FieldLabel>
              <StyledSelect value={editData.source} onChange={e => set('source', e.target.value)}>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </StyledSelect>
            </div>
            <div>
              <FieldLabel>Consultor responsável</FieldLabel>
              {isAdmin ? (
                <StyledSelect value={editData.consultantId} onChange={e => set('consultantId', e.target.value)}>
                  <option value="">Selecione um consultor...</option>
                  {(usersList || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </StyledSelect>
              ) : (
                <StyledInput value={lead.consultantName || '—'} disabled readOnly />
              )}
            </div>
          </div>
        </FormSection>

        {/* ── Etiquetas ── */}
        <FormSection label="Etiquetas">
          <TagsInput tags={editData.tags} setTags={(t) => set('tags', t)} suggestions={tagSuggestions} />
        </FormSection>

        {/* ── Observação ── */}
        <FormSection label="Observação" last>
          <textarea
            value={editData.observation}
            onChange={e => set('observation', e.target.value)}
            rows={3}
            placeholder="Contexto, preferências, histórico relevante…"
            className="w-full rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] focus:border-brand-400 dark:focus:border-brand-500/60 focus:ring-4 focus:ring-brand-500/10 outline-none text-[13.5px] p-3.5 placeholder:text-slate-400 resize-none transition"
          />
        </FormSection>

        {/* Rodapé sticky (protótipo) */}
        <div className="px-5 sm:px-6 py-4 flex items-center justify-end gap-2 sticky bottom-0 bg-white/90 dark:bg-ink-900/90 backdrop-blur sm:rounded-b-2xl">
          <Btn kind="soft" size="md" onClick={onClose} disabled={loading}>Cancelar</Btn>
          <Btn
            kind="brand"
            size="md"
            icon={<Check size={14} />}
            onClick={handleSave}
            disabled={loading || !editData.name.trim()}
          >
            {loading ? 'Salvando…' : 'Salvar alterações'}
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { EditLeadModal };
