import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { HabitCategory } from '../types';
import {
  calculateStreakProgressOverview,
  type ProgressRangeDays,
} from '../utils/streak';

type ChartMode = 'evolucion' | 'comparativa';

const RANGE_OPTIONS: Array<{ days: ProgressRangeDays; label: string }> = [
  { days: 30, label: '30d' },
  { days: 90, label: '3m' },
  { days: 180, label: '6m' },
  { days: 365, label: '1a' },
];

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: CustomTooltipPayloadItem[];
  unitSuffix?: string;
}

const DarkChartTooltip: React.FC<CustomTooltipProps> = ({
  active,
  label,
  payload,
  unitSuffix = 'd',
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-[#0b0b0b] border border-[#2a2a2a] rounded-xl px-3.5 py-2.5 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-white tabular-nums">{label}</p>
      {payload.map((entry, idx) => (
        <div
          key={`${entry.dataKey}-${idx}`}
          className="flex items-center justify-between gap-4 tabular-nums"
        >
          <span className="flex items-center gap-1.5 text-[#8a8a8a]">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color || '#d8f23a' }}
            />
            <span>{entry.name}</span>
          </span>
          <span className="font-bold text-white">
            {entry.value}
            {unitSuffix}
          </span>
        </div>
      ))}
    </div>
  );
};

