import React from 'react';
import { Calendar, ImageDown, Plus } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { HabitCategory } from '../types';
import { HabitCard } from './HabitCard';
import { Heatmap } from './Heatmap';
import { KpiCards } from './KpiCards';
import { ProgressOverview } from './ProgressOverview';

export const Dashboard: React.FC = () => {
  const {
    entities,
    globalStats,
    selectedCategory,
    setSelectedCategory,
    openCreateHabitModal,
    openShareModal,
    setActiveView,
  } = useStore();

  const filters: Array<{ id: 'todos' | HabitCategory; label: string; count: number }> = [
    { id: 'todos', label: 'Todos', count: entities.length },
    { id: 'salud', label: 'Salud', count: globalStats.categoryCounts.salud },
    { id: 'estudio', label: 'Estudio', count: globalStats.categoryCounts.estudio },
    { id: 'trabajo', label: 'Trabajo', count: globalStats.categoryCounts.trabajo },
    { id: 'personal', label: 'Personal', count: globalStats.categoryCounts.personal },
  ];

  const filteredEntities =
    selectedCategory === 'todos'
      ? entities
      : entities.filter((e) => e.category === selectedCategory);

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

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
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
              No hay hábitos registrados en esta categoría
            </p>
            <p className="text-xs text-[#8a8a8a] mt-1 mb-4">
              Crea una nueva rutina para comenzar a construir tu racha diaria.
            </p>
            <button
              type="button"
              onClick={openCreateHabitModal}
              className="inline-flex items-center gap-2 bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Crear primer hábito</span>
            </button>
          </div>
        )}
      </section>

      {/* Recharts Historical Streak Evolution & 3-Month Comparison */}
      <ProgressOverview />
    </div>
  );
};
