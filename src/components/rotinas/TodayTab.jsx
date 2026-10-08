import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useFrozenWhileIdle, useMinuteClock } from '../../hooks/useMinuteClock.js';
import { useTeamRoutineMarks } from '../../hooks/useTeamRoutineMarks.js';
import { routineDayKey } from '../../lib/rotinas.js';
import { clockText, findSelection, frozenDayText, personDomId, taskDomId, teamToday, todayHeadline } from '../../lib/rotinasTela.js';
import { PersonDayCard } from './PersonDayCard.jsx';
import { TodayAside } from './TodayAside.jsx';

// Aba Hoje da tela Rotinas (spec 2026-10-06, "Aba Hoje"; mockup
// 2026-10-08-rotinas-aba-hoje.html, Hoje A · Por pessoa, sem a linha do dia
// no cartão de cada pessoa). O gestor acompanha a rotina da equipe: ele nunca
// marca nem desmarca o check de ninguém, e esta aba não importa nada de
// rotinasWrites.js. O relógio anda a cada minuto, como na Meta diária, e os
// checks de hoje da academia chegam por assinatura, presa ao portão de
// ociosidade. As contas moram em src/lib/rotinasTela.js. A tarefa escolhida
// fica no estado da aba, e não no endereço: é passageira, como um menu aberto.
//
// Com o portão de ociosidade fechado (listenersActive falso), as assinaturas
// param e o relógio seguiria andando: toda tarefa que o consultor fez depois da
// pausa viraria atrasada sozinha. Por isso a aba congela o instante em que as
// assinaturas pararam (useFrozenWhileIdle) e calcula tudo nele: os estados, a
// frase do topo, as atrasadas, a linha do agora e o dia da leitura. O topo diz
// "Atualizado às HH:MM" (e "Atualizado ontem às HH:MM" quando o relógio de
// verdade já passou da meia-noite), e a aba volta ao relógio de agora quando a
// pessoa mexe na tela e as assinaturas voltam.
export function TodayTab({ db, people, models, modelsLoading = false, tenantId, listenersActive = true, modelLink, onChooseModel }) {
  const clock = useMinuteClock();
  const now = useFrozenWhileIdle(clock, listenersActive);
  const { metaWeekdays = [1, 2, 3, 4, 5] } = useGeneralConfig();
  const { marks, loading, error } = useTeamRoutineMarks({ db, enabled: listenersActive, tenantId, dayKey: routineDayKey(now) });
  const [selected, setSelected] = useState(null); // { personId, taskId }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-[13.5px] shadow-card">
        Não deu para carregar os checks de hoje. Recarregue a página.
      </div>
    );
  }
  if (modelsLoading || loading) return <p className="py-6 text-[13.5px] text-muted-foreground">Carregando a rotina de hoje…</p>;

  const team = teamToday({ people, models, marksByPerson: marks, now, metaWeekdays });
  const headline = todayHeadline({ peopleCount: people.length, following: team.following, done: team.done, total: team.total, late: team.late });
  const detail = findSelection(team.cards, selected);
  const frozenDay = frozenDayText(now, clock);
  const toggle = (personId, taskId) =>
    setSelected((cur) => (cur?.personId === personId && cur?.taskId === taskId ? null : { personId, taskId }));
  // O Fechar desmonta o próprio botão, e o foco cairia no body. A tarefa que
  // estava aberta costuma estar na tela, então o foco vai para ela antes de
  // fechar. Se a linha dela saiu (o cartão da pessoa só diz quando a rotina
  // começa, depois de o consultor desfazer o único check), o foco vai para o
  // cartão da pessoa, que aceita foco por script (tabIndex -1).
  const close = () => {
    if (selected) {
      const row = document.getElementById(taskDomId(selected.personId, selected.taskId));
      (row ?? document.getElementById(personDomId(selected.personId)))?.focus();
    }
    setSelected(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="max-w-[640px] font-display text-[26px] font-medium leading-tight tracking-tight">
          {headline.map((part) => (part.em
            ? (
              <em
                key={part.text}
                className={cn('font-bold not-italic', part.em === 'late' ? 'text-rose-600 dark:text-rose-300' : 'text-brand-600 dark:text-brand-300')}
              >
                {part.text}
              </em>
            )
            : <span key={part.text}>{part.text}</span>))}
        </h1>
        <p data-relogio={listenersActive ? 'ao-vivo' : 'parado'} className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
          <span
            aria-hidden="true"
            className={cn(
              'size-[7px] shrink-0 rounded-full',
              listenersActive ? 'bg-emerald-600 ring-[3px] ring-emerald-600/15 dark:bg-emerald-400' : 'bg-muted-foreground/50',
            )}
          />
          {listenersActive
            ? <span className="whitespace-nowrap">Ao vivo · <span className="num">{clockText(now)}</span></span>
            : (
              <span>
                Atualizado{frozenDay && ` ${frozenDay}`} às <span className="num">{clockText(now)}</span> · mexa na tela para atualizar
              </span>
            )}
        </p>
      </div>

      {people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-[13px] text-muted-foreground">
          Cadastre os consultores em Configurações, em Equipe & acessos, e escolha o modelo de cada um na aba Modelos.
        </p>
      ) : (
        <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid items-start gap-3.5 xl:grid-cols-2">
            {team.cards.map((c) => (
              <PersonDayCard
                key={c.person.id}
                card={c}
                now={now}
                selectedTaskId={selected?.personId === c.person.id ? selected.taskId : null}
                onSelect={toggle}
                modelLink={modelLink}
                onChooseModel={onChooseModel}
              />
            ))}
          </div>
          <TodayAside team={team} detail={detail} now={now} onClose={close} />
        </div>
      )}
    </div>
  );
}
