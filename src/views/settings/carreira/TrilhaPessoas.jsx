import { useRef, useState } from 'react';
import { getSafeDateOrNull } from '../../../lib/dates.js';
import { foraDoPlano } from '../../../lib/carreira/trilhas.js';
import { Confirmacao } from '../../professores/Confirmacao.jsx';
import { SeloDoNivel } from '../../professores/ProfessoresTabela.jsx';
import { TrilhaNivelPopover } from '../../professores/TrilhaNivelPopover.jsx';

// A aba Pessoas da trilha (pedido do Johnny, 27/11/2026): quem está nela, com o
// nível e desde quando, o "Mudar nível" e o "Tirar do plano", e embaixo quem
// pode entrar, com o "Pôr na trilha". Cada ação grava na hora, no cadastro da
// pessoa, e não depende do Salvar trilha. `trilha` é a gravada, porque os
// níveis do rascunho ainda não existem para ninguém.
const CARTAO = 'overflow-hidden rounded-[18px] border border-border bg-card shadow-card';
const LINHA = 'flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-3 text-[13.5px] last:border-b-0';
const TIRAR = 'rounded text-[13px] font-semibold text-muted-foreground outline-none hover:text-rose-700 hover:underline focus-visible:anel-foco dark:hover:text-rose-300';

function ondeEsta(p, trilhas) {
  if (foraDoPlano(p)) return 'Fora do plano de carreira';
  const outra = (trilhas || []).find((t) => t.id === p.trilhaId);
  return outra ? `Na trilha ${outra.nome}` : 'Sem trilha';
}

// A prop é `quem`, e não `pessoa`: `pessoa` é nome de filtro do endereço, e a
// varredura filtrosNoEndereco reprova a palavra numa linha com key.
function Pessoa({ quem: pessoa, trilha, onGravar, onTirar }) {
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const tirarRef = useRef(null);
  const nivel = trilha.niveis.find((n) => n.id === pessoa.nivel) ?? null;
  const desde = getSafeDateOrNull(pessoa.nivelDesde)?.toLocaleDateString('pt-BR') ?? null;
  const voltar = () => {
    setConfirmar(false);
    requestAnimationFrame(() => tirarRef.current?.focus());
  };
  const tirar = async () => {
    setOcupado(true);
    const ok = await onTirar(pessoa);
    setOcupado(false);
    if (!ok) voltar();
  };
  return (
    <li className={LINHA}>
      <b className="min-w-[160px] flex-1 font-semibold">{pessoa.nome || 'Sem nome'}</b>
      <SeloDoNivel nome={nivel?.nome ?? null} desde={desde} />
      <TrilhaNivelPopover
        trilhas={[trilha]}
        trilhaId={trilha.id}
        nivel={pessoa.nivel}
        sugeridaId={trilha.id}
        rotulo={nivel ? 'Mudar nível' : 'Definir nível'}
        onSalvar={(dados) => onGravar(pessoa, dados)}
      />
      {!confirmar && (
        <button ref={tirarRef} type="button" onClick={() => setConfirmar(true)} className={TIRAR}>Tirar do plano</button>
      )}
      {confirmar && (
        <Confirmacao
          className="w-full"
          titulo={`Tirar ${pessoa.nome || 'esta pessoa'} do plano de carreira?`}
          texto="A pessoa sai da lista Carreira, deixa de contar nos níveis e perde o nível de agora. Para voltar, use o Pôr na trilha."
          acao="Tirar do plano"
          perigo
          ocupado={ocupado}
          onConfirmar={tirar}
          onVoltar={voltar}
        />
      )}
    </li>
  );
}

export function TrilhaPessoas({ trilha, trilhas, equipe, onGravar, onTirar }) {
  const { naTrilha, deFora } = equipe;
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="pessoas-na-trilha">
        <h2 id="pessoas-na-trilha" className="mb-2 text-[14px] font-semibold">
          Na trilha <span className="text-muted-foreground">({naTrilha.length})</span>
        </h2>
        {naTrilha.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-[13px] text-muted-foreground">Ninguém nesta trilha ainda. Ponha alguém pela lista de baixo.</p>
        ) : (
          <ul aria-label="Pessoas na trilha" className={`${CARTAO} m-0 list-none p-0`}>
            {naTrilha.map((p) => <Pessoa key={p.id} quem={p} trilha={trilha} onGravar={onGravar} onTirar={onTirar} />)}
          </ul>
        )}
        <p className="mt-2 text-[12.5px] text-muted-foreground">Cada mudança grava na hora, no cadastro da pessoa.</p>
      </section>

      {deFora.length > 0 && (
        <section aria-labelledby="pessoas-de-fora">
          <h2 id="pessoas-de-fora" className="mb-2 text-[14px] font-semibold">
            Pode entrar <span className="text-muted-foreground">({deFora.length})</span>
          </h2>
          <ul aria-label="Pessoas que podem entrar na trilha" className={`${CARTAO} m-0 list-none p-0`}>
            {deFora.map((p) => (
              <li key={p.id} className={LINHA}>
                <b className="min-w-[160px] flex-1 font-semibold">{p.nome || 'Sem nome'}</b>
                <span className="text-[12.5px] text-muted-foreground">{ondeEsta(p, trilhas)}</span>
                <TrilhaNivelPopover
                  trilhas={[trilha]}
                  trilhaId={null}
                  nivel={null}
                  sugeridaId={trilha.id}
                  rotulo="Pôr na trilha"
                  onSalvar={(dados) => onGravar(p, dados)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
