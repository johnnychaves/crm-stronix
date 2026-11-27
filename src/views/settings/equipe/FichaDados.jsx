import { useEffect, useId, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { AppLink } from '../../../components/nav/AppLink.jsx';
import { AddressForm, Fld } from '../../../components/profile/cadastro/CadastroForms.jsx';
import { RadioGroup, RadioGroupOption } from '@/components/ui/radio-group';
import { isClientLead } from '../../../lib/leads.js';
import { formatCPF, formatPhone } from '../../../lib/masks.js';
import { hrefFor } from '../../../lib/routes.js';
import { professorModalityNames } from '../../../lib/professores.js';
import { nivelTexto } from '../../../lib/professor/metas.js';
import { FUNCAO_TEXTO, VINCULOS, admissaoDe, dataBR, faltasDaFicha, fotoDe, formDoBloco, patchDoBloco, tempoDeCasa, vinculoTexto } from '../../../lib/equipe/ficha.js';
import { gravarBloco, gravarProfessor, renomearPessoa } from '../../../lib/equipe/equipeWrites.js';
import { FIELD_INPUT, SettingsBtn } from '../settingsBits.jsx';

// Siglas ficam em maiúsculas na linha "Falta".
const baixa = (t) => (/^[A-Z]{2,}$/.test(t) ? t : t.toLowerCase());
const SUCESSO = { identidade: 'Identidade salva.', contato: 'Contato salvo.', trabalho: 'Trabalho salvo.' };
const PRIMEIRO = 'input:not([aria-hidden]), select, textarea, [role="radio"]';
const TITULOS = { identidade: 'Identidade', contato: 'Contato', trabalho: 'Trabalho' };
const ITENS = { identidade: ['foto', 'cpf', 'rg', 'nascimento'], contato: ['celular', 'emailPessoal', 'endereco'], trabalho: ['vinculo', 'admissao', 'cref'] };
const LINK = 'rounded font-semibold text-brand-700 outline-none hover:underline focus-visible:anel-foco disabled:opacity-50 dark:text-brand-300';
const PILULA = 'h-9 rounded-full border px-3 text-[13px] font-semibold outline-none focus-visible:anel-foco';
const pilula = (on) => cn(PILULA, on ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'border-border bg-card text-muted-foreground');

function Linha({ rotulo, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted-foreground">{rotulo}</dt>
      <dd className={cn('mt-0.5 text-[13.5px] font-medium [overflow-wrap:anywhere]', !children && 'text-muted-foreground')}>{children || 'Não informado'}</dd>
    </div>
  );
}

// Os três blocos que editam no lugar, um por vez, como o Cadastro da ficha do
// lead. Cada bloco grava só as chaves dele (patchDoBloco). A linha "Falta:"
// abre o bloco do item com o cursor no campo.
export function FichaDados({ db, appUser, tenantId, pessoa, professores, modalities, professorEnabled, leads, agora, onLeadsChanged, onFoto }) {
  const toast = useToast();
  const uid = useId();
  const raiz = useRef(null);
  const [aberto, setAberto] = useState(null); // { bloco, form, erro, campo }
  const [salvando, setSalvando] = useState(false);
  const [foco, setFoco] = useState(null);
  const faltam = faltasDaFicha(pessoa).faltam;
  const autor = { id: appUser?.id ?? null, nome: appUser?.name ?? null };
  const f = pessoa.ficha || {};
  const prof = pessoa.funcao === 'professor';
  const erroId = `${uid}-erro`;

  // Para onde o foco vai depois do render: o campo pedido (ou o primeiro do
  // bloco), ou o Editar do bloco. Cada pedido é um objeto novo.
  const pedirFoco = (alvo) => setFoco({ ...alvo });
  useEffect(() => {
    const bloco = foco && raiz.current?.querySelector(`[data-bloco="${foco.bloco}"]`);
    if (!bloco) return;
    const alvo = foco.editar ? bloco.querySelector('[data-editar]')
      : (foco.campo === 'vinculo' ? bloco.querySelector('[role="radio"]') : foco.campo && bloco.querySelector(`[name="${foco.campo}"]`)) || bloco.querySelector(PRIMEIRO);
    alvo?.focus();
  }, [foco]);

  const abrir = (bloco, campo = null) => {
    setAberto({ bloco, form: formDoBloco(bloco, pessoa), erro: null, campo });
    pedirFoco({ bloco, campo });
  };
  const fechar = () => {
    const bloco = aberto?.bloco;
    setAberto(null);
    if (bloco) pedirFoco({ bloco, editar: true });
  };
  const set = (k, v) => setAberto((a) => ({ ...a, form: { ...a.form, [k]: v }, erro: null }));

  const salvar = async () => {
    const r = patchDoBloco(aberto.bloco, aberto.form, { pessoa, autor, agora, professores });
    if (r.erro) { setAberto((a) => ({ ...a, erro: r.erro, campo: r.campo })); pedirFoco({ bloco: aberto.bloco, campo: r.campo }); return; }
    setSalvando(true);
    let renomeando = false;
    try {
      if (aberto.bloco === 'identidade') {
        // Sempre: o renomearPessoa compara cada cópia e acerta o login ou o
        // professor que ficou com outro nome, inclusive depois de uma falha.
        const nome = r.ficha.nome;
        renomeando = Boolean((pessoa.user && pessoa.user.name !== nome) || (pessoa.professor && pessoa.professor.nome !== nome));
        if (await renomearPessoa(db, pessoa, nome)) onLeadsChanged?.();
      }
      await gravarBloco(db, pessoa, r.ficha, autor);
      if (r.professor && pessoa.professor) await gravarProfessor(db, pessoa.professor.id, r.professor);
      toast.success(SUCESSO[aberto.bloco]);
      fechar();
    } catch (e) {
      console.error('Erro ao salvar a ficha:', e?.code || e);
      // A troca de nome copia nos leads antes de gravar: se caiu no meio, eles podem ter mudado.
      if (renomeando) onLeadsChanged?.();
      setAberto((a) => ({ ...a, erro: 'Não deu para salvar. Tente de novo.', campo: null }));
      pedirFoco({ bloco: aberto.bloco, campo: null });
    } finally {
      setSalvando(false);
    }
  };

  const campo = (rotulo, nome, { mascara = null, ...props } = {}) => (
    <Fld label={rotulo}>
      <input name={nome} className={FIELD_INPUT} autoComplete="off"
        aria-invalid={aberto.erro && aberto.campo === nome ? true : undefined} aria-describedby={aberto.erro && aberto.campo === nome ? erroId : undefined}
        value={aberto.form[nome] ?? ''} onChange={(e) => set(nome, mascara ? mascara(e.target.value) : e.target.value)} {...props} />
    </Fld>
  );

  const bloco = (id, leitura, formulario) => {
    const editando = aberto?.bloco === id;
    const pend = faltam.filter((x) => ITENS[id].includes(x.id)).map((x) => baixa(x.label));
    return (
      <section data-bloco={id} aria-label={TITULOS[id]} className={cn('rounded-2xl border bg-card p-4 shadow-card', editando ? 'border-brand-300 dark:border-brand-500/50' : 'border-border')}>
        <header className="flex items-center gap-3">
          <h3 className="flex-1 font-display text-[15px] font-bold">{TITULOS[id]}</h3>
          {!editando && (pend.length
            ? <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">Falta {pend.join(', ')}</span>
            : <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">Completo</span>)}
          {!editando && <SettingsBtn size={34} data-editar="" disabled={!!aberto} onClick={() => abrir(id)}>Editar</SettingsBtn>}
        </header>
        {editando ? (
          <form className="@container mt-3 flex flex-col gap-3" noValidate inert={salvando || undefined} onSubmit={(e) => { e.preventDefault(); salvar(); }}>
            {formulario}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {aberto.erro && <p id={erroId} role="alert" className="basis-full text-[12.5px] font-semibold text-rose-700 dark:text-rose-400">{aberto.erro}</p>}
              <p className="mr-auto text-[12.5px] text-muted-foreground">Os outros blocos esperam você salvar ou cancelar este.</p>
              <SettingsBtn size={36} type="button" onClick={fechar}>Cancelar</SettingsBtn>
              <SettingsBtn size={36} kind="primary" type="submit" disabled={salvando}>{salvando ? 'Salvando…' : `Salvar ${TITULOS[id].toLowerCase()}`}</SettingsBtn>
            </div>
          </form>
        ) : (
          <dl className="mt-3 grid gap-x-5 gap-y-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">{leitura}</dl>
        )}
      </section>
    );
  };

  const admissao = admissaoDe(f);
  const end = f.endereco;
  const alunos = prof && pessoa.professor ? (leads || []).filter((l) => l.professorId === pessoa.professor.id && isClientLead(l)).length : 0;
  const carteira = pessoa.funcao === 'consultor' && pessoa.user ? (leads || []).filter((l) => l.consultantId === pessoa.user.id).length : null;
  const fotoAtual = fotoDe(pessoa);

  return (
    <div ref={raiz} className="flex flex-col gap-4">
      <p className="text-[13px]">
        {faltam.length ? (
          <>Falta: {faltam.map((x, i) => (
            <span key={x.id}>{i > 0 && ', '}
              <button type="button" className={LINK} disabled={!!aberto}
                onClick={() => (x.id === 'foto' ? onFoto() : abrir(x.bloco, x.id === 'endereco' ? 'cep' : x.id))}>{x.label}</button>
            </span>
          ))}</>
        ) : <span className="font-semibold text-emerald-700 dark:text-emerald-300">Ficha completa</span>}
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        {bloco('identidade', (
          <>
            <Linha rotulo="Nome completo">{f.nome || pessoa.nome}</Linha>
            <Linha rotulo="CPF">{f.cpf && formatCPF(f.cpf)}</Linha>
            <Linha rotulo="RG">{f.rg}</Linha>
            <Linha rotulo="Nascimento">{f.nascimento && dataBR(f.nascimento)}</Linha>
            <div className="min-w-0">
              <dt className="text-[12px] text-muted-foreground">Foto</dt>
              <dd className="mt-0.5"><button type="button" onClick={onFoto} className={cn(LINK, 'inline-flex items-center gap-1.5 text-[13px]')}><Camera size={14} aria-hidden="true" />{fotoAtual ? 'Trocar foto' : 'Adicionar foto'}</button></dd>
            </div>
          </>
        ), aberto?.bloco === 'identidade' && (
          <>
            {campo('Nome completo', 'nome')}
            <div className="grid gap-3 sm:grid-cols-2">{campo('CPF', 'cpf', { inputMode: 'numeric', placeholder: '000.000.000-00', mascara: formatCPF })}{campo('RG', 'rg')}</div>
            <div className="grid gap-3 sm:grid-cols-2">{campo('Nascimento', 'nascimento', { type: 'date' })}</div>
          </>
        ))}

        {bloco('contato', (
          <>
            <Linha rotulo="Celular">{f.celular && formatPhone(f.celular)}</Linha>
            <Linha rotulo="E-mail pessoal">{f.emailPessoal}</Linha>
            <div className="col-span-full min-w-0">
              <Linha rotulo="Endereço">{end && [end.street, end.number, end.complement, end.neighborhood, end.city && `${end.city}${end.state ? `/${end.state}` : ''}`, end.cep].filter(Boolean).join(', ')}</Linha>
            </div>
          </>
        ), aberto?.bloco === 'contato' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">{campo('Celular', 'celular', { inputMode: 'tel', placeholder: '(51) 9 0000-0000', mascara: formatPhone })}{campo('E-mail pessoal', 'emailPessoal', { type: 'email' })}</div>
            <AddressForm form={aberto.form} set={set} setForm={(fn) => setAberto((a) => (a?.bloco === 'contato' ? { ...a, form: typeof fn === 'function' ? fn(a.form) : fn } : a))} />
          </>
        ))}

        <div className="xl:col-span-2">
          {bloco('trabalho', (
            <>
              <Linha rotulo="Função">{FUNCAO_TEXTO[pessoa.funcao]}</Linha>
              <Linha rotulo="Vínculo">{f.vinculo && vinculoTexto(f.vinculo)}</Linha>
              <Linha rotulo="Admissão">{admissao && `${dataBR(admissao)} (${tempoDeCasa(admissao, agora)})`}</Linha>
              {prof && <Linha rotulo="Modalidades">{professorModalityNames(pessoa.professor, modalities).join(' e ')}</Linha>}
              {prof && f.vinculo !== 'estagio' && <Linha rotulo="CREF">{f.cref}</Linha>}
              {prof && professorEnabled && <Linha rotulo="Nível no Stronix 2.0">{pessoa.professor && (<>{nivelTexto(pessoa.professor.nivel)} <AppLink to={hrefFor(tenantId, 'professorPerfil', { profId: pessoa.professor.id })} className={cn(LINK, 'ml-1')}>Ver perfil</AppLink></>)}</Linha>}
              {prof && <Linha rotulo="Alunos na carteira">{String(alunos)}</Linha>}
              {carteira !== null && <Linha rotulo="Leads na carteira">{String(carteira)}</Linha>}
            </>
          ), aberto?.bloco === 'trabalho' && (
            <>
              <div className="flex flex-col gap-1.5">
                <span id={`${uid}-vinculo`} className="text-[12.5px] font-medium text-muted-foreground">Vínculo</span>
                <RadioGroup aria-labelledby={`${uid}-vinculo`} value={aberto.form.vinculo} onValueChange={(v) => set('vinculo', v)} className="flex flex-wrap gap-2">
                  {VINCULOS.map((v) => <RadioGroupOption key={v.id} value={v.id} className={pilula(aberto.form.vinculo === v.id)}>{v.label}</RadioGroupOption>)}
                </RadioGroup>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {campo('Admissão', 'admissao', { type: 'date' })}
                {prof && aberto.form.vinculo !== 'estagio' && campo('CREF', 'cref', { placeholder: '000000-G/RS' })}
              </div>
              {prof && (
                <div className="flex flex-col gap-1.5">
                  <span id={`${uid}-mods`} className="text-[12.5px] font-medium text-muted-foreground">Modalidades em que dá aula</span>
                  <div role="group" aria-labelledby={`${uid}-mods`} className="flex flex-wrap gap-2">
                    {(modalities || []).map((m) => {
                      const on = aberto.form.modalidadeIds.includes(m.id);
                      return (
                        <button key={m.id} type="button" aria-pressed={on} className={pilula(on)}
                          onClick={() => set('modalidadeIds', on ? aberto.form.modalidadeIds.filter((x) => x !== m.id) : [...aberto.form.modalidadeIds, m.id])}>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ))}
        </div>
      </div>

    </div>
  );
}
