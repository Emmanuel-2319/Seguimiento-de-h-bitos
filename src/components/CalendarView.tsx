import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Minus,
  Shield,
  StickyNote,
  X,
} from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { ActivityStatus, LocalDate } from '../types';
import {
  formatMonthYearEs,
  formatReadableDateEs,
  getDayOfWeek,
  getMonthDays,
} from '../utils/date';
import { wasDayProtectedByGrace } from '../utils/streak';

export const CalendarView: React.FC = () => {
  const {
    user,
    entities,
    activities,
    today,
    calendarFocusDate,
    setDayActivity,
    toggleDayStatus,
    openDetailModal,
  } = useStore();

  const weekStart = user.weekStart ?? 'lunes';
  const weekdaysHeader =
    weekStart === 'domingo'
      ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const initialYear = Number(today.slice(0, 4));
  const initialMonth = Number(today.slice(5, 7)) - 1;

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<LocalDate>(today);
  const [expandedEditorId, setExpandedEditorId] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, number>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!calendarFocusDate) return;
    setYear(Number(calendarFocusDate.slice(0, 4)));
    setMonth(Number(calendarFocusDate.slice(5, 7)) - 1);
    setSelectedDate(calendarFocusDate);
  }, [calendarFocusDate]);

  useEffect(() => {
    setExpandedEditorId(null);
    const nextVals: Record<string, number> = {};
    const nextNotes: Record<string, string> = {};
    for (const ent of entities) {
      const act = activities.find(
        (a) => a.entityId === ent.id && a.date === selectedDate
      );
      nextVals[ent.id] = act?.value ?? ent.targetValue;
      nextNotes[ent.id] = act?.note ?? '';
    }
    setDraftValues(nextVals);
    setDraftNotes(nextNotes);
  }, [selectedDate, entities, activities]);

  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);

  const leadingEmptyCount = useMemo(() => {
    if (monthDays.length === 0) return 0;
    const dow = getDayOfWeek(monthDays[0]); // 0=Sun..6=Sat
    return weekStart === 'domingo' ? dow : dow === 0 ? 6 : dow - 1;
  }, [monthDays, weekStart]);

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

  const goToday = () => {
    setYear(initialYear);
    setMonth(initialMonth);
    setSelectedDate(today);
  };

  const visibleEntities =
    selectedEntityId === 'all'
      ? entities
      : entities.filter((e) => e.id === selectedEntityId);

  const activityIndex = useMemo(() => {
    const map = new Map<string, { status: ActivityStatus; hasNote: boolean }>();
    for (const act of activities) {
      map.set(`${act.entityId}::${act.date}`, {
        status: act.status,
        hasNote: Boolean(act.note?.trim()),
      });
    }
    return map;
  }, [activities]);

  const getDaySummary = (date: LocalDate) => {
    const active = visibleEntities.filter(
      (e) => e.startDate <= date && (!e.endDate || e.endDate >= date)
    );
    let done = 0;
    let partial = 0;
    let hasNote = false;
    let graceProtected = false;
    for (const ent of active) {
      const entry = activityIndex.get(`${ent.id}::${date}`);
      const status = entry?.status ?? 'vacio';
      if (entry?.hasNote) hasNote = true;
      if (status === 'hecho') done++;
      else if (status === 'parcial') partial++;
      else if (
        date <= today &&
        ent.graceDays > 0 &&
        wasDayProtectedByGrace(ent, activities, date, today)
      ) {
        graceProtected = true;
      }
    }
    const total = active.length;
    const pct = total > 0 ? Math.round(((done + partial * 0.5) / total) * 100) : 0;
    return { done, partial, total, pct, graceProtected, hasNote };
  };

  const monthSummary = useMemo(() => {
    let perfectDays = 0;
    let totalDone = 0;
    let totalExpected = 0;
    for (const d of monthDays) {
      if (d > today) continue;
      const s = getDaySummary(d);
      if (s.total > 0) {
        if (s.pct === 100) perfectDays += 1;
        totalDone += s.done;
        totalExpected += s.total;
      }
    }
    const rate = totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0;
    return { perfectDays, totalDone, rate };
  }, [monthDays, today, visibleEntities, activityIndex, activities]);

  const selectedDayEntities = entities.filter(
    (e) => e.startDate <= selectedDate && (!e.endDate || e.endDate >= selectedDate)
  );

  const handleMarkAllDayDone = () => {
    for (const ent of selectedDayEntities) {
      setDayActivity(
        ent,
        selectedDate,
        ent.targetValue,
        'hecho',
        draftNotes[ent.id] ?? ''
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Calendario Mensual</h1>
          <p className="text-xs text-[#8a8a8a] mt-0.5 tabular-nums">
            Días perfectos: <strong className="text-white">{monthSummary.perfectDays}</strong> · Tasa del mes:{' '}
            <strong className="text-[#d8f23a]">{monthSummary.rate}%</strong> · Marcas:{' '}
            <strong className="text-white">{monthSummary.totalDone}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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

          <button
            type="button"
            onClick={goToday}
            className="bg-[#0b0b0b] border border-[#1c1c1c] hover:border-[#d8f23a] text-[#d8f23a] text-xs font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            Hoy
          </button>

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
        <div className="lg:col-span-2 bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-3 sm:p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-3">
              {weekdaysHeader.map((w) => (
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
                } else if (summary.graceProtected) {
                  cellBg = 'bg-[#1f1a09] border-[#614a14]';
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
                        <div className="flex items-center gap-1 shrink-0">
                          {summary.hasNote && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-sky-400"
                              title="Con nota diaria"
                            />
                          )}
                          {summary.graceProtected && (
                            <Shield
                              className="w-2.5 h-2.5 text-amber-400"
                              aria-label="Protegido por día de gracia"
                            />
                          )}
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
                                  : summary.graceProtected
                                  ? 'text-amber-300'
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

          {/* Calendar Color Legend */}
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-[#161616] text-[11px] text-[#8a8a8a]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#1c2308] border border-[#4f6311]" />
              100% completado
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#14170a] border border-[#2d360d]" />
              Parcial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#1f1a09] border border-[#614a14]" />
              Protegido por gracia
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              Nota del día
            </span>
          </div>
        </div>

        {/* Selected Day Drawer */}
        <div className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-5 flex flex-col">
          <div className="pb-4 border-b border-[#1c1c1c] flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#8a8a8a]">
                Registro del día
              </span>
              <h2 className="text-lg font-bold text-white mt-0.5">
                {formatReadableDateEs(selectedDate)}
              </h2>
              <p className="text-xs font-mono text-[#8a8a8a]">{selectedDate}</p>
            </div>
            {selectedDayEntities.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllDayDone}
                className="inline-flex items-center gap-1.5 bg-[#161a08] border border-[#34420e] hover:border-[#d8f23a] text-[#d8f23a] text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>Todo hecho</span>
              </button>
            )}
          </div>

          <div className="mt-4 space-y-2.5 flex-1 overflow-y-auto max-h-[480px] pr-1">
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
                const isExpanded = expandedEditorId === entity.id;
                const val = draftValues[entity.id] ?? entity.targetValue;
                const note = draftNotes[entity.id] ?? '';
                const graceOnDate =
                  status === 'vacio' &&
                  selectedDate <= today &&
                  wasDayProtectedByGrace(entity, activities, selectedDate, today);

                return (
                  <div
                    key={entity.id}
                    className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-white truncate">
                            {entity.name}
                          </p>
                          {graceOnDate && (
                            <span title="Día protegido por gracia" className="inline-flex shrink-0">
                              <Shield className="w-3 h-3 text-amber-400" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8a8a8a] tabular-nums mt-0.5">
                          {act ? `${act.value}/${entity.targetValue}` : `Meta: ${entity.targetValue}`}{' '}
                          {entity.unit}
                          {act?.note && (
                            <span className="text-sky-400"> · “{act.note}”</span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEditorId(isExpanded ? null : entity.id)
                          }
                          title="Editar valor numérico y nota"
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                            isExpanded || act?.note
                              ? 'bg-[#192028] border-sky-500/40 text-sky-400'
                              : 'bg-[#0b0b0b] border-[#1c1c1c] text-[#666666] hover:text-white'
                          }`}
                        >
                          <StickyNote className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDetailModal(entity.id)}
                          title="Abrir detalle completo del hábito"
                          className="w-7 h-7 rounded-lg bg-[#0b0b0b] border border-[#1c1c1c] text-[#666666] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDayActivity(entity, selectedDate, 0, 'vacio', note)
                          }
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
                              'parcial',
                              note
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

                    {isExpanded && (
                      <div className="pt-2 border-t border-[#1c1c1c] space-y-2">
                        <div className="grid grid-cols-3 gap-2 items-center">
                          <label className="text-[11px] text-[#8a8a8a] col-span-1">
                            Valor ({entity.unit})
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={val}
                            onChange={(e) =>
                              setDraftValues((prev) => ({
                                ...prev,
                                [entity.id]: Number(e.target.value),
                              }))
                            }
                            className="col-span-2 bg-[#0b0b0b] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-lg px-2.5 py-1.5 outline-none tabular-nums"
                          />
                        </div>
                        <input
                          type="text"
                          maxLength={140}
                          value={note}
                          onChange={(e) =>
                            setDraftNotes((prev) => ({
                              ...prev,
                              [entity.id]: e.target.value,
                            }))
                          }
                          placeholder="Nota breve del día..."
                          className="w-full bg-[#0b0b0b] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-lg px-2.5 py-1.5 outline-none"
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const nextStatus: ActivityStatus =
                                val >= entity.targetValue
                                  ? 'hecho'
                                  : val > 0
                                  ? 'parcial'
                                  : status;
                              setDayActivity(
                                entity,
                                selectedDate,
                                val,
                                nextStatus,
                                note
                              );
                              setExpandedEditorId(null);
                            }}
                            className="px-3 py-1 rounded-lg bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-[11px] font-semibold cursor-pointer"
                          >
                            Guardar nota y valor
                          </button>
                        </div>
                      </div>
                    )}
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
