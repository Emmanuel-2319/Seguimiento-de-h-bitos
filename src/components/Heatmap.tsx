import React, { useMemo, useState } from 'react';
import { useStore } from '../hooks/useStore';
import type { HeatmapDay } from '../types';
import {
  formatReadableDateEs,
  getDayOfWeek,
  SHORT_MONTHS_ES,
} from '../utils/date';

const LEVEL_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-[#161616] border-[#1f1f1f]',
  1: 'bg-[#35420c] border-[#3f4f0e]',
  2: 'bg-[#647d14] border-[#718d17]',
  3: 'bg-[#9ec421] border-[#abd424]',
  4: 'bg-[#d8f23a] border-[#e2f75d]',
};

export const Heatmap: React.FC = () => {
  const { globalStats, user, jumpToCalendarDate } = useStore();
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);
  const weekStart = user.weekStart ?? 'lunes';

  // Align 112 days into weekly columns according to weekStart (lunes=1 or domingo=0)
  const { columns, monthHeaders, rowLabels } = useMemo(() => {
    const days = globalStats.heatmapDays;
    if (days.length === 0) {
      return {
        columns: [] as Array<Array<HeatmapDay | null>>,
        monthHeaders: [] as string[],
        rowLabels: weekStart === 'domingo' ? ['D', 'L', 'M', 'X', 'J', 'V', 'S'] : ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
      };
    }

    const firstDow = getDayOfWeek(days[0].date);
    const startOffset = weekStart === 'domingo' ? firstDow : (firstDow + 6) % 7;

    const padded: Array<HeatmapDay | null> = [
      ...Array<null>(startOffset).fill(null),
      ...days,
    ];
    while (padded.length % 7 !== 0) {
      padded.push(null);
    }

    const cols: Array<Array<HeatmapDay | null>> = [];
    for (let i = 0; i < padded.length; i += 7) {
      cols.push(padded.slice(i, i + 7));
    }

    let lastMonth = '';
    const mHeaders = cols.map((col) => {
      const firstReal = col.find((c): c is HeatmapDay => c !== null);
      if (!firstReal) return '';
      const ym = firstReal.date.slice(0, 7);
      if (ym !== lastMonth) {
        lastMonth = ym;
        const mIdx = Number(firstReal.date.slice(5, 7)) - 1;
        return SHORT_MONTHS_ES[mIdx] ?? '';
      }
      return '';
    });

    const labels =
      weekStart === 'domingo'
        ? ['D', 'L', 'M', 'X', 'J', 'V', 'S']
        : ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    return { columns: cols, monthHeaders: mHeaders, rowLabels: labels };
  }, [globalStats.heatmapDays, weekStart]);

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
            Densidad consolidada · Haz clic en cualquier casilla para abrir ese día en el calendario.
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

      {/* Commit-style Grid with Weekday & Month Labels + Click to Calendar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex flex-col gap-1">
            {/* Month Labels */}
            <div className="flex items-center gap-1.5 pl-5">
              {monthHeaders.map((mLabel, idx) => (
                <div
                  key={idx}
                  className="w-[15px] text-[10px] font-medium text-[#737373] leading-none overflow-visible whitespace-nowrap"
                >
                  {mLabel}
                </div>
              ))}
            </div>

            <div className="inline-flex gap-1.5" role="grid" aria-label="Últimos 112 días">
              {/* Weekday Labels (show alternating rows L, X, V or D, M, J) */}
              <div className="flex flex-col gap-1.5 pr-1">
                {rowLabels.map((lbl, rIdx) => (
                  <span
                    key={rIdx}
                    className="h-[15px] w-3 flex items-center justify-end text-[9px] font-mono text-[#666666]"
                  >
                    {rIdx % 2 === 0 ? lbl : ''}
                  </span>
                ))}
              </div>

              {columns.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-1.5">
                  {week.map((day, rowIdx) =>
                    day ? (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => jumpToCalendarDate(day.date)}
                        onMouseEnter={() => setHoveredDay(day)}
                        onFocus={() => setHoveredDay(day)}
                        onMouseLeave={() => setHoveredDay(null)}
                        aria-label={`${day.date}: ${day.completedCount} de ${day.totalEntities} completados`}
                        className={`w-[15px] h-[15px] rounded-[3px] border transition-transform hover:scale-125 focus:outline-none focus:ring-1 focus:ring-[#d8f23a] cursor-pointer ${LEVEL_COLORS[day.level]}`}
                      />
                    ) : (
                      <span key={`pad-${weekIdx}-${rowIdx}`} className="w-[15px] h-[15px]" />
                    )
                  )}
                </div>
              ))}
            </div>
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
              Pasa el cursor o haz clic en cualquier casilla para inspeccionar el día
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
