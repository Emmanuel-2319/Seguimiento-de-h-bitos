import React from 'react';
import { Check, ChevronRight, Clock, Flame, Minus } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { Entity } from '../types';
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

export const HabitCard: React.FC<HabitCardProps> = ({ entity }) => {
  const { activities, today, toggleDayStatus, openDetailModal } = useStore();
  const stats = calculateHabitStats(entity, activities, today);
  const isTodayDone = stats.todayStatus === 'hecho';

  return (
    <article className="bg-[#0b0b0b] border border-[#1c1c1c] hover:border-[#2a2a2a] rounded-2xl p-5 flex flex-col justify-between transition-colors">
      {/* Top Row: Category + Grace + Current Streak */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-[#181818] border border-[#262626] text-[#d4d4d4] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md whitespace-nowrap">
              {CATEGORY_LABEL[entity.category]}
            </span>
            {entity.graceDays > 0 && (
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-md border whitespace-nowrap ${
                  stats.graceUsedToday
                    ? 'bg-[#2a2208] border-[#614d0c] text-[#f2c93a]'
                    : 'bg-[#161a08] border-[#2c350c] text-[#d8f23a]'
                }`}
                title={
                  stats.graceUsedToday
                    ? 'Día de gracia protegiendo la racha hoy'
                    : `${entity.graceDays} día(s) de gracia disponible(s)`
                }
              >
                Gracia: {entity.graceDays}d
              </span>
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
        <h3 className="mt-3.5">
          <button
            type="button"
            onClick={() => openDetailModal(entity.id)}
            className="text-left text-[15px] font-bold text-white hover:text-[#d8f23a] transition-colors cursor-pointer line-clamp-1"
          >
            {entity.name}
          </button>
        </h3>

        {/* Meta + Deadline */}
        <div className="flex items-center justify-between gap-2 text-xs mt-1.5 mb-5">
          <span className="text-[#8a8a8a] tabular-nums">
            Meta: {stats.monthlyCompleted}/{entity.monthlyGoal} {entity.unit}
          </span>
          <span
            className={`inline-flex items-center gap-1 whitespace-nowrap ${
              entity.endDate ? 'text-[#d8f23a]' : 'text-[#8a8a8a]'
            }`}
          >
            <Clock className="w-3 h-3 shrink-0" />
            <span>{entity.endDate ? `Hasta ${entity.endDate}` : 'Indefinido'}</span>
          </span>
        </div>
      </div>

      {/* Bottom Interactive Row: 5 Daily Checkboxes + Detail Chevron + Quick "Hecho" Action */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5" role="group" aria-label="Últimos 5 días">
          {stats.lastFiveDays.map((day) => {
            const isDone = day.status === 'hecho';
            const isPartial = day.status === 'parcial';
            const isToday = day.date === today;

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => toggleDayStatus(entity, day.date)}
                title={`${day.date}${isToday ? ' (Hoy)' : ''}: ${
                  isDone ? 'Hecho' : isPartial ? 'Parcial' : 'Pendiente'
                } — clic para alternar`}
                aria-label={`${entity.name} el ${day.date}`}
                aria-pressed={isDone}
                className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                  isDone
                    ? 'bg-[#d8f23a] border-[#d8f23a] text-black hover:bg-[#c8e22a]'
                    : isPartial
                    ? 'bg-[#2a330a] border-[#78911a] text-[#d8f23a] hover:border-[#d8f23a]'
                    : 'bg-[#141414] border-[#262626] text-transparent hover:border-[#444444]'
                } ${isToday && !isDone ? 'ring-1 ring-[#d8f23a]/40' : ''}`}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                ) : isPartial ? (
                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : null}
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
            <span>{isTodayDone ? 'Hecho' : 'Marcar'}</span>
          </button>
        </div>
      </div>
    </article>
  );
};
