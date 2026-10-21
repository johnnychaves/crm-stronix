import { useId } from 'react';
import { AlertCircle, Calendar } from 'lucide-react';
import { whenPresetsFor, whenFromPreset, whenProblem, whenText, dayLabel, isoDay } from '../../../lib/whenPicker.js';
import { addDays, startOfLocalDay } from '../../../lib/dates.js';
import { cn } from '../../../lib/utils.js';
import { POPUP_FIELD } from './popupKit.js';
import { ChoiceChips, PopupLabel, PopupNote } from './PopupShell.jsx';

// O "Quando" único dos pop-ups: atalhos de dia, o dia e o horário em campos
// separados e a frase que confirma o resultado. A regra mora em
// lib/whenPicker.js; `nowMs` é o instante fixado na montagem do pop-up, e o
// envio confere de novo no relógio. `who` abre a frase ("Mateus volta à sua
// Meta…"). Com `autoFocus`, o pop-up abre com o foco no atalho escolhido. O
// dia e o horário aceitam o vazio enquanto a pessoa apaga e digita: devolver o
// valor antigo no meio da digitação fazia o Backspace não apagar nada. Com
// `fromTomorrow` (o Reagendar e o "Quando voltar a falar?"), o dia começa
// amanhã: sem o atalho "Hoje" e com o calendário a partir de amanhã.
export function WhenPicker({ value, onChange, who, nowMs, autoFocus = false, fromTomorrow = false }) {
  const labelId = useId();
  const today = new Date(nowMs);
  const options = whenPresetsFor({ fromTomorrow }).map((p) => ({ id: p.id, label: p.label }));
  const problem = whenProblem(value, nowMs, { fromTomorrow });
  const minDay = fromTomorrow ? addDays(startOfLocalDay(today), 1) : today;
  return (
    <>
      <div>
        <PopupLabel id={labelId}>Quando</PopupLabel>
        <ChoiceChips
          options={options}
          value={value.preset}
          labelledBy={labelId}
          autoFocusSelected={autoFocus}
          onChange={(preset) => onChange(whenFromPreset(preset, value.time, today, value))}
        />
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          {value.preset === 'outro' ? (
            <input
              type="date"
              aria-label="Dia"
              value={value.date}
              min={isoDay(minDay)}
              onChange={(e) => onChange({ ...value, date: e.target.value })}
              className={cn(POPUP_FIELD, 'num')}
            />
          ) : (
            <span className="text-[14px] font-semibold">{dayLabel(value)}</span>
          )}
          <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
            às
            <input
              type="time"
              aria-label="Horário"
              value={value.time}
              onChange={(e) => onChange({ ...value, time: e.target.value })}
              className={cn(POPUP_FIELD, 'num')}
            />
          </label>
        </div>
      </div>
      {problem === 'missing' ? (
        <PopupNote tone="bad" icon={AlertCircle}>Escolha o dia e o horário.</PopupNote>
      ) : problem === 'today' ? (
        <PopupNote tone="bad" icon={AlertCircle}>Reagende a partir de amanhã.</PopupNote>
      ) : problem === 'past' ? (
        <PopupNote tone="bad" icon={AlertCircle}>Esse horário já passou. Escolha um dia ou horário futuros.</PopupNote>
      ) : (
        <PopupNote icon={Calendar}>{who} volta à sua Meta <b className="font-semibold">{whenText(value, today)}</b>.</PopupNote>
      )}
    </>
  );
}
