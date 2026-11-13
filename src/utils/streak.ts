import type {
  Activity,
  Entity,
  GlobalStats,
  HabitCategory,
  HabitStats,
  HeatmapDay,
  LocalDate,
  MedalDays,
  MedalStatus,
} from '../types';
import {
  addDays,
  getLastNDates,
  getMonthPrefix,
  isExpectedOccurrence,
} from './date';

const MEDAL_MILESTONES: Array<{ days: MedalDays; label: string }> = [
  { days: 7, label: '7 días continuos' },
  { days: 30, label: '30 días continuos' },
  { days: 100, label: '100 días continuos' },
];

/**
 * Calculates strict habit streak, grace protection, monthly progress, and medals.
 * Rule:
 * - Streak sums completed ('hecho') occurrences from startDate up to today.
 * - If today's occurrence is not completed yet, and graceDays > 0 and active,
 *   the streak does NOT break.
 */
export function calculateHabitStats(
  entity: Entity,
  activities: Activity[],
  today: LocalDate
): HabitStats {
  const byDate = new Map<LocalDate, Activity>();
  for (const act of activities) {
    if (act.entityId === entity.id) {
      byDate.set(act.date, act);
    }
  }

  // Build expected occurrence dates from startDate to today
  const effectiveEnd = entity.endDate && entity.endDate < today ? entity.endDate : today;
  const expectedDates: LocalDate[] = [];
  if (entity.startDate <= effectiveEnd) {
    let cursor = entity.startDate;
    let safety = 0;
    while (cursor <= effectiveEnd && safety < 3650) {
      if (isExpectedOccurrence(cursor, entity.cadence, entity.startDate, entity.endDate)) {
        expectedDates.push(cursor);
      }
      cursor = addDays(cursor, 1);
      safety++;
    }
  }

  // Calculate best historical streak (continuous completed occurrences)
  let bestStreak = 0;
  let running = 0;
  let graceLeftForBest = Math.max(0, entity.graceDays);

  for (let i = 0; i < expectedDates.length; i++) {
    const d = expectedDates[i];
    const act = byDate.get(d);
    if (act?.status === 'hecho') {
      running += 1;
      if (running > bestStreak) bestStreak = running;
    } else if (running > 0 && graceLeftForBest > 0) {
      // Grace protects continuity without adding to completed count
      graceLeftForBest -= 1;
    } else {
      running = 0;
      graceLeftForBest = Math.max(0, entity.graceDays);
    }
  }

  // Calculate current active streak walking backward from effectiveEnd down to startDate
  let currentStreak = 0;
  let graceRemaining = Math.max(0, entity.graceDays);
  let graceUsedToday = false;

  for (let i = expectedDates.length - 1; i >= 0; i--) {
    const d = expectedDates[i];
    const act = byDate.get(d);
    if (act?.status === 'hecho') {
      currentStreak += 1;
    } else if (d === today && graceRemaining > 0) {
      // Today is not completed yet, but active grace prevents the streak from breaking
      graceRemaining -= 1;
      graceUsedToday = true;
    } else if (graceRemaining > 0) {
      // Check if an earlier expected day exists and has 'hecho' so we don't bridge empty tails
      const hasEarlierCompletion =
        i > 0 &&
        expectedDates
          .slice(Math.max(0, i - graceRemaining), i)
          .some((prevD) => byDate.get(prevD)?.status === 'hecho');
      if (hasEarlierCompletion) {
        graceRemaining -= 1;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  if (currentStreak > bestStreak) {
    bestStreak = currentStreak;
  }

  const currentMonth = getMonthPrefix(today);
  let monthlyCompleted = 0;
  for (const act of byDate.values()) {
    if (act.date.startsWith(currentMonth) && act.status === 'hecho') {
      monthlyCompleted += 1;
    }
  }

  const todayAct = byDate.get(today);
  const lastFiveDates = getLastNDates(5, today).map((date) => {
    const act = byDate.get(date);
    return {
      date,
      status: act?.status ?? ('vacio' as const),
      value: act?.value ?? 0,
    };
  });

  const unlockedMedals = MEDAL_MILESTONES.filter((m) => bestStreak >= m.days).map((m) => m.days);

  return {
    currentStreak,
    bestStreak,
    graceActive: entity.graceDays > 0 && (currentStreak > 0 || graceUsedToday),
    graceUsedToday,
    monthlyCompleted,
    todayStatus: todayAct?.status ?? 'vacio',
    todayValue: todayAct?.value ?? 0,
    lastFiveDays: lastFiveDates,
    unlockedMedals,
  };
}

export function calculateGlobalStats(
  entities: Entity[],
  activities: Activity[],
  today: LocalDate
): GlobalStats {
  const statsList = entities.map((entity) => ({
    entity,
    stats: calculateHabitStats(entity, activities, today),
  }));

  let maxStreak = 0;
  let maxStreakHabitName = 'Sin hábitos activos';
  let maxStreakGraceDays = 0;
  let maxStreakGraceActive = false;

  for (const { entity, stats } of statsList) {
    if (
      stats.currentStreak > maxStreak ||
      (stats.currentStreak === maxStreak && entity.graceDays > maxStreakGraceDays)
    ) {
      maxStreak = stats.currentStreak;
      maxStreakHabitName = entity.name;
      maxStreakGraceDays = entity.graceDays;
      maxStreakGraceActive = stats.graceActive;
    }
  }

  const activeEntities = entities.filter(
    (e) => e.startDate <= today && (!e.endDate || e.endDate >= today)
  );
  const todayCompletedCount = statsList.filter(
    ({ entity, stats }) =>
      activeEntities.some((ae) => ae.id === entity.id) && stats.todayStatus === 'hecho'
  ).length;

  const todayCompletionPct =
    activeEntities.length > 0
      ? Math.round((todayCompletedCount / activeEntities.length) * 100)
      : 0;

  const categoryCounts: Record<HabitCategory, number> = {
    salud: 0,
    estudio: 0,
    trabajo: 0,
    personal: 0,
  };
  const activeCategorySet = new Set<HabitCategory>();
  for (const entity of entities) {
    categoryCounts[entity.category] += 1;
    activeCategorySet.add(entity.category);
  }

  const medals: MedalStatus[] = MEDAL_MILESTONES.map((milestone) => {
    const winner = statsList.find(({ stats }) => stats.bestStreak >= milestone.days);
    return {
      days: milestone.days,
      label: milestone.label,
      unlocked: Boolean(winner),
      unlockedBy: winner?.entity.name,
    };
  });

  // 16 weeks * 7 days = 112 days ending today
  const last112Dates = getLastNDates(112, today);
  const activitiesByDate = new Map<LocalDate, Activity[]>();
  for (const act of activities) {
    const list = activitiesByDate.get(act.date) ?? [];
    list.push(act);
    activitiesByDate.set(act.date, list);
  }

  let totalRatioSum = 0;
  let activeDaysInWindow = 0;

  const heatmapDays: HeatmapDay[] = last112Dates.map((date) => {
    const activeOnDate = entities.filter(
      (e) => e.startDate <= date && (!e.endDate || e.endDate >= date)
    );
    const totalEntities = activeOnDate.length;
    const dayActs = activitiesByDate.get(date) ?? [];
    const activeIds = new Set(activeOnDate.map((e) => e.id));

    let completedCount = 0;
    let partialCount = 0;
    for (const act of dayActs) {
      if (!activeIds.has(act.entityId)) continue;
      if (act.status === 'hecho') completedCount += 1;
      else if (act.status === 'parcial') partialCount += 1;
    }

    const score = completedCount + partialCount * 0.5;
    const ratio = totalEntities > 0 ? Math.min(1, score / totalEntities) : 0;

    if (totalEntities > 0) {
      totalRatioSum += ratio;
      activeDaysInWindow += 1;
    }

    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (ratio > 0 && ratio < 0.35) level = 1;
    else if (ratio >= 0.35 && ratio < 0.65) level = 2;
    else if (ratio >= 0.65 && ratio < 0.95) level = 3;
    else if (ratio >= 0.95) level = 4;

    return {
      date,
      completedCount,
      partialCount,
      totalEntities,
      ratio,
      level,
    };
  });

  const consistencyPct =
    activeDaysInWindow > 0 ? Math.round((totalRatioSum / activeDaysInWindow) * 100) : 0;

  return {
    maxStreak,
    maxStreakHabitName,
    maxStreakGraceDays,
    maxStreakGraceActive,
    todayCompletionPct,
    todayCompletedCount,
    activeCount: entities.length,
    activeCategories: Array.from(activeCategorySet),
    categoryCounts,
    medals,
    heatmapDays,
    consistencyPct,
    registeredDaysCount: last112Dates.length,
  };
}

export interface DailyStreakPoint {
  date: LocalDate;
  shortLabel: string;
  monthKey: string;
  dayOfMonth: number;
  totalStreakSum: number;
  completedCount: number;
  activeCount: number;
}

export interface MonthDayOverlayPoint {
  day: number;
  m0: number | null;
  m1: number | null;
  m2: number | null;
}

export interface MonthlyComparisonSummary {
  monthKey: string;
  label: string;
  shortLabel: string;
  avgStreakSum: number;
  peakStreakSum: number;
  completedMarks: number;
  consistencyPct: number;
}

export interface StreakProgressOverviewData {
  dailySeries: DailyStreakPoint[];
  monthDayOverlay: MonthDayOverlayPoint[];
  monthlySummaries: MonthlyComparisonSummary[];
  monthLabels: [string, string, string];
  currentTotalStreak: number;
  deltaVsPrevPct: number;
}

const SHORT_MONTHS_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

function shiftMonth(year: number, monthZeroBased: number, deltaMonths: number): {
  year: number;
  month: number;
  key: string;
  label: string;
  shortLabel: string;
} {
  const total = year * 12 + monthZeroBased + deltaMonths;
  const targetYear = Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12;
  const key = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
  const shortLabel = `${SHORT_MONTHS_ES[targetMonth]} ${String(targetYear).slice(2)}`;
  const label = `${SHORT_MONTHS_ES[targetMonth]} ${targetYear}`;
  return { year: targetYear, month: targetMonth, key, label, shortLabel };
}

/**
 * Computes the day-by-day sum of active streaks across all habits over the last 3 months
 * plus normalized day-of-month overlay and monthly comparison summaries.
 */
export function calculateStreakProgressOverview(
  entities: Entity[],
  activities: Activity[],
  today: LocalDate
): StreakProgressOverviewData {
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7)) - 1;

  const months = [
    shiftMonth(todayYear, todayMonth, -2),
    shiftMonth(todayYear, todayMonth, -1),
    shiftMonth(todayYear, todayMonth, 0),
  ];

  const startDate: LocalDate = `${months[0].key}-01`;
  const dailySeries: DailyStreakPoint[] = [];

  // Pre-index activities by entity+date for fast lookup
  const actMap = new Map<string, Activity>();
  for (const act of activities) {
    actMap.set(`${act.entityId}::${act.date}`, act);
  }

  let cursor = startDate;
  let safety = 0;
  while (cursor <= today && safety < 140) {
    let totalStreakSum = 0;
    let completedCount = 0;
    let activeCount = 0;

    for (const entity of entities) {
      if (entity.startDate > cursor || (entity.endDate && entity.endDate < cursor)) {
        continue;
      }
      activeCount += 1;
      const actToday = actMap.get(`${entity.id}::${cursor}`);
      if (actToday?.status === 'hecho') {
        completedCount += 1;
      }
      const stats = calculateHabitStats(entity, activities, cursor);
      totalStreakSum += stats.currentStreak;
    }

    const monthIdx = Number(cursor.slice(5, 7)) - 1;
    const dayNum = Number(cursor.slice(8, 10));
    dailySeries.push({
      date: cursor,
      shortLabel: `${dayNum} ${SHORT_MONTHS_ES[monthIdx]}`,
      monthKey: cursor.slice(0, 7),
      dayOfMonth: dayNum,
      totalStreakSum,
      completedCount,
      activeCount,
    });

    cursor = addDays(cursor, 1);
    safety++;
  }

  // Build 1..31 overlay across the 3 months
  const byMonthDay = new Map<string, number>();
  for (const pt of dailySeries) {
    byMonthDay.set(`${pt.monthKey}::${pt.dayOfMonth}`, pt.totalStreakSum);
  }

  const monthDayOverlay: MonthDayOverlayPoint[] = [];
  for (let d = 1; d <= 31; d++) {
    monthDayOverlay.push({
      day: d,
      m0: byMonthDay.get(`${months[0].key}::${d}`) ?? null,
      m1: byMonthDay.get(`${months[1].key}::${d}`) ?? null,
      m2: byMonthDay.get(`${months[2].key}::${d}`) ?? null,
    });
  }

  const monthlySummaries: MonthlyComparisonSummary[] = months.map((m) => {
    const pts = dailySeries.filter((p) => p.monthKey === m.key);
    if (pts.length === 0) {
      return {
        monthKey: m.key,
        label: m.label,
        shortLabel: m.shortLabel,
        avgStreakSum: 0,
        peakStreakSum: 0,
        completedMarks: 0,
        consistencyPct: 0,
      };
    }

    let sumStreak = 0;
    let peak = 0;
    let completedMarks = 0;
    let possibleMarks = 0;

    for (const p of pts) {
      sumStreak += p.totalStreakSum;
      if (p.totalStreakSum > peak) peak = p.totalStreakSum;
      completedMarks += p.completedCount;
      possibleMarks += p.activeCount;
    }

    return {
      monthKey: m.key,
      label: m.label,
      shortLabel: m.shortLabel,
      avgStreakSum: Math.round(sumStreak / pts.length),
      peakStreakSum: peak,
      completedMarks,
      consistencyPct:
        possibleMarks > 0 ? Math.round((completedMarks / possibleMarks) * 100) : 0,
    };
  });

  const currentTotalStreak =
    dailySeries.length > 0 ? dailySeries[dailySeries.length - 1].totalStreakSum : 0;

  const prevAvg = monthlySummaries[1].avgStreakSum;
  const currAvg = monthlySummaries[2].avgStreakSum;
  const deltaVsPrevPct =
    prevAvg > 0 ? Math.round(((currAvg - prevAvg) / prevAvg) * 100) : currAvg > 0 ? 100 : 0;

  return {
    dailySeries,
    monthDayOverlay,
    monthlySummaries,
    monthLabels: [months[0].label, months[1].label, months[2].label],
    currentTotalStreak,
    deltaVsPrevPct,
  };
}

