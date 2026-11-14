import React from 'react';
import { Check, ChevronRight, Clock, Flame, Minus, ShieldBan } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { Entity } from '../types';
import { WEEKDAY_PILLS_ES } from '../utils/date';
import { calculateHabitStats } from '../utils/streak';

interface HabitCardProps {
  entity: Entity;
}

const CATEGORY_LABEL: Record<Entity['category'], string> = {
  salud: 'SALUD',
  estudio: 'ESTUDIO',
  trabajo: 'TRABAJO',
  personal: 'PERSONAL',
};

const CADENCE_LABEL: Record<Entity['cadence'], string> = {
  diario: 'Diario',
  laborables: 'L–V',
  semanal: 'Semanal',
  personalizado: 'Personalizado',
};

function formatCadenceLabel(entity: Entity): string {
  if (entity.cadence !== 'personalizado') {
    return CADENCE_LABEL[entity.cadence];
  }
  const days = entity.customDays ?? [];
  if (days.length === 0) return 'Personalizado';
  return WEEKDAY_PILLS_ES.filter((d) => days.includes(d.dow))
    .map((d) => d.short)
    .join('·');
}

export const HabitCard: React.FC<HabitCardProps> = ({ entity }) => {
  const { activities, today, toggleDayStatus, openDetailModal } = useStore();
  const stats = calculateHabitStats(entity, activities, today);
  const isTodayDone = stats.todayStatus === 'hecho';
  const isQuitHabit = entity.habitType === 'evitar';
  const monthlyPct = Math.min(
    100,
    Math.round((stats.monthlyCompleted / Math.max(1, entity.monthlyGoal)) * 100)
  );

  return (
    <article className="bg-[#0b0b0b] border border-[#1c1c1c] hover:border-[#2a2a2a] rounded-2xl p-5 flex flex-col justify-between transition-colors">
      {/* Top Row: Category + Cadence + Type + Grace + Current Streak */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#a3a3a3] whitespace-nowrap">
              {CATEGORY_LABEL[entity.category]}
            </span>
            <span className="text-[#444444]" aria-hidden="true">
              ·
            </span>
            <span className="text-[11px] text-[#737373] whitespace-nowrap truncate">
              {formatCadenceLabel(entity)}
            </span>
            {isQuitHabit && (
              <>
                <span className="text-[#444444]" aria-hidden="true">
                  ·
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 whitespace-nowrap"
                  title="Hábito de evitar o romper un patrón"
                >
                  <ShieldBan className="w-3 h-3" />
                  <span>Evitar</span>
                </span>
              </>
            )}
            {entity.graceDays > 0 && (
              <>
                <span className="text-[#444444]" aria-hidden="true">
                  ·
                </span>
                <span
                  className={`text-[11px] font-medium whitespace-nowrap ${
                    stats.graceUsedToday ? 'text-[#f2c93a]' : 'text-[#d8f23a]'
                  }`}
                  title={
                    stats.graceUsedToday
                      ? 'Día de gracia protegiendo la racha hoy'
                      : `${entity.graceDays} día(s) de gracia disponible(s)`
                  }
                >
                  Gracia {entity.graceDays}d
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-white tabular-nums shrink-0">
            <Flame
              className={`w-3.5 h-3.5 ${
                stats.currentStreak > 0 ? 'text-[#d8f23a]' : 'text-[#555555]'
              }`}
            />
            <span>{stats.currentStreak} d</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="mt-3">
          <button
            type="button"
            onClick={() => openDetailModal(entity.id)}
            className="text-left text-[15px] font-bold text-white hover:text-[#d8f23a] transition-colors cursor-pointer line-clamp-1"
          >
            {entity.name}
          </button>
        </h3>

        {/* Meta + Deadline */}
        <div className="flex items-center justify-between gap-2 text-xs mt-1.5 mb-3">
          <span className="text-[#8a8a8a] tabular-nums truncate">
            Mes: {stats.monthlyCompleted}/{entity.monthlyGoal} d · {entity.targetValue} {entity.unit}
          </span>
          <span
            className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
              entity.endDate ? 'text-[#d8f23a]' : 'text-[#8a8a8a]'
            }`}
          >
            <Clock className="w-3 h-3 shrink-0" />
            <span>{entity.endDate ? `Hasta ${entity.endDate}` : 'Indefinido'}</span>
          </span>
        </div>

        {/* Monthly Goal Slim Progress Bar */}
        <div
          className="w-full h-1 bg-[#161616] rounded-full overflow-hidden mb-4"
          aria-label={`Progreso mensual ${monthlyPct}%`}
        >
          <div
            className="h-full bg-[#d8f23a]/85 rounded-full transition-all duration-300"
            style={{ width: `${monthlyPct}%` }}
          />
        </div>
      </div>

      {/* Bottom Interactive Row: 5 Daily Checkboxes + Detail Chevron + Quick "Hecho" Action */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5" role="group" aria-label="Últimos 5 días">
          {stats.lastFiveDays.map((day) => {
            const isDone = day.status === 'hecho';
            const isPartial = day.status === 'parcial';
            const isToday = day.date === today;
            const isUnscheduled = !day.expected && day.status === 'vacio';

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => toggleDayStatus(entity, day.date)}
                title={`${day.date}${isToday ? ' (Hoy)' : ''}: ${
                  isDone
                    ? isQuitHabit
                      ? 'Logrado (evitado)'
                      : 'Hecho'
                    : isPartial
                    ? 'Parcial'
                    : isUnscheduled
                    ? 'No programado'
                    : 'Pendiente'
                }${day.note ? ` — “${day.note}”` : ''} — clic para alternar`}
                aria-label={`${entity.name} el ${day.date}`}
                aria-pressed={isDone}
                className={`relative w-7 h-7 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                  isDone
                    ? 'bg-[#d8f23a] border-[#d8f23a] text-black hover:bg-[#c8e22a]'
                    : isPartial
                    ? 'bg-[#2a330a] border-[#78911a] text-[#d8f23a] hover:border-[#d8f23a]'
                    : isUnscheduled
                    ? 'bg-[#101010] border-dashed border-[#242424] text-[#444444] opacity-55 hover:opacity-100 hover:border-[#555555]'
                    : 'bg-[#141414] border-[#262626] text-transparent hover:border-[#444444]'
                } ${isToday && !isDone && day.expected ? 'ring-1 ring-[#d8f23a]/40' : ''}`}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                ) : isPartial ? (
                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : isUnscheduled ? (
                  <span className="w-1 h-1 rounded-full bg-[#4a4a4a]" aria-hidden="true" />
                ) : null}
                {day.note && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                      isDone ? 'bg-black' : 'bg-[#d8f23a]'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => openDetailModal(entity.id)}
            title="Ver detalle, editar y registrar valor"
            aria-label={`Abrir detalle de ${entity.name}`}
            className="w-8 h-8 rounded-lg bg-[#141414] border border-[#242424] hover:border-[#3c3c3c] text-[#8a8a8a] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => toggleDayStatus(entity, today)}
            className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              isTodayDone
                ? 'bg-[#d8f23a] hover:bg-[#c8e22a] text-black'
                : 'bg-[#161616] border border-[#2a2a2a] hover:border-[#d8f23a] text-white hover:text-[#d8f23a]'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isTodayDone ? 'Hecho' : isQuitHabit ? 'Cumplido' : 'Marcar'}</span>
          </button>
        </div>
      </div>
    </article>
  );
};
