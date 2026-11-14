import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Award,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Crown,
  Flame,
  Plus,
  Search,
  Share2,
} from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { HabitCategory, MedalDays } from '../types';
import { formatReadableDateEs } from '../utils/date';
import { calculateStreakMilestoneTimeline } from '../utils/streak';

type TierFilter = 'todos' | MedalDays;
type SortOrder = 'recientes' | 'antiguos';

const CATEGORY_NAME: Record<HabitCategory, string> = {
  salud: 'Salud',
  estudio: 'Estudio',
  trabajo: 'Trabajo',
  personal: 'Personal',
};

const TIER_META: Record<
  MedalDays,
  {
    shortLabel: string;
    tierName: string;
    icon: React.ComponentType<{ className?: string }>;
    ringClass: string;
  }
> = {
  7: {
    shortLabel: '7 días',
    tierName: 'Bronce · Constancia',
    icon: Award,
    ringClass: 'border-[#4d5f13] bg-[#161a08] text-[#d8f23a]',
  },
  30: {
    shortLabel: '30 días',
    tierName: 'Plata · Consolidación',
    icon: CheckCircle2,
    ringClass: 'border-[#0284c7]/50 bg-[#081926] text-[#38bdf8]',
  },
  100: {
    shortLabel: '100 días',
    tierName: 'Oro · Maestría',
    icon: Crown,
    ringClass: 'border-[#ca8a04]/60 bg-[#221a06] text-[#facc15]',
  },
};

