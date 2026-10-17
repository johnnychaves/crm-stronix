import { useId } from 'react';
import { AlertCircle, Calendar } from 'lucide-react';
import { WHEN_PRESETS, whenFromPreset, whenIsFuture, whenText, dayLabel, isoDay } from '../../../lib/whenPicker.js';
import { cn } from '../../../lib/utils.js';
import { POPUP_FIELD } from './popupKit.js';
import { ChoiceChips, PopupLabel, PopupNote } from './PopupShell.jsx';

// O "Quando" único dos pop-ups: atalhos de dia, o dia e o horário em campos
// separados e a frase que confirma o resultado. A regra mora em
// lib/whenPicker.js; `nowMs` é o instante fixado na montagem do pop-up, e o
// envio confere de novo no relógio. `who` abre a frase ("Mateus volta à sua
// Meta…"). Com `autoFocus`, o pop-up abre com o foco no atalho escolhido.
export function WhenPicker({ value, onChange, who, nowMs, autoFocus = false }) {
  const labelId = useId();
  const today = new Date(nowMs);
  const options = WHEN_PRESETS.map((p) => ({ id: p.id, label: p.label }));
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
              min={isoDay(today)}
              onChange={(e) => onChange({ ...value, date: e.target.value || value.date })}
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
              onChange={(e) => onChange({ ...value, time: e.target.value || value.time })}
              className={cn(POPUP_FIELD, 'num')}
            />
          </label>
        </div>
      </div>
      {whenIsFuture(value, nowMs) ? (
        <PopupNote icon={Calendar}>{who} volta à sua Meta <b className="font-semibold">{whenText(value, today)}</b>.</PopupNote>
      ) : (
        <PopupNote tone="bad" icon={AlertCircle}>Esse horário já passou. Escolha um dia ou horário futuros.</PopupNote>
      )}
    </>
  );
}
