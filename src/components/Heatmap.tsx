import React, { useMemo, useState } from 'react';
import { useStore } from '../hooks/useStore';
import type { HeatmapDay } from '../types';
import { formatReadableDateEs } from '../utils/date';

const LEVEL_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-[#161616] border-[#1f1f1f]',
  1: 'bg-[#35420c] border-[#3f4f0e]',
  2: 'bg-[#647d14] border-[#718d17]',
  3: 'bg-[#9ec421] border-[#abd424]',
  4: 'bg-[#d8f23a] border-[#e2f75d]',
};

export const Heatmap: React.FC = () => {
  const { globalStats } = useStore();
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);

  // Organize 112 days into 16 columns x 7 rows (column-major, GitHub commits style)
  const weeks = useMemo(() => {
    const cols: HeatmapDay[][] = [];
    for (let w = 0; w < 16; w++) {
      cols.push(globalStats.heatmapDays.slice(w * 7, w * 7 + 7));
    }
    return cols;
  }, [globalStats.heatmapDays]);

  return (
    <section
      aria-label="Mapa de consistencia global"
      className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              MAPA DE CONSISTENCIA GLOBAL
            </h2>
            <span className="bg-[#141414] border border-[#242424] text-[#8a8a8a] text-[11px] px-2.5 py-0.5 rounded-lg whitespace-nowrap">
              Estilo commits / 16 semanas
            </span>
          </div>
          <p className="text-xs text-[#8a8a8a] mt-1">
            Densidad de cumplimiento consolidada en todos los hábitos registrados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="text-[#8a8a8a] tabular-nums">
            Días registrados:{' '}
            <span className="text-white font-semibold">{globalStats.registeredDaysCount}</span>
          </div>
          <div className="text-[#8a8a8a] tabular-nums">
            Consistencia:{' '}
            <span className="text-[#d8f23a] font-semibold">{globalStats.consistencyPct}%</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#8a8a8a]">
            <span>Menos</span>
            {([0, 1, 2, 3, 4] as const).map((lvl) => (
              <span
                key={lvl}
                className={`w-3 h-3 rounded-[3px] border ${LEVEL_COLORS[lvl]}`}
                aria-hidden="true"
              />
            ))}
            <span>Más</span>
          </div>
        </div>
      </div>

      {/* Commit-style 16x7 Grid + Interactive Hover Readout */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex gap-1.5" role="grid" aria-label="Últimos 112 días">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-1.5">
                {week.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    onMouseEnter={() => setHoveredDay(day)}
                    onFocus={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    aria-label={`${day.date}: ${day.completedCount} de ${day.totalEntities} completados`}
                    className={`w-[15px] h-[15px] rounded-[3px] border transition-transform hover:scale-125 focus:outline-none focus:ring-1 focus:ring-[#d8f23a] cursor-pointer ${LEVEL_COLORS[day.level]}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-[24px] text-xs text-[#8a8a8a] tabular-nums">
          {hoveredDay ? (
            <div className="inline-flex items-center gap-2 bg-[#141414] border border-[#242424] rounded-lg px-3 py-1.5">
              <span className="text-white font-medium">
                {formatReadableDateEs(hoveredDay.date)} ({hoveredDay.date})
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#d8f23a] font-semibold">
                {hoveredDay.completedCount}/{hoveredDay.totalEntities} hechos
              </span>
              {hoveredDay.partialCount > 0 && (
                <span>({hoveredDay.partialCount} parcial)</span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-[#666666]">
              Pasa el cursor por cualquier casilla para ver el detalle diario
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