export const ProgressOverview: React.FC = () => {
  const { entities, activities, today } = useStore();
  const [chartMode, setChartMode] = useState<ChartMode>('evolucion');
  const [rangeDays, setRangeDays] = useState<ProgressRangeDays>(90);
  const [scopeFilter, setScopeFilter] = useState<string>('todos');

  const overview = useMemo(() => {
    if (scopeFilter.startsWith('hab:')) {
      return calculateStreakProgressOverview(entities, activities, today, {
        rangeDays,
        entityId: scopeFilter.slice(4),
      });
    }
    const category =
      scopeFilter.startsWith('cat:')
        ? (scopeFilter.slice(4) as HabitCategory)
        : 'todos';
    return calculateStreakProgressOverview(entities, activities, today, {
      rangeDays,
      category,
    });
  }, [entities, activities, today, rangeDays, scopeFilter]);

  const isPositiveDelta = overview.deltaVsPrevPct >= 0;
  const activeRangeLabel =
    RANGE_OPTIONS.find((r) => r.days === rangeDays)?.label ?? '3m';

  return (
    <section
      aria-label="Resumen de progreso y comparativa trimestral"
      className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-5 sm:p-6 space-y-5"
    >
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              EVOLUCIÓN DE RACHAS ACUMULADAS
            </h2>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg border tabular-nums ${
                isPositiveDelta
                  ? 'bg-[#161a08] border-[#2d360d] text-[#d8f23a]'
                  : 'bg-[#2a1212] border-[#522020] text-red-400'
              }`}
            >
              {isPositiveDelta ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>
                {isPositiveDelta ? '+' : ''}
                {overview.deltaVsPrevPct}% vs mes anterior
              </span>
            </span>
          </div>
          <p className="text-xs text-[#8a8a8a] mt-1">
            Filtra por categoría o hábito individual y analiza tu consistencia por ventana temporal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Category / Habit Filter */}
          <select
            aria-label="Filtrar analítica por categoría o hábito"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="bg-[#121212] border border-[#222222] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3 py-1.5 outline-none max-w-[200px]"
          >
            <option value="todos">Todos los hábitos</option>
            <optgroup label="Por categoría">
              <option value="cat:salud">Categoría: Salud</option>
              <option value="cat:estudio">Categoría: Estudio</option>
              <option value="cat:trabajo">Categoría: Trabajo</option>
              <option value="cat:personal">Categoría: Personal</option>
            </optgroup>
            {entities.length > 0 && (
              <optgroup label="Hábito individual">
                {entities.map((ent) => (
                  <option key={ent.id} value={`hab:${ent.id}`}>
                    {ent.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Range Switcher (only relevant for evolucion, kept accessible) */}
          {chartMode === 'evolucion' && (
            <div className="flex items-center gap-0.5 bg-[#121212] border border-[#222222] rounded-xl p-1">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setRangeDays(opt.days)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    rangeDays === opt.days
                      ? 'bg-[#20260b] text-[#d8f23a] font-semibold'
                      : 'text-[#8a8a8a] hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Chart Mode Switch */}
          <div className="flex items-center gap-1 bg-[#121212] border border-[#222222] rounded-xl p-1">
            <button
              type="button"
              onClick={() => setChartMode('evolucion')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                chartMode === 'evolucion'
                  ? 'bg-[#d8f23a] text-black font-semibold'
                  : 'text-[#8a8a8a] hover:text-white'
              }`}
            >
              Evolución
            </button>
            <button
              type="button"
              onClick={() => setChartMode('comparativa')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                chartMode === 'comparativa'
                  ? 'bg-[#d8f23a] text-black font-semibold'
                  : 'text-[#8a8a8a] hover:text-white'
              }`}
            >
              Superponer 3 meses
            </button>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Primary Historical Chart (2 cols) */}
        <div className="lg:col-span-2 bg-[#070707] border border-[#181818] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-white">
              {chartMode === 'evolucion'
                ? `Suma diaria de rachas activas (${activeRangeLabel})`
                : 'Comparativa día a día (1–31) entre los últimos 3 meses'}
            </span>
            <span className="text-xs text-[#8a8a8a] tabular-nums">
              Actual:{' '}
              <strong className="text-[#d8f23a]">{overview.currentTotalStreak} d</strong>
            </span>
          </div>

          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'evolucion' ? (
                <AreaChart
                  data={overview.dailySeries}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="rachaSumGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d8f23a" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#d8f23a" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#181818" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="shortLabel"
                    stroke="#666666"
                    tick={{ fill: '#8a8a8a', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#1f1f1f' }}
                    minTickGap={24}
                  />
                  <YAxis
                    stroke="#666666"
                    tick={{ fill: '#8a8a8a', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<DarkChartTooltip unitSuffix=" d" />}
                    cursor={{ stroke: '#333333', strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalStreakSum"
                    name="Suma de rachas"
                    stroke="#d8f23a"
                    strokeWidth={2.2}
                    fill="url(#rachaSumGrad)"
                    activeDot={{ r: 4, fill: '#d8f23a', stroke: '#000000', strokeWidth: 2 }}
                  />
                </AreaChart>
              ) : (
                <LineChart
                  data={overview.monthDayOverlay}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid stroke="#181818" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="day"
                    stroke="#666666"
                    tick={{ fill: '#8a8a8a', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#1f1f1f' }}
                  />
                  <YAxis
                    stroke="#666666"
                    tick={{ fill: '#8a8a8a', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<DarkChartTooltip unitSuffix=" d" />}
                    cursor={{ stroke: '#333333', strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="m0"
                    name={overview.monthLabels[0]}
                    stroke="#525252"
                    strokeWidth={1.75}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="m1"
                    name={overview.monthLabels[1]}
                    stroke="#7f9a18"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="m2"
                    name={overview.monthLabels[2]}
                    stroke="#d8f23a"
                    strokeWidth={2.6}
                    dot={false}
                    activeDot={{ r: 4, fill: '#d8f23a', stroke: '#000000', strokeWidth: 2 }}
                    connectNulls
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3-Month Bar Comparison + Metrics (1 col) */}
        <div className="bg-[#070707] border border-[#181818] rounded-xl p-4 flex flex-col justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-white">
              Comparativa últimos 3 meses
            </span>
            <p className="text-[11px] text-[#8a8a8a] mt-0.5">
              Promedio vs pico de suma de rachas
            </p>
          </div>

          <div className="w-full h-[165px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overview.monthlySummaries}
                margin={{ top: 6, right: 6, left: -20, bottom: 0 }}
              >
                <CartesianGrid stroke="#181818" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  stroke="#666666"
                  tick={{ fill: '#8a8a8a', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#1f1f1f' }}
                />
                <YAxis
                  stroke="#666666"
                  tick={{ fill: '#8a8a8a', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<DarkChartTooltip unitSuffix=" d" />}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar
                  dataKey="avgStreakSum"
                  name="Promedio"
                  fill="#647d14"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="peakStreakSum"
                  name="Máximo"
                  fill="#d8f23a"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {overview.monthlySummaries.map((m, idx) => (
              <div
                key={m.monthKey}
                className={`rounded-lg border px-2.5 py-2 text-center ${
                  idx === 2
                    ? 'bg-[#161a08] border-[#34420e]'
                    : 'bg-[#0e0e0e] border-[#1c1c1c]'
                }`}
              >
                <span className="block text-[10px] text-[#8a8a8a] truncate">
                  {m.shortLabel}
                </span>
                <span
                  className={`block text-xs font-bold tabular-nums mt-0.5 ${
                    idx === 2 ? 'text-[#d8f23a]' : 'text-white'
                  }`}
                >
                  {m.consistencyPct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
