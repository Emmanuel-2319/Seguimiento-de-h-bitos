import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Minus, X } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { ActivityStatus, LocalDate } from '../types';
import {
  formatMonthYearEs,
  formatReadableDateEs,
  getDayOfWeek,
  getMonthDays,
} from '../utils/date';

const WEEKDAYS_HEADER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const CalendarView: React.FC = () => {
  const { entities, activities, today, setDayActivity, toggleDayStatus } = useStore();

  const initialYear = Number(today.slice(0, 4));
  const initialMonth = Number(today.slice(5, 7)) - 1;

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<LocalDate>(today);

  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);

  // Monday-first leading empty cells (0=Mon .. 6=Sun)
  const leadingEmptyCount = useMemo(() => {
    if (monthDays.length === 0) return 0;
    const dow = getDayOfWeek(monthDays[0]); // 0=Sun, 1=Mon...
    return dow === 0 ? 6 : dow - 1;
  }, [monthDays]);

  const goPrevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const visibleEntities =
    selectedEntityId === 'all'
      ? entities
      : entities.filter((e) => e.id === selectedEntityId);

  const activityIndex = useMemo(() => {
    const map = new Map<string, ActivityStatus>();
    for (const act of activities) {
      map.set(`${act.entityId}::${act.date}`, act.status);
    }
    return map;
  }, [activities]);

  const getDaySummary = (date: LocalDate) => {
    const active = visibleEntities.filter(
      (e) => e.startDate <= date && (!e.endDate || e.endDate >= date)
    );
    let done = 0;
    let partial = 0;
    for (const ent of active) {
      const status = activityIndex.get(`${ent.id}::${date}`) ?? 'vacio';
      if (status === 'hecho') done++;
      else if (status === 'parcial') partial++;
    }
    const total = active.length;
    const pct = total > 0 ? Math.round(((done + partial * 0.5) / total) * 100) : 0;
    return { done, partial, total, pct };
  };

  const selectedDayEntities = entities.filter(
    (e) => e.startDate <= selectedDate && (!e.endDate || e.endDate >= selectedDate)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Calendario Mensual</h1>
          <p className="text-xs text-[#8a8a8a] mt-0.5">
            Inspecciona y ajusta tus marcas diarias en cualquier día del mes ({today}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedEntityId}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            aria-label="Filtrar calendario por hábito"
            className="bg-[#0b0b0b] border border-[#1c1c1c] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3 py-2 outline-none"
          >
            <option value="all">Todos los hábitos ({entities.length})</option>
            {entities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-[#0b0b0b] border border-[#1c1c1c] rounded-xl p-1">
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label="Mes anterior"
              className="p-1.5 rounded-lg text-[#8a8a8a] hover:text-white hover:bg-[#161616] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-white min-w-[130px] text-center whitespace-nowrap">
              {formatMonthYearEs(year, month)}
            </span>
            <button
              type="button"
              onClick={goNextMonth}
              aria-label="Mes siguiente"
              className="p-1.5 rounded-lg text-[#8a8a8a] hover:text-white hover:bg-[#161616] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-3 sm:p-5">
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-3">
            {WEEKDAYS_HEADER.map((w) => (
              <div
                key={w}
                className="text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#8a8a8a] py-1"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="calendar-grid grid grid-cols-7 gap-1 sm:gap-2">
            {Array.from({ length: leadingEmptyCount }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="relative h-14 sm:h-20 rounded-lg sm:rounded-xl bg-[#060606] overflow-hidden"
              />
            ))}

            {monthDays.map((date) => {
              const dayNum = Number(date.slice(8, 10));
              const summary = getDaySummary(date);
              const isSelected = date === selectedDate;
              const isToday = date === today;
              const isFuture = date > today;

              let cellBg = 'bg-[#111111] border-[#1d1d1d]';
              if (summary.total > 0 && summary.pct === 100) {
                cellBg = 'bg-[#1c2308] border-[#4f6311]';
              } else if (summary.pct > 0) {
                cellBg = 'bg-[#14170a] border-[#2d360d]';
              }

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`relative min-w-0 w-full overflow-hidden h-14 sm:h-20 rounded-lg sm:rounded-xl border text-left transition-all cursor-pointer ${cellBg} ${
                    isSelected
                      ? 'ring-2 ring-[#d8f23a] border-[#d8f23a]'
                      : 'hover:border-[#3a3a3a]'
                  } ${isFuture ? 'opacity-50' : ''}`}
                >
                  <div className="absolute inset-0 p-1 sm:p-2 flex flex-col justify-between min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between gap-0.5 w-full min-w-0">
                      <span
                        className={`truncate text-[11px] sm:text-xs font-semibold tabular-nums leading-none ${
                          isToday ? 'text-[#d8f23a]' : 'text-white'
                        }`}
                      >
                        {dayNum}
                      </span>
                      {isToday && (
                        <>
                          <span
                            className="sm:hidden w-1.5 h-1.5 rounded-full bg-[#d8f23a] shrink-0"
                            aria-label="Hoy"
                          />
                          <span className="hidden sm:inline text-[9px] font-bold uppercase text-[#d8f23a] leading-none truncate">
                            Hoy
                          </span>
                        </>
                      )}
                    </div>

                    {summary.total > 0 && (
                      <div className="w-full min-w-0 space-y-0.5 sm:space-y-1">
                        <div className="flex items-center justify-center sm:justify-between gap-0.5 w-full min-w-0 text-[9px] sm:text-[10px] leading-none tabular-nums">
                          <span className="hidden sm:inline text-[#8a8a8a] truncate">
                            {summary.done}/{summary.total}
                          </span>
                          <span
                            className={`block max-w-full truncate ${
                              summary.pct === 100
                                ? 'text-[#d8f23a] font-semibold'
                                : 'text-[#8a8a8a]'
                            }`}
                          >
                            {summary.pct}%
                          </span>
                        </div>
                        <div className="h-1 bg-[#1b1b1b] rounded-full overflow-hidden w-full">
                          <div
                            className="h-full bg-[#d8f23a] rounded-full"
                            style={{ width: `${summary.pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Drawer */}
        <div className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-5 flex flex-col">
          <div className="pb-4 border-b border-[#1c1c1c]">
            <span className="text-[11px] uppercase tracking-wider text-[#8a8a8a]">
              Registro del día
            </span>
            <h2 className="text-lg font-bold text-white mt-0.5">
              {formatReadableDateEs(selectedDate)}
            </h2>
            <p className="text-xs font-mono text-[#8a8a8a]">{selectedDate}</p>
          </div>

          <div className="mt-4 space-y-2.5 flex-1 overflow-y-auto max-h-[440px] pr-1">
            {selectedDayEntities.length === 0 ? (
              <p className="text-xs text-[#8a8a8a] py-6 text-center">
                No había hábitos activos en esta fecha.
              </p>
            ) : (
              selectedDayEntities.map((entity) => {
                const act = activities.find(
                  (a) => a.entityId === entity.id && a.date === selectedDate
                );
                const status: ActivityStatus = act?.status ?? 'vacio';

                return (
                  <div
                    key={entity.id}
                    className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {entity.name}
                      </p>
                      <p className="text-[11px] text-[#8a8a8a] tabular-nums mt-0.5">
                        Objetivo: {entity.targetValue} {entity.unit}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDayActivity(entity, selectedDate, 0, 'vacio')}
                        title="Marcar vacío"
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                          status === 'vacio'
                            ? 'bg-[#222222] border-[#444444] text-white'
                            : 'bg-[#0b0b0b] border-[#1c1c1c] text-[#666666] hover:text-white'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDayActivity(
                            entity,
                            selectedDate,
                            Math.max(1, Math.floor(entity.targetValue / 2)),
                            'parcial'
                          )
                        }
                        title="Marcar parcial"
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                          status === 'parcial'
                            ? 'bg-[#2a330a] border-[#d8f23a] text-[#d8f23a]'
                            : 'bg-[#0b0b0b] border-[#1c1c1c] text-[#666666] hover:text-[#d8f23a]'
                        }`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDayStatus(entity, selectedDate)}
                        title="Marcar hecho"
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                          status === 'hecho'
                            ? 'bg-[#d8f23a] border-[#d8f23a] text-black'
                            : 'bg-[#0b0b0b] border-[#1c1c1c] text-[#666666] hover:text-[#d8f23a]'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
