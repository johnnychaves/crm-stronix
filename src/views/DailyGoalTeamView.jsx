import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Target } from 'lucide-react';
import { appId, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { DEFAULT_SLA_OVERDUE_DAYS } from '../lib/dailyGoal.js';
import { useTeamBoard } from './team/useTeamBoard.js';
import { TeamWings } from './team/TeamWings.jsx';
import { TeamDayTable } from './team/TeamDayTable.jsx';

// ============================================================================
// PAINEL DA EQUIPE — o gestor bate o olho e sabe se precisa chamar alguém.
//   • ASAS (cartão 1): as duas metas do MÊS por consultor, crescendo em
//     direções opostas a partir do nome. Barra curta de um lado só diz o
//     assunto da conversa. Mede só dias ENCERRADOS: hoje ainda está em curso e
//     contá-lo faria todo mundo começar a manhã devendo um dia que nem começou.
//   • RÉGUA: um botão por dia PROGRAMADO (folga é ausência, não célula vazia).
//     É a dobradiça — fecha o gráfico e abre a tabela.
//   • TABELA (cartão 2): o dia selecionado. A linha expande com a carteira
//     nominal do consultor e o extrato de prospecção. Nome abre a ficha.
//   ⚠️ Dia PASSADO guarda o resultado, não as tarefas: a linha não expande e a
//     coluna Meta vira bateu/não bateu. A tela anuncia isso em vez de esconder.
// LEITURA apenas: concluir tarefa é ato do consultor.
// ============================================================================

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function DailyGoalTeamView({
  leads, interactions, usersList, metaWeekdays,
  slaOverdueDays = DEFAULT_SLA_OVERDUE_DAYS,
  renewalCheckpoints = [90, 60, 30],
  db, appUser,
}) {
  const [teamHistory, setTeamHistory] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null); // null = hoje
  const [openId, setOpenId] = useState(null);

  // Relógio da tela em estado: entra no hook como dependência estável, senão o
  // useMemo recalcularia a cada render.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH);
    const unsub = onSnapshot(
      ref,
      (snap) => setTeamHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error('team history', e)
    );
    return () => unsub();
  }, [db]);

  const board = useTeamBoard({
    leads, interactions, usersList, teamHistory,
    metaWeekdays, slaOverdueDays, renewalCheckpoints, selectedDay, now,
  });

  // Trocar de dia fecha a linha aberta: o detalhe só existe pra hoje.
  const pickDay = (d) => {
    setSelectedDay(d === now.getDate() ? null : d);
    setOpenId(null);
  };

  const selecionado = board.rail.find((d) => d.selected);

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display tracking-tight text-[20px] font-bold inline-flex items-center gap-2">
            <Target size={18} className="text-brand-600" /> Meta da equipe
          </h2>
          <p className="text-[11.5px] text-muted-foreground mt-0.5 num">
            {MESES[now.getMonth()]} · {board.monthDays} dias programados · {board.closedDays} {board.closedDays === 1 ? 'encerrado' : 'encerrados'} · hoje em curso
          </p>
        </div>

        {/* Os dois números que resolvem os três segundos: se os dois estiverem
            bem, o gestor fecha a tela sem olhar o resto. */}
        <div className="flex items-center gap-2.5">
          {!board.sel.isToday && (
            <button
              type="button"
              onClick={() => pickDay(now.getDate())}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-border bg-card text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/10 transition"
            >
              <ArrowLeft size={13} /> Voltar pra hoje
            </button>
          )}
          <div className="rounded-xl bg-paper-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] px-3.5 py-2 text-right">
            <div className="font-display text-[19px] font-bold leading-none num">{board.okNow}</div>
            <div className="text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">em dia agora</div>
            <div className="text-[10.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap num">de {board.teamSize}</div>
          </div>
          <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-3.5 py-2 text-right">
            <div className="font-display text-[19px] font-bold leading-none num text-rose-700 dark:text-rose-300">{board.critTotal}</div>
            <div className="text-[11.5px] font-semibold text-rose-700 dark:text-rose-300 whitespace-nowrap">
              {board.critTotal === 1 ? 'crítica' : 'críticas'}
            </div>
            <div className="text-[10.5px] text-slate-400 dark:text-slate-500 whitespace-nowrap num">atrasadas {slaOverdueDays}d+</div>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-border bg-card shadow-card">
        <TeamWings rows={board.rows} monthDays={board.monthDays} pacePct={board.pacePct} />
      </div>

      <TeamDayTable
        board={board}
        openId={openId}
        onToggle={setOpenId}
        onPickDay={pickDay}
        slaOverdueDays={slaOverdueDays}
        appUser={appUser}
      />

      {!board.sel.isToday && (
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 px-1">
          Dia {board.sel.dayNum} selecionado: {selecionado?.n ?? 0} de {board.teamSize} bateram.
          A coluna da meta mostra só bateu ou não bateu, porque o sistema não guarda quais tarefas existiam.
          Abra a linha para ver a prospecção do dia, que é recalculada e sai completa.
        </p>
      )}
    </div>
  );
}

export { DailyGoalTeamView };
