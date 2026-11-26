import { useState } from 'react';
import { Camera } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { AddressForm } from '../../../components/profile/cadastro/CadastroForms.jsx';
import { PhotoCaptureMenu } from '../../../components/profile/PhotoCaptureMenu.jsx';
import { storage, appId } from '../../../lib/firebase.js';
import { uploadProfessorPhoto, deleteProfessorPhoto } from '../../../lib/professorPhoto.js';
import { professorModalityNames } from '../../../lib/professores.js';
import { nivelTexto } from '../../../lib/professor/metas.js';
import { FUNCAO_TEXTO, VINCULOS, admissaoDe, dataBR, faltasDaFicha, formDoBloco, patchDoBloco, tempoDeCasa, vinculoTexto } from '../../../lib/equipe/ficha.js';
import { apagarFotoDaEquipe, gravarBloco, gravarProfessor, renomearPessoa, subirFotoDaEquipe } from '../../../lib/equipe/equipeWrites.js';
import { DialogField, FIELD_INPUT, SettingsBtn } from '../settingsBits.jsx';

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
export function FichaDados({ db, appUser, pessoa, professores, modalities, professorEnabled, leads, agora, onLeadsChanged }) {
  const toast = useToast();
  const [aberto, setAberto] = useState(null); // { bloco, form, erro, campo }
  const [salvando, setSalvando] = useState(false);
  const [fotoAberta, setFotoAberta] = useState(false);
  const faltam = faltasDaFicha(pessoa).faltam;
  const autor = { id: appUser?.id ?? null, nome: appUser?.name ?? null };
  const f = pessoa.ficha || {};
  const prof = pessoa.funcao === 'professor';

  const abrir = (bloco, campo = null) => setAberto({ bloco, form: formDoBloco(bloco, pessoa), erro: null, campo });
  const set = (k, v) => setAberto((a) => ({ ...a, form: { ...a.form, [k]: v }, erro: null }));

  const salvar = async () => {
    const r = patchDoBloco(aberto.bloco, aberto.form, { pessoa, autor, agora, professores });
    if (r.erro) { setAberto((a) => ({ ...a, erro: r.erro, campo: r.campo })); return; }
    setSalvando(true);
    let renomeando = false;
    try {
      if (aberto.bloco === 'identidade' && r.ficha.nome !== pessoa.nome) {
        renomeando = true;
        if (await renomearPessoa(db, pessoa, r.ficha.nome)) onLeadsChanged?.();
      }
      await gravarBloco(db, pessoa, r.ficha, autor);
      if (r.professor && pessoa.professor) await gravarProfessor(db, pessoa.professor.id, r.professor);
      toast.success(`${TITULOS[aberto.bloco]} salva.`);
      setAberto(null);
    } catch (e) {
      console.error('Erro ao salvar a ficha:', e?.code || e);
      // A troca de nome copia nos leads antes de gravar: se caiu no meio, eles podem ter mudado.
      if (renomeando) onLeadsChanged?.();
      setAberto((a) => ({ ...a, erro: 'Não deu para salvar. Tente de novo.' }));
    } finally {
      setSalvando(false);
    }
  };

  const salvarFoto = async (blob) => {
    try {
      if (pessoa.professor) {
        const { url, path } = await uploadProfessorPhoto(storage, appId, pessoa.professor.id, blob);
        await gravarProfessor(db, pessoa.professor.id, { photoUrl: url, photoPath: path });
      } else {
        await gravarBloco(db, pessoa, { foto: await subirFotoDaEquipe(pessoa.id, blob) }, autor);
      }
      toast.success('Foto atualizada.');
    } catch (e) {
      console.error('Erro ao salvar a foto:', e?.code || e);
      toast.error(e?.code === 'storage/unauthorized' ? 'Sem permissão no Storage. Publique as regras no console do Firebase.' : 'Não deu para salvar a foto. Tente de novo.');
    }
  };
  const removerFoto = async () => {
    try {
      if (pessoa.professor) {
        await gravarProfessor(db, pessoa.professor.id, { photoUrl: null, photoPath: null });
        deleteProfessorPhoto(storage, pessoa.professor.photoPath).catch(() => {});
      } else {
        await gravarBloco(db, pessoa, { foto: null }, autor);
        apagarFotoDaEquipe(f.foto?.path).catch(() => {});
      }
      toast.success('Foto removida.');
    } catch (e) {
      console.error('Erro ao remover a foto:', e?.code || e);
      toast.error('Não deu para remover a foto.');
    }
  };

  const campo = (rotulo, nome, props = {}) => (
    <DialogField label={rotulo}>
      <input name={nome} className={FIELD_INPUT} autoComplete="off" autoFocus={aberto?.campo === nome || undefined}
        value={aberto.form[nome] ?? ''} onChange={(e) => set(nome, e.target.value)} {...props} />
    </DialogField>
  );

  const bloco = (id, leitura, formulario) => {
    const editando = aberto?.bloco === id;
    const pend = faltam.filter((x) => ITENS[id].includes(x.id)).map((x) => x.label.toLowerCase());
    return (
      <section data-bloco={id} aria-label={TITULOS[id]} className={cn('rounded-2xl border bg-card p-4 shadow-card', editando ? 'border-brand-300 dark:border-brand-500/50' : 'border-border')}>
        <header className="flex items-center gap-3">
          <h3 className="flex-1 font-display text-[15px] font-bold">{TITULOS[id]}</h3>
          {!editando && (pend.length
            ? <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">Falta {pend.join(', ')}</span>
            : <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">Completo</span>)}
          {!editando && <SettingsBtn size={32} data-editar="" disabled={!!aberto} onClick={() => abrir(id)}>Editar</SettingsBtn>}
        </header>
        {editando ? (
          <form className="mt-3 flex flex-col gap-3" noValidate inert={salvando || undefined} onSubmit={(e) => { e.preventDefault(); salvar(); }}>
            {formulario}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {aberto.erro && <p role="alert" className="mr-auto text-[12.5px] font-semibold text-rose-700 dark:text-rose-400">{aberto.erro}</p>}
              <SettingsBtn size={36} type="button" onClick={() => setAberto(null)}>Cancelar</SettingsBtn>
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
  const alunos = prof && pessoa.professor ? (leads || []).filter((l) => l.professorId === pessoa.professor.id).length : 0;
  const fotoAtual = pessoa.professor ? pessoa.professor.photoUrl : f.foto?.url;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px]">
        {faltam.length ? (
          <>Falta: {faltam.map((x, i) => (
            <span key={x.id}>{i > 0 && ', '}
              <button type="button" className={LINK} disabled={!!aberto}
                onClick={() => (x.id === 'foto' ? setFotoAberta(true) : abrir(x.bloco, x.id === 'endereco' ? 'cep' : x.id))}>{x.label}</button>
            </span>
          ))}</>
        ) : <span className="font-semibold text-emerald-700 dark:text-emerald-300">Ficha completa</span>}
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        {bloco('identidade', (
          <>
            <Linha rotulo="Nome completo">{f.nome || pessoa.nome}</Linha>
            <Linha rotulo="CPF">{f.cpf && `${f.cpf.slice(0, 3)}.${f.cpf.slice(3, 6)}.${f.cpf.slice(6, 9)}-${f.cpf.slice(9)}`}</Linha>
            <Linha rotulo="RG">{f.rg}</Linha>
            <Linha rotulo="Nascimento">{f.nascimento && dataBR(f.nascimento)}</Linha>
            <div className="min-w-0">
              <dt className="text-[12px] text-muted-foreground">Foto</dt>
              <dd className="mt-0.5"><button type="button" onClick={() => setFotoAberta(true)} className={cn(LINK, 'inline-flex items-center gap-1.5 text-[13px]')}><Camera size={14} aria-hidden="true" />{fotoAtual ? 'Trocar foto' : 'Adicionar foto'}</button></dd>
            </div>
          </>
        ), aberto?.bloco === 'identidade' && (
          <>
            {campo('Nome completo', 'nome')}
            <div className="grid gap-3 sm:grid-cols-2">{campo('CPF', 'cpf', { inputMode: 'numeric', placeholder: '000.000.000-00' })}{campo('RG', 'rg')}</div>
            <div className="grid gap-3 sm:grid-cols-2">{campo('Nascimento', 'nascimento', { type: 'date' })}</div>
          </>
        ))}

        {bloco('contato', (
          <>
            <Linha rotulo="Celular">{f.celular}</Linha>
            <Linha rotulo="E-mail pessoal">{f.emailPessoal}</Linha>
            <div className="col-span-full min-w-0">
              <Linha rotulo="Endereço">{end && [end.street, end.number, end.complement, end.neighborhood, end.city && `${end.city}${end.state ? `/${end.state}` : ''}`, end.cep].filter(Boolean).join(', ')}</Linha>
            </div>
          </>
        ), aberto?.bloco === 'contato' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">{campo('Celular', 'celular', { inputMode: 'tel', placeholder: '(51) 99999-9999' })}{campo('E-mail pessoal', 'emailPessoal', { type: 'email' })}</div>
            <AddressForm form={aberto.form} set={set} setForm={(fn) => setAberto((a) => ({ ...a, form: typeof fn === 'function' ? fn(a.form) : fn }))} />
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
              {prof && professorEnabled && <Linha rotulo="Nível no Stronix 2.0">{nivelTexto(pessoa.professor?.nivel)}</Linha>}
              {prof && <Linha rotulo="Alunos na carteira">{String(alunos)}</Linha>}
            </>
          ), aberto?.bloco === 'trabalho' && (
            <>
              <DialogField label="Vínculo">
                <div role="radiogroup" aria-label="Vínculo" className="flex flex-wrap gap-2">
                  {VINCULOS.map((v) => (
                    <button key={v.id} type="button" role="radio" aria-checked={aberto.form.vinculo === v.id} onClick={() => set('vinculo', v.id)} className={pilula(aberto.form.vinculo === v.id)}>{v.label}</button>
                  ))}
                </div>
              </DialogField>
              <div className="grid gap-3 sm:grid-cols-2">
                {campo('Admissão', 'admissao', { type: 'date' })}
                {prof && aberto.form.vinculo !== 'estagio' && campo('CREF', 'cref', { placeholder: '000000-G/RS' })}
              </div>
              {prof && (
                <DialogField label="Modalidades em que dá aula">
                  <div className="flex flex-wrap gap-2">
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
                </DialogField>
              )}
            </>
          ))}
        </div>
      </div>

      {fotoAberta && (
        <PhotoCaptureMenu open={fotoAberta} onClose={() => setFotoAberta(false)} onPicked={salvarFoto} onRemove={fotoAtual ? removerFoto : null} />
      )}
    </div>
  );
}
