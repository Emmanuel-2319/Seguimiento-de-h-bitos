import React from 'react';
import { Award, CheckCircle2, Crown, Flame } from 'lucide-react';
import { useStore } from '../hooks/useStore';

export const KpiCards: React.FC = () => {
  const { globalStats } = useStore();

  const categorySummary =
    globalStats.activeCategories.length > 0
      ? globalStats.activeCategories.join(', ')
      : 'ninguna';

  const medalIcons = {
    7: Award,
    30: CheckCircle2,
    100: Crown,
  } as const;

  const unlockedCount = globalStats.medals.filter((m) => m.unlocked).length;

  return (
    <section
      aria-label="Indicadores clave"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {/* KPI 1: Racha Activa Máxima */}
      <div className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-5 flex flex-col justify-between min-h-[132px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#8a8a8a]">
            RACHA ACTIVA MÁXIMA
          </span>
          {globalStats.maxStreakGraceDays > 0 && (
            <span
              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-lg border whitespace-nowrap ${
                globalStats.maxStreakGraceActive
                  ? 'bg-[#161a08] border-[#2d360d] text-[#d8f23a]'
                  : 'bg-[#141414] border-[#242424] text-[#8a8a8a]'
              }`}
            >
              Gracia: {globalStats.maxStreakGraceDays}d{' '}
              {globalStats.maxStreakGraceActive ? 'activa' : 'lista'}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2 my-2">
          <Flame className="w-5 h-5 text-[#d8f23a] shrink-0 translate-y-0.5" />
          <span className="text-3xl font-bold text-white tabular-nums tracking-tight">
            {globalStats.maxStreak}
          </span>
          <span className="text-sm text-[#8a8a8a]">días</span>
        </div>

        <p className="text-xs text-[#8a8a8a] truncate">{globalStats.maxStreakHabitName}</p>
      </div>

      {/* KPI 2: Cumplimiento Hoy */}
      <div className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-5 flex flex-col justify-between min-h-[132px]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#8a8a8a]">
            CUMPLIMIENTO HOY
          </span>
          <span className="text-[11px] text-[#8a8a8a] tabular-nums">
            {globalStats.todayCompletedCount}/{globalStats.activeCount}
          </span>
        </div>

        <div className="my-2">
          <span className="text-3xl font-bold text-white tabular-nums tracking-tight">
            {globalStats.todayCompletionPct}%
          </span>
        </div>

        <div
          className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={globalStats.todayCompletionPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-[#d8f23a] rounded-full transition-all duration-300"
            style={{ width: `${globalStats.todayCompletionPct}%` }}
          />
        </div>
      </div>

      {/* KPI 3: Hábitos Activos */}
      <div className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-5 flex flex-col justify-between min-h-[132px]">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#8a8a8a]">
          HÁBITOS ACTIVOS
        </span>

        <div className="flex items-baseline gap-2 my-2">
          <span className="text-3xl font-bold text-white tabular-nums tracking-tight">
            {globalStats.activeCount}
          </span>
          <span className="text-sm text-[#8a8a8a]">
            {globalStats.activeCount === 1 ? 'rutina' : 'rutinas'}
          </span>
        </div>

        <p className="text-xs text-[#8a8a8a] truncate">Categorías: {categorySummary}</p>
      </div>

      {/* KPI 4: Medallas Obtenidas */}
      <div className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-5 flex flex-col justify-between min-h-[132px]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#8a8a8a]">
            MEDALLAS OBTENIDAS
          </span>
          <span className="text-[11px] text-[#8a8a8a] tabular-nums">
            {unlockedCount}/3
          </span>
        </div>

        <div className="flex items-center gap-3 my-2">
          {globalStats.medals.map((medal) => {
            const Icon = medalIcons[medal.days];
            return (
              <div
                key={medal.days}
                title={
                  medal.unlocked
                    ? `Desbloqueada (${medal.label}) — ${medal.unlockedBy}${
                        medal.unlockedDate ? ` · ${medal.unlockedDate}` : ''
                      }`
                    : `Bloqueada: alcanza ${medal.label}`
                }
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-colors ${
                  medal.unlocked
                    ? 'bg-[#161a08] border-[#34420e] text-[#d8f23a]'
                    : 'bg-[#121212] border-[#1f1f1f] text-[#4a4a4a]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[11px] font-semibold tabular-nums">{medal.days}d</span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-[#8a8a8a] truncate tabular-nums">
          {(() => {
            const latest = globalStats.medals
              .filter((m) => m.unlocked && m.unlockedDate)
              .sort((a, b) => (b.unlockedDate || '').localeCompare(a.unlockedDate || ''))[0];
            return latest
              ? `Última: ${latest.days}d el ${latest.unlockedDate}`
              : 'Hitos 7, 30 y 100 días';
          })()}
        </p>
      </div>
    </section>
  );
};
