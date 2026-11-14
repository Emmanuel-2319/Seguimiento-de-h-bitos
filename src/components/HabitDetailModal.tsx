import React, { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Crown, Flame, Pencil, Trash2, X } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { ActivityStatus, MedalDays } from '../types';
import { formatReadableDateEs } from '../utils/date';
import {
  calculateHabitStats,
  calculateStreakMilestoneTimeline,
  getHabitLastNDays,
} from '../utils/streak';

export const HabitDetailModal: React.FC = () => {
  const {
    detailEntityId,
    closeDetailModal,
    entities,
    activities,
    today,
    setDayActivity,
    openEditHabitModal,
    deleteHabit,
  } = useStore();

  const entity = entities.find((e) => e.id === detailEntityId) || null;
  const [selectedDate, setSelectedDate] = useState(today);
  const [valueInput, setValueInput] = useState(0);
  const [statusInput, setStatusInput] = useState<ActivityStatus>('vacio');
  const [noteInput, setNoteInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setSelectedDate(today);
    setConfirmDelete(false);
  }, [detailEntityId, today]);

  useEffect(() => {
    if (!entity) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetailModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entity, closeDetailModal]);

  useEffect(() => {
    if (!entity) return;
    const act = activities.find(
      (a) => a.entityId === entity.id && a.date === selectedDate
    );
    setValueInput(act?.value ?? entity.targetValue);
    setStatusInput(act?.status ?? 'vacio');
    setNoteInput(act?.note ?? '');
  }, [entity, activities, selectedDate]);

  const last30Days = useMemo(() => {
    if (!entity) return [];
    return getHabitLastNDays(entity.id, activities, today, 30);
  }, [entity, activities, today]);

  const unlockedDateMap = useMemo(() => {
    if (!entity) return new Map<MedalDays, string>();
    const tl = calculateStreakMilestoneTimeline([entity], activities, today);
    const map = new Map<MedalDays, string>();
    for (const ev of tl.events) {
      map.set(ev.days, ev.unlockedDate);
    }
    return map;
  }, [entity, activities, today]);

  if (!entity) return null;

  const stats = calculateHabitStats(entity, activities, today);

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    const finalValue =
      statusInput === 'vacio'
        ? 0
        : statusInput === 'hecho'
        ? Math.max(entity.targetValue, valueInput)
        : Math.max(1, valueInput);
    setDayActivity(entity, selectedDate, finalValue, statusInput, noteInput);
  };

  const medalMeta: Array<{
    days: MedalDays;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { days: 7, label: '7 días', icon: Award },
    { days: 30, label: '30 días', icon: CheckCircle2 },
    { days: 100, label: '100 días', icon: Crown },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="habit-detail-title"
      onClick={closeDetailModal}
    >
      <div
        className="w-full max-w-xl bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#1c1c1c]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-[#8a8a8a]">
              <span>{entity.category}</span>
              <span aria-hidden="true">·</span>
              <span className={entity.habitType === 'evitar' ? 'text-amber-400 font-semibold' : ''}>
                {entity.habitType === 'evitar' ? 'Evitar' : 'Construir'}
              </span>
              <span aria-hidden="true">·</span>
              <span>Cadencia {entity.cadence}</span>
              <span aria-hidden="true">·</span>
              <span>Gracia {entity.graceDays}d</span>
            </div>
            <h2 id="habit-detail-title" className="text-lg font-bold text-white mt-1">
              {entity.name}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                closeDetailModal();
                openEditHabitModal(entity);
              }}
              title="Editar hábito"
              aria-label="Editar hábito"
              className="p-2 rounded-xl bg-[#141414] border border-[#242424] hover:border-[#d8f23a] text-[#8a8a8a] hover:text-white transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={closeDetailModal}
              aria-label="Cerrar detalle"
              className="p-2 rounded-xl bg-[#141414] border border-[#242424] hover:border-[#3c3c3c] text-[#8a8a8a] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Metrics & Medals */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#121212] border border-[#1f1f1f] rounded-xl p-3.5">
            <span className="text-[11px] uppercase text-[#8a8a8a]">Racha actual</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Flame className="w-4 h-4 text-[#d8f23a]" />
              <span className="text-xl font-bold text-white tabular-nums">
                {stats.currentStreak}d
              </span>
            </div>
          </div>
          <div className="bg-[#121212] border border-[#1f1f1f] rounded-xl p-3.5">
            <span className="text-[11px] uppercase text-[#8a8a8a]">Mejor racha</span>
            <p className="text-xl font-bold text-white tabular-nums mt-1">
              {stats.bestStreak}d
            </p>
          </div>
          <div className="bg-[#121212] border border-[#1f1f1f] rounded-xl p-3.5">
            <span className="text-[11px] uppercase text-[#8a8a8a]">Mes actual</span>
            <p className="text-xl font-bold text-[#d8f23a] tabular-nums mt-1">
              {stats.monthlyCompleted}/{entity.monthlyGoal}
            </p>
          </div>
        </div>

        {/* Last 30 Days Interactive Strip */}
        <div className="bg-[#121212] border border-[#1f1f1f] rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8a8a8a] font-medium">Últimos 30 días (clic para seleccionar)</span>
            <span className="font-mono text-[#737373] tabular-nums">{selectedDate}</span>
          </div>
          <div className="grid grid-cols-10 sm:grid-cols-15 gap-1.5">
            {last30Days.map((day) => {
              const isSelected = day.date === selectedDate;
              const bg =
                day.status === 'hecho'
                  ? 'bg-[#d8f23a] border-[#d8f23a]'
                  : day.status === 'parcial'
                  ? 'bg-[#465710] border-[#78911a]'
                  : 'bg-[#1a1a1a] border-[#262626]';
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  title={`${day.date}: ${
                    day.status === 'hecho' ? 'Hecho' : day.status === 'parcial' ? 'Parcial' : 'Vacío'
                  }`}
                  aria-label={`Seleccionar ${day.date}`}
                  className={`h-5 rounded border transition-transform hover:scale-110 cursor-pointer ${bg} ${
                    isSelected ? 'ring-2 ring-white' : ''
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Habit Medals with Unlock Dates */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#121212] border border-[#1f1f1f] rounded-xl px-4 py-3">
          <span className="text-xs text-[#8a8a8a]">Medallas del hábito</span>
          <div className="flex flex-wrap items-center gap-2">
            {medalMeta.map((m) => {
              const Icon = m.icon;
              const unlocked = stats.unlockedMedals.includes(m.days);
              const unlockedDate = unlockedDateMap.get(m.days);
              return (
                <span
                  key={m.days}
                  title={
                    unlockedDate
                      ? `Desbloqueada el ${unlockedDate}`
                      : `Alcanza ${m.label} continuos`
                  }
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border tabular-nums ${
                    unlocked
                      ? 'bg-[#161a08] border-[#34420e] text-[#d8f23a]'
                      : 'bg-[#0b0b0b] border-[#1c1c1c] text-[#4a4a4a]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                  {unlockedDate && (
                    <span className="text-[10px] font-mono text-[#a3b82d]">
                      · {unlockedDate.slice(5)}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Log Value / Status Form */}
        <form onSubmit={handleSaveLog} className="bg-[#121212] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">
              Registrar marca ({formatReadableDateEs(selectedDate)})
            </span>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#0b0b0b] border border-[#262626] text-white text-xs rounded-lg px-2.5 py-1 outline-none tabular-nums"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#8a8a8a] mb-1">Estado</label>
              <div className="grid grid-cols-3 gap-1 bg-[#0b0b0b] border border-[#222222] rounded-xl p-1">
                {(['vacio', 'parcial', 'hecho'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setStatusInput(st);
                      if (st === 'hecho' && valueInput < entity.targetValue) {
                        setValueInput(entity.targetValue);
                      } else if (st === 'vacio') {
                        setValueInput(0);
                      }
                    }}
                    className={`py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                      statusInput === st
                        ? 'bg-[#d8f23a] text-black font-semibold'
                        : 'text-[#8a8a8a] hover:text-white'
                    }`}
                  >
                    {st === 'vacio' ? 'Vacío' : st === 'parcial' ? 'Parcial' : 'Hecho'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="detail-value" className="block text-[11px] text-[#8a8a8a] mb-1">
                Valor ({entity.unit} · objetivo {entity.targetValue})
              </label>
              <input
                id="detail-value"
                type="number"
                min={0}
                value={valueInput}
                onChange={(e) => setValueInput(Number(e.target.value))}
                disabled={statusInput === 'vacio'}
                className="w-full bg-[#0b0b0b] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3 py-2 outline-none tabular-nums disabled:opacity-40"
              />
            </div>
          </div>

          <div>
            <label htmlFor="detail-note" className="block text-[11px] text-[#8a8a8a] mb-1">
              Nota del día (opcional)
            </label>
            <input
              id="detail-note"
              type="text"
              maxLength={140}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Ej. Entrenamiento con poca energía pero cumplido, 2 capítulos..."
              className="w-full bg-[#0b0b0b] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3 py-2 outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Guardar marca
            </button>
          </div>
        </form>

        {/* Danger Zone */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1c1c1c]">
          <span className="text-[11px] text-[#666666] tabular-nums">
            Inicio: {entity.startDate}
          </span>

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar hábito</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">¿Confirmar eliminación?</span>
              <button
                type="button"
                onClick={() => deleteHabit(entity.id)}
                className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
              >
                Sí, eliminar
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 rounded-lg bg-[#161616] text-xs text-[#8a8a8a] hover:text-white cursor-pointer"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
