import { ChevronLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLink } from '../../../components/nav/AppLink.jsx';
import { admissaoDe, dataBR, faltasDaFicha, tempoDeCasa } from '../../../lib/equipe/ficha.js';
import { professorModalityNames } from '../../../lib/professores.js';
import { AcessoSelo, FichaAnel, FuncaoSelo, PessoaAvatar, VinculoSelo } from './equipeVisual.jsx';
import { FichaDados } from './FichaDados.jsx';
import { FichaMovimentacoes } from './FichaMovimentacoes.jsx';
import { FichaAcesso } from './FichaAcesso.jsx';

// A ficha em página própria (mockup A). A aba mora no endereço: `aba` vem do
// screenState e `onAba` troca o endereço com replace. O título da aba do
// navegador continua "Configurações", sem o nome da pessoa.
export function EquipeFicha({
  db, appUser, pessoa, aba, onAba, voltarHref, modalities, professores, leads, professorEnabled, agora = new Date(),
  onEditarAcesso, onTirarAcesso, onDarAcesso, onLeadsChanged, acoesDaFicha = null, acoesDasMovimentacoes = null,
}) {
  const { total, faltam } = faltasDaFicha(pessoa);
  const admissao = admissaoDe(pessoa.ficha);
  const mods = pessoa.funcao === 'professor' ? professorModalityNames(pessoa.professor, modalities) : [];

  return (
    <div className="flex flex-col gap-4">
      <AppLink to={voltarHref} className="inline-flex w-fit items-center gap-1 rounded text-[13px] font-semibold text-muted-foreground outline-none hover:text-brand-700 focus-visible:anel-foco">
        <ChevronLeft size={16} aria-hidden="true" />Equipe & acessos
      </AppLink>
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <PessoaAvatar pessoa={pessoa} size={72} />
        <div className="min-w-[240px] flex-1">
          <h1 className="font-display text-[26px] font-bold tracking-tight">{pessoa.nome}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <FuncaoSelo funcao={pessoa.funcao} />
            <VinculoSelo vinculo={pessoa.ficha?.vinculo} />
            {mods.map((m) => <span key={m} className="inline-flex h-6 items-center rounded-[7px] border border-border px-2.5 text-[12px] font-semibold">{m}</span>)}
            <span className="ml-1.5"><AcessoSelo acesso={pessoa.acesso} /></span>
          </div>
          <p className="mt-2 text-[13px]">
            {admissao ? <>Na equipe desde <b className="font-semibold">{dataBR(admissao)}</b>, há {tempoDeCasa(admissao, agora)}</> : <span className="text-muted-foreground">Sem data de admissão</span>}
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
        <TabsContent value="dados" tabIndex={-1} className="mt-4">
          <FichaDados db={db} appUser={appUser} pessoa={pessoa} professores={professores} modalities={modalities}
            professorEnabled={professorEnabled} leads={leads} agora={agora} onLeadsChanged={onLeadsChanged} />
        </TabsContent>
        <TabsContent value="movimentacoes" tabIndex={-1} className="mt-4"><FichaMovimentacoes pessoa={pessoa} acoes={acoesDasMovimentacoes} /></TabsContent>
        <TabsContent value="acesso" tabIndex={-1} className="mt-4">
          <FichaAcesso pessoa={pessoa} professorEnabled={professorEnabled} onEditarAcesso={onEditarAcesso} onTirarAcesso={onTirarAcesso} onDarAcesso={onDarAcesso} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
