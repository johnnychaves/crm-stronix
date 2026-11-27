import { useState } from 'react';
import { Camera, ChevronLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLink } from '../../../components/nav/AppLink.jsx';
import { PhotoCaptureMenu } from '../../../components/profile/PhotoCaptureMenu.jsx';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { storage, appId } from '../../../lib/firebase.js';
import { uploadProfessorPhoto, deleteProfessorPhoto } from '../../../lib/professorPhoto.js';
import { admissaoDe, dataBR, desligadoEmTexto, faltasDaFicha, fotoDe, naEquipeTexto, periodoNaEquipe } from '../../../lib/equipe/ficha.js';
import { apagarFotoDaEquipe, gravarBloco, gravarProfessor, subirFotoDaEquipe } from '../../../lib/equipe/equipeWrites.js';
import { professorModalityNames } from '../../../lib/professores.js';
import { AcessoSelo, FichaAnel, FuncaoSelo, PessoaAvatar, VinculoSelo } from './equipeVisual.jsx';
import { FichaDados } from './FichaDados.jsx';
import { FichaMovimentacoes } from './FichaMovimentacoes.jsx';
import { FichaAcesso } from './FichaAcesso.jsx';

// A ficha em página própria (mockup A). A aba mora no endereço: `aba` vem do
// screenState e `onAba` troca o endereço com replace. O título da aba do
// navegador continua "Configurações", sem o nome da pessoa. O menu de foto é
// um só, daqui: a câmera do cabeçalho e o "Foto" da Identidade abrem o mesmo.
export function EquipeFicha({
  db, appUser, tenantId, pessoa, aba, onAba, voltarHref, modalities, professores, leads, professorEnabled, agora = new Date(),
  onEditarAcesso, onTirarAcesso, onDarAcesso, onLeadsChanged, acoesDaFicha = null, acoesDasMovimentacoes = null,
}) {
  const toast = useToast();
  const fichaId = pessoa.id; // chave do formulário: outra pessoa, outro formulário
  const [fotoAberta, setFotoAberta] = useState(false);
  const { total, faltam } = faltasDaFicha(pessoa);
  const admissao = admissaoDe(pessoa.ficha);
  const periodo = pessoa.desligada ? periodoNaEquipe(pessoa.ficha) : null;
  const mods = pessoa.funcao === 'professor' ? professorModalityNames(pessoa.professor, modalities) : [];
  const autor = { id: appUser?.id ?? null, nome: appUser?.name ?? null };
  const fotoAtual = fotoDe(pessoa);

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
        apagarFotoDaEquipe(pessoa.ficha?.foto?.path).catch(() => {});
      }
      toast.success('Foto removida.');
    } catch (e) {
      console.error('Erro ao remover a foto:', e?.code || e);
      toast.error('Não deu para remover a foto.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <AppLink to={voltarHref} className="inline-flex w-fit items-center gap-1 rounded text-[13px] font-semibold text-muted-foreground outline-none hover:text-brand-700 focus-visible:anel-foco">
        <ChevronLeft size={16} aria-hidden="true" />Equipe & acessos
      </AppLink>
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="relative flex-none">
          <PessoaAvatar pessoa={pessoa} size={72} />
          <button type="button" aria-label={fotoAtual ? 'Trocar foto' : 'Adicionar foto'} onClick={() => setFotoAberta(true)}
            className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm outline-none hover:text-brand-700 focus-visible:anel-foco">
            <Camera size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="min-w-[240px] flex-1">
          <h1 tabIndex={-1} className="font-display text-[26px] font-bold tracking-tight outline-none">{pessoa.nome}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <FuncaoSelo funcao={pessoa.funcao} />
            <VinculoSelo vinculo={pessoa.ficha?.vinculo} />
            {mods.map((m) => <span key={m} className="inline-flex h-6 items-center rounded-[7px] border border-border px-2.5 text-[12px] font-semibold">{m}</span>)}
            <span className="ml-1.5"><AcessoSelo acesso={pessoa.acesso} textoDesligado={pessoa.desligada ? desligadoEmTexto(pessoa.ficha) : null} /></span>
          </div>
          <p className="mt-2 text-[13px]">
            {periodo ? (periodo.de ? `Esteve na equipe de ${dataBR(periodo.de)} a ${dataBR(periodo.ate)}` : `Saiu da equipe em ${dataBR(periodo.ate)}`)
              : admissao ? naEquipeTexto(admissao, agora) : <span className="text-muted-foreground">Sem data de admissão</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FichaAnel ok={total - faltam.length} total={total} size={54} />
          {acoesDaFicha}
        </div>
      </header>

      <Tabs value={aba} onValueChange={onAba}>
        <TabsList aria-label="Ficha">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
          <TabsTrigger value="acesso">Acesso ao app</TabsTrigger>
        </TabsList>
        {/* Montada mesmo escondida: trocar de aba não perde o bloco aberto. */}
        <TabsContent value="dados" forceMount hidden={aba !== 'dados'} tabIndex={-1} className="mt-4">
          <FichaDados
            key={fichaId}
            db={db} appUser={appUser} tenantId={tenantId} pessoa={pessoa} professores={professores} modalities={modalities}
            professorEnabled={professorEnabled} leads={leads} agora={agora} onLeadsChanged={onLeadsChanged} onFoto={() => setFotoAberta(true)} />
        </TabsContent>
        <TabsContent value="movimentacoes" tabIndex={-1} className="mt-4"><FichaMovimentacoes pessoa={pessoa} acoes={acoesDasMovimentacoes} /></TabsContent>
        <TabsContent value="acesso" tabIndex={-1} className="mt-4">
          <FichaAcesso pessoa={pessoa} professorEnabled={professorEnabled} onEditarAcesso={onEditarAcesso} onTirarAcesso={onTirarAcesso} onDarAcesso={onDarAcesso} />
        </TabsContent>
      </Tabs>

      {fotoAberta && (
        <PhotoCaptureMenu open={fotoAberta} onClose={() => setFotoAberta(false)} onPicked={salvarFoto} onRemove={fotoAtual ? removerFoto : null} />
      )}
    </div>
  );
}