export const StreakMilestoneTimeline: React.FC = () => {
  const {
    entities,
    activities,
    today,
    openDetailModal,
    openCreateHabitModal,
    openShareModalWithNote,
  } = useStore();

  const [tierFilter, setTierFilter] = useState<TierFilter>('todos');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recientes');
  const [searchQuery, setSearchQuery] = useState('');

  const timeline = useMemo(
    () => calculateStreakMilestoneTimeline(entities, activities, today),
    [entities, activities, today]
  );

  const visibleEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = timeline.events.filter((ev) => {
      if (tierFilter !== 'todos' && ev.days !== tierFilter) return false;
      if (query && !ev.habitName.toLowerCase().includes(query)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const cmp = a.unlockedDate.localeCompare(b.unlockedDate) || a.days - b.days;
      return sortOrder === 'recientes' ? -cmp : cmp;
    });
  }, [timeline.events, tierFilter, sortOrder, searchQuery]);

  const totalUnlocked = timeline.events.length;

  return (
    <section
      aria-label="Línea temporal de hitos y medallas"
      className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-5 sm:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              CRONOLOGÍA DE HITOS Y MEDALLAS
            </h2>
            <span className="text-xs text-[#8a8a8a] tabular-nums">
              {totalUnlocked}{' '}
              {totalUnlocked === 1 ? 'medalla desbloqueada' : 'medallas desbloqueadas'}
              <span className="mx-1.5" aria-hidden="true">
                ·
              </span>
              7d ({timeline.tierTotals[7]}) · 30d ({timeline.tierTotals[30]}) · 100d (
              {timeline.tierTotals[100]})
            </span>
          </div>
          <p className="text-xs text-[#8a8a8a] mt-1">
            Historial cronológico con la fecha exacta en la que cada hábito alcanzó 7, 30 y 100 días de consistencia continua.
          </p>
        </div>

        {/* Search, Tier Filter & Chronological Order */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar hábito..."
              aria-label="Filtrar hitos por hábito"
              className="w-40 sm:w-44 bg-[#121212] border border-[#222222] focus:border-[#d8f23a] text-white text-xs rounded-xl pl-8 pr-3 py-1.5 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#121212] border border-[#222222] rounded-xl p-1">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 7, label: '7 días' },
                { id: 30, label: '30 días' },
                { id: 100, label: '100 días' },
              ] as const
            ).map((opt) => {
              const active = tierFilter === opt.id;
              return (
                <button
                  key={String(opt.id)}
                  type="button"
                  onClick={() => setTierFilter(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#d8f23a] text-black font-semibold'
                      : 'text-[#8a8a8a] hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() =>
              setSortOrder((prev) => (prev === 'recientes' ? 'antiguos' : 'recientes'))
            }
            className="inline-flex items-center gap-1.5 bg-[#121212] border border-[#222222] hover:border-[#d8f23a] text-xs font-medium text-white px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            <ArrowDownUp className="w-3.5 h-3.5 text-[#d8f23a]" />
            <span>
              {sortOrder === 'recientes' ? 'Más recientes' : 'Más antiguos'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Split: Chronological Timeline + Upcoming Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1">
        {/* Chronological Timeline (2 cols) */}
        <div className="lg:col-span-2">
          {visibleEvents.length > 0 ? (
            <ol className="relative pl-6 border-l border-[#222222] space-y-4">
              {visibleEvents.map((ev) => {
                const meta = TIER_META[ev.days];
                const Icon = meta.icon;
                const sharePrompt = `${ev.habitName} · Medalla de ${ev.days} días (${ev.unlockedDate})`;
                return (
                  <li key={ev.id} className="relative">
                    {/* Timeline Node Marker */}
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[37px] top-3 w-7 h-7 rounded-full border flex items-center justify-center ${meta.ringClass}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>

                    <div className="w-full bg-[#070707] hover:bg-[#101010] border border-[#1a1a1a] hover:border-[#2e2e2e] rounded-xl p-4 transition-colors group">
                      <button
                        type="button"
                        onClick={() => openDetailModal(ev.entityId)}
                        className="w-full text-left cursor-pointer"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#8a8a8a]">
                              <span className="font-semibold text-[#d8f23a]">
                                {meta.tierName}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{CATEGORY_NAME[ev.category]}</span>
                              {ev.isFirstOfTier && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-white font-medium">
                                    Primer desbloqueo global de {ev.days}d
                                  </span>
                                </>
                              )}
                            </div>

                            <h3 className="text-sm font-bold text-white group-hover:text-[#d8f23a] transition-colors mt-1 truncate">
                              {ev.habitName}
                            </h3>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 sm:text-right">
                            <div>
                              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-white tabular-nums">
                                <CalendarCheck className="w-3.5 h-3.5 text-[#d8f23a]" />
                                <span>{formatReadableDateEs(ev.unlockedDate)}</span>
                              </div>
                              <p className="text-[11px] font-mono text-[#737373] tabular-nums">
                                {ev.unlockedDate}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#555555] group-hover:text-[#d8f23a] transition-colors" />
                          </div>
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8a8a8a] mt-2.5 pt-2.5 border-t border-[#151515] tabular-nums">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Hito alcanzado: {ev.days} días continuos</span>
                          <span aria-hidden="true">·</span>
                          <span>Racha actual: {ev.currentStreak}d</span>
                          <span aria-hidden="true">·</span>
                          <span>Mejor marca: {ev.bestStreak}d</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openShareModalWithNote(sharePrompt)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141414] border border-[#242424] hover:border-[#d8f23a] text-[#d8f23a] font-semibold transition-colors cursor-pointer"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>Tarjeta PNG</span>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="bg-[#070707] border border-[#1a1a1a] rounded-xl p-8 text-center space-y-3">
              <Award className="w-7 h-7 text-[#4a4a4a] mx-auto" />
              <p className="text-sm font-semibold text-white">
                {entities.length === 0
                  ? 'Aún no tienes hábitos registrados'
                  : searchQuery.trim()
                  ? `Sin medallas que coincidan con «${searchQuery.trim()}»`
                  : tierFilter === 'todos'
                  ? 'Todavía no has desbloqueado ninguna medalla'
                  : `Sin medallas de ${tierFilter} días desbloqueadas todavía`}
              </p>
              <p className="text-xs text-[#8a8a8a] max-w-md mx-auto">
                Completa tus rutinas de forma consecutiva para registrar aquí la fecha exacta de cada hito de 7, 30 y 100 días.
              </p>
              {entities.length === 0 && (
                <button
                  type="button"
                  onClick={openCreateHabitModal}
                  className="inline-flex items-center gap-1.5 bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear primer hábito</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Upcoming Milestones Column (1 col) */}
        <div className="bg-[#070707] border border-[#181818] rounded-xl p-4 space-y-4 self-start">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              PRÓXIMOS HITOS EN CAMINO
            </h3>
            <p className="text-[11px] text-[#8a8a8a] mt-0.5">
              Proyección estimada según tu racha activa actual
            </p>
          </div>

          {timeline.upcoming.length > 0 ? (
            <div className="space-y-3">
              {timeline.upcoming.slice(0, 4).map((item) => (
                <button
                  key={`${item.entityId}-${item.targetDays}`}
                  type="button"
                  onClick={() => openDetailModal(item.entityId)}
                  className="w-full text-left pb-3 border-b border-[#161616] last:border-b-0 last:pb-0 space-y-2 group cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white group-hover:text-[#d8f23a] transition-colors truncate">
                      {item.habitName}
                    </span>
                    <span className="text-[11px] font-bold text-[#d8f23a] tabular-nums shrink-0">
                      Meta {item.targetDays}d
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-[#161616] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#d8f23a] rounded-full transition-all duration-300"
                      style={{ width: `${item.progressPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#8a8a8a] tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Flame className="w-3 h-3 text-[#d8f23a]" />
                      {item.currentStreak}/{item.targetDays}d
                    </span>
                    <span>
                      Faltan {item.daysRemaining}d · Est. {formatReadableDateEs(item.projectedDate)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#8a8a8a] py-4">
              {entities.length === 0
                ? 'Crea un hábito para calcular tus próximos hitos.'
                : '¡Has alcanzado todas las medallas disponibles en tus hábitos activos!'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
