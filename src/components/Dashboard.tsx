import React, { useMemo, useState } from 'react';
import { Calendar, CheckCheck, ImageDown, Plus, Search } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { HabitCategory } from '../types';
import { calculateHabitStats } from '../utils/streak';
import { HabitCard } from './HabitCard';
import { Heatmap } from './Heatmap';
import { KpiCards } from './KpiCards';
import { ProgressOverview } from './ProgressOverview';
import { StreakMilestoneTimeline } from './StreakMilestoneTimeline';

type SortMode = 'pendientes' | 'racha' | 'nombre';

export const Dashboard: React.FC = () => {
  const {
    entities,
    activities,
    today,
    globalStats,
    selectedCategory,
    setSelectedCategory,
    openCreateHabitModal,
    openShareModal,
    setActiveView,
    pendingTodayCount,
    completeAllPendingToday,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('pendientes');

  const filters: Array<{ id: 'todos' | HabitCategory; label: string; count: number }> = [
    { id: 'todos', label: 'Todos', count: entities.length },
    { id: 'salud', label: 'Salud', count: globalStats.categoryCounts.salud },
    { id: 'estudio', label: 'Estudio', count: globalStats.categoryCounts.estudio },
    { id: 'trabajo', label: 'Trabajo', count: globalStats.categoryCounts.trabajo },
    { id: 'personal', label: 'Personal', count: globalStats.categoryCounts.personal },
  ];

  const filteredEntities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = entities.filter((e) => {
      if (selectedCategory !== 'todos' && e.category !== selectedCategory) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });

    const statsMap = new Map(
      base.map((ent) => [ent.id, calculateHabitStats(ent, activities, today)])
    );

    return [...base].sort((a, b) => {
      if (sortMode === 'nombre') {
        return a.name.localeCompare(b.name, 'es');
      }
      const sa = statsMap.get(a.id)!;
      const sb = statsMap.get(b.id)!;
      if (sortMode === 'racha') {
        return sb.currentStreak - sa.currentStreak || a.name.localeCompare(b.name, 'es');
      }
      // 'pendientes': pending today first, then highest streak
      const aDone = sa.todayStatus === 'hecho' ? 1 : 0;
      const bDone = sb.todayStatus === 'hecho' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return sb.currentStreak - sa.currentStreak;
    });
  }, [entities, activities, today, selectedCategory, searchQuery, sortMode]);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <KpiCards />

      {/* 112-day Consistency Heatmap */}
      <Heatmap />

      {/* Panel General de Hábitos */}
      <section aria-label="Panel General de Hábitos" className="pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Panel General de Hábitos
            </h1>
            <p className="text-xs text-[#8a8a8a] mt-0.5">
              Monitorea tus compromisos diarios, consistencia y objetivos personales.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {pendingTodayCount > 0 && (
              <button
                type="button"
                onClick={() => void completeAllPendingToday()}
                className="flex items-center gap-2 bg-[#161a08] border border-[#34420e] hover:border-[#d8f23a] text-[#d8f23a] text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Completar pendientes ({pendingTodayCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={openCreateHabitModal}
              className="flex items-center gap-2 bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nuevo Hábito</span>
            </button>
            <button
              type="button"
              onClick={openShareModal}
              className="flex items-center gap-2 bg-[#0b0b0b] border border-[#1c1c1c] hover:border-[#d8f23a] text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <ImageDown className="w-4 h-4 text-[#d8f23a]" />
              <span>Tarjeta PNG</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('calendario')}
              className="flex items-center gap-2 bg-[#0b0b0b] border border-[#1c1c1c] hover:border-[#333333] text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-[#8a8a8a]" />
              <span>Abrir Calendario</span>
            </button>
          </div>
        </div>

        {/* Category Filter Tabs + Search + Sort Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((f) => {
              const active = selectedCategory === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedCategory(f.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#161a08] border-[#d8f23a] text-[#d8f23a]'
                      : 'bg-[#0b0b0b] border-[#1c1c1c] text-[#8a8a8a] hover:text-white hover:border-[#2e2e2e]'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar hábito..."
                aria-label="Buscar hábito por nombre"
                className="w-full bg-[#0b0b0b] border border-[#1c1c1c] focus:border-[#d8f23a] text-white text-xs rounded-xl pl-8 pr-3 py-2 outline-none"
              />
            </div>

            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Ordenar hábitos"
              className="bg-[#0b0b0b] border border-[#1c1c1c] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
            >
              <option value="pendientes">Pendientes primero</option>
              <option value="racha">Mayor racha</option>
              <option value="nombre">Nombre (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Habit Cards Grid */}
        {filteredEntities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEntities.map((entity) => (
              <HabitCard key={entity.id} entity={entity} />
            ))}
          </div>
        ) : (
          <div className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-10 text-center">
            <p className="text-sm font-medium text-white">
              {searchQuery.trim()
                ? `No se encontraron hábitos que coincidan con «${searchQuery.trim()}»`
                : 'No hay hábitos registrados en esta categoría'}
            </p>
            <p className="text-xs text-[#8a8a8a] mt-1 mb-4">
              {searchQuery.trim()
                ? 'Prueba con otro término o limpia el filtro de búsqueda.'
                : 'Crea una nueva rutina para comenzar a construir tu racha diaria.'}
            </p>
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-2 bg-[#141414] border border-[#2a2a2a] hover:border-[#d8f23a] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <span>Limpiar búsqueda</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openCreateHabitModal}
                className="inline-flex items-center gap-2 bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Crear primer hábito</span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* Recharts Historical Streak Evolution & 3-Month Comparison */}
      <ProgressOverview />

      {/* Chronological Streak Milestone & Medal Timeline */}
      <StreakMilestoneTimeline />
    </div>
  );
};
