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
  StreakMilestoneEvent,
  StreakMilestoneTimelineData,
  UpcomingMilestone,
} from '../types';
import {
  addDays,
  getLastNDates,
  getMonthPrefix,
  isExpectedOccurrence,
} from './date';

const MEDAL_MILESTONES: Array<{ days: MedalDays; label: string; title: string }> = [
  { days: 7, label: '7 días continuos', title: 'Constancia Inicial · 7 días' },
  { days: 30, label: '30 días continuos', title: 'Disciplina Consolidada · 30 días' },
  { days: 100, label: '100 días continuos', title: 'Maestría Inquebrantable · 100 días' },
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
      if (isExpectedOccurrence(cursor, entity.cadence, entity.startDate, entity.endDate, entity.customDays)) {
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
      expected: isExpectedOccurrence(
        date,
        entity.cadence,
        entity.startDate,
        entity.endDate,
        entity.customDays
      ),
      note: act?.note,
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
  const expectedTodayEntities = activeEntities.filter((e) =>
    isExpectedOccurrence(today, e.cadence, e.startDate, e.endDate, e.customDays)
  );
  const denominatorEntities =
    expectedTodayEntities.length > 0 ? expectedTodayEntities : activeEntities;

  const todayCompletedCount = statsList.filter(
    ({ entity, stats }) =>
      denominatorEntities.some((ae) => ae.id === entity.id) && stats.todayStatus === 'hecho'
  ).length;

  const todayCompletionPct =
    denominatorEntities.length > 0
      ? Math.round((todayCompletedCount / denominatorEntities.length) * 100)
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

  const timeline = calculateStreakMilestoneTimeline(entities, activities, today);

  const medals: MedalStatus[] = MEDAL_MILESTONES.map((milestone) => {
    const firstEvent = timeline.events
      .filter((ev) => ev.days === milestone.days)
      .sort((a, b) => a.unlockedDate.localeCompare(b.unlockedDate))[0];
    const fallbackWinner = statsList.find(({ stats }) => stats.bestStreak >= milestone.days);
    return {
      days: milestone.days,
      label: milestone.label,
      unlocked: Boolean(firstEvent || fallbackWinner),
      unlockedBy: firstEvent?.habitName ?? fallbackWinner?.entity.name,
      unlockedDate: firstEvent?.unlockedDate,
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

export type ProgressRangeDays = 30 | 90 | 180 | 365;

export interface ProgressOverviewOptions {
  rangeDays?: ProgressRangeDays;
  category?: 'todos' | HabitCategory;
  entityId?: string;
}

/**
 * Returns true if a specific expected date <= today was protected by the habit's graceDays
 * (i.e. not marked 'hecho' while an active streak was preserved across it).
 */
export function wasDayProtectedByGrace(
  entity: Entity,
  activities: Activity[],
  date: LocalDate,
  today: LocalDate
): boolean {
  if (entity.graceDays <= 0 || date > today || date < entity.startDate) return false;
  if (!isExpectedOccurrence(date, entity.cadence, entity.startDate, entity.endDate, entity.customDays)) {
    return false;
  }

  const byDate = new Map<LocalDate, Activity>();
  for (const act of activities) {
    if (act.entityId === entity.id) {
      byDate.set(act.date, act);
    }
  }
  if (byDate.get(date)?.status === 'hecho') return false;

  const effectiveEnd = entity.endDate && entity.endDate < today ? entity.endDate : today;
  const expectedDates: LocalDate[] = [];
  let cursor = entity.startDate;
  let safety = 0;
  while (cursor <= effectiveEnd && safety < 3650) {
    if (isExpectedOccurrence(cursor, entity.cadence, entity.startDate, entity.endDate, entity.customDays)) {
      expectedDates.push(cursor);
    }
    cursor = addDays(cursor, 1);
    safety++;
  }

  let graceRemaining = Math.max(0, entity.graceDays);
  let activeStreak = 0;

  for (let i = expectedDates.length - 1; i >= 0; i--) {
    const d = expectedDates[i];
    const act = byDate.get(d);
    if (act?.status === 'hecho') {
      activeStreak += 1;
    } else if (d === today && graceRemaining > 0) {
      if (d === date) {
        const hasEarlier =
          i > 0 &&
          expectedDates
            .slice(Math.max(0, i - graceRemaining), i)
            .some((prevD) => byDate.get(prevD)?.status === 'hecho');
        return hasEarlier || activeStreak > 0;
      }
      graceRemaining -= 1;
    } else if (graceRemaining > 0) {
      const hasEarlierCompletion =
        i > 0 &&
        expectedDates
          .slice(Math.max(0, i - graceRemaining), i)
          .some((prevD) => byDate.get(prevD)?.status === 'hecho');
      if (hasEarlierCompletion) {
        if (d === date) return true;
        graceRemaining -= 1;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return false;
}

/**
 * Computes the day-by-day sum of active streaks across filtered habits over the chosen window
 * (30d / 90d / 180d / 365d) plus normalized day-of-month overlay and monthly comparison summaries.
 */
export function calculateStreakProgressOverview(
  entities: Entity[],
  activities: Activity[],
  today: LocalDate,
  options?: ProgressOverviewOptions
): StreakProgressOverviewData {
  const filteredEntities = entities.filter((e) => {
    if (options?.entityId) return e.id === options.entityId;
    if (options?.category && options.category !== 'todos') {
      return e.category === options.category;
    }
    return true;
  });

  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7)) - 1;

  const months = [
    shiftMonth(todayYear, todayMonth, -2),
    shiftMonth(todayYear, todayMonth, -1),
    shiftMonth(todayYear, todayMonth, 0),
  ];

  const threeMonthStart: LocalDate = `${months[0].key}-01`;
  const rangeDays = options?.rangeDays ?? 90;
  const rangeStart = addDays(today, -(rangeDays - 1));
  const earliestNeeded = rangeStart < threeMonthStart ? rangeStart : threeMonthStart;

  // Pre-index activities by entityId -> Map<date, Activity>
  const actByEntity = new Map<string, Map<LocalDate, Activity>>();
  for (const act of activities) {
    let map = actByEntity.get(act.entityId);
    if (!map) {
      map = new Map<LocalDate, Activity>();
      actByEntity.set(act.entityId, map);
    }
    map.set(act.date, act);
  }

  // Precompute per-habit daily streak map forward from entity.startDate in O(days)
  const habitStreakMaps = new Map<string, Map<LocalDate, number>>();
  for (const entity of filteredEntities) {
    const map = new Map<LocalDate, number>();
    habitStreakMaps.set(entity.id, map);
    if (entity.startDate > today) continue;

    const actMap = actByEntity.get(entity.id) ?? new Map<LocalDate, Activity>();
    const effectiveEnd = entity.endDate && entity.endDate < today ? entity.endDate : today;
    let cursor = entity.startDate;
    let running = 0;
    let graceLeft = Math.max(0, entity.graceDays);
    let safety = 0;

    while (cursor <= effectiveEnd && safety < 3650) {
      if (isExpectedOccurrence(cursor, entity.cadence, entity.startDate, entity.endDate, entity.customDays)) {
        const act = actMap.get(cursor);
        if (act?.status === 'hecho') {
          running += 1;
          graceLeft = Math.max(0, entity.graceDays);
        } else if (running > 0 && graceLeft > 0) {
          graceLeft -= 1;
        } else {
          running = 0;
          graceLeft = Math.max(0, entity.graceDays);
        }
      }
      if (cursor >= earliestNeeded) {
        map.set(cursor, running);
      }
      cursor = addDays(cursor, 1);
      safety++;
    }
  }

  const allSeries: DailyStreakPoint[] = [];
  let cursor = earliestNeeded;
  let safety = 0;
  while (cursor <= today && safety < 420) {
    let totalStreakSum = 0;
    let completedCount = 0;
    let activeCount = 0;

    for (const entity of filteredEntities) {
      if (entity.startDate > cursor || (entity.endDate && entity.endDate < cursor)) {
        continue;
      }
      activeCount += 1;
      const actToday = actByEntity.get(entity.id)?.get(cursor);
      if (actToday?.status === 'hecho') {
        completedCount += 1;
      }
      totalStreakSum += habitStreakMaps.get(entity.id)?.get(cursor) ?? 0;
    }

    const monthIdx = Number(cursor.slice(5, 7)) - 1;
    const dayNum = Number(cursor.slice(8, 10));
    allSeries.push({
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

  const dailySeries = allSeries.filter((pt) => pt.date >= rangeStart);

  // Build 1..31 overlay across the 3 months
  const byMonthDay = new Map<string, number>();
  for (const pt of allSeries) {
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
    const pts = allSeries.filter((p) => p.monthKey === m.key);
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

/**
 * Walks each habit chronologically from startDate to today (or endDate) and captures
 * the exact date on which each medal milestone (7, 30, 100 days) was first unlocked.
 */
export function calculateStreakMilestoneTimeline(
  entities: Entity[],
  activities: Activity[],
  today: LocalDate
): StreakMilestoneTimelineData {
  const rawEvents: Array<Omit<StreakMilestoneEvent, 'isFirstOfTier'>> = [];
  const upcoming: UpcomingMilestone[] = [];
  const tierTotals: Record<MedalDays, number> = { 7: 0, 30: 0, 100: 0 };

  for (const entity of entities) {
    const byDate = new Map<LocalDate, Activity>();
    for (const act of activities) {
      if (act.entityId === entity.id) {
        byDate.set(act.date, act);
      }
    }

    const stats = calculateHabitStats(entity, activities, today);
    const effectiveEnd = entity.endDate && entity.endDate < today ? entity.endDate : today;

    const unlockedForHabit = new Set<MedalDays>();
    if (entity.startDate <= effectiveEnd) {
      let cursor = entity.startDate;
      let running = 0;
      let graceLeft = Math.max(0, entity.graceDays);
      let safety = 0;

      while (cursor <= effectiveEnd && safety < 3650) {
        if (isExpectedOccurrence(cursor, entity.cadence, entity.startDate, entity.endDate, entity.customDays)) {
          const act = byDate.get(cursor);
          if (act?.status === 'hecho') {
            running += 1;
            graceLeft = Math.max(0, entity.graceDays);
            for (const milestone of MEDAL_MILESTONES) {
              if (running >= milestone.days && !unlockedForHabit.has(milestone.days)) {
                unlockedForHabit.add(milestone.days);
                tierTotals[milestone.days] += 1;
                rawEvents.push({
                  id: `${entity.id}-${milestone.days}`,
                  entityId: entity.id,
                  habitName: entity.name,
                  category: entity.category,
                  days: milestone.days,
                  medalTitle: milestone.title,
                  unlockedDate: cursor,
                  currentStreak: stats.currentStreak,
                  bestStreak: stats.bestStreak,
                });
              }
            }
          } else if (running > 0 && graceLeft > 0) {
            graceLeft -= 1;
          } else {
            running = 0;
            graceLeft = Math.max(0, entity.graceDays);
          }
        }
        cursor = addDays(cursor, 1);
        safety++;
      }
    }

    // Next milestone target for active habits
    const isActiveToday = !entity.endDate || entity.endDate >= today;
    if (isActiveToday) {
      const nextMilestone = MEDAL_MILESTONES.find(
        (m) => !unlockedForHabit.has(m.days) && stats.currentStreak < m.days
      );
      if (nextMilestone) {
        const daysRemaining = Math.max(1, nextMilestone.days - stats.currentStreak);
        const multiplier =
          entity.cadence === 'semanal'
            ? 7
            : entity.cadence === 'laborables'
            ? 1.4
            : entity.cadence === 'personalizado' && entity.customDays && entity.customDays.length > 0
            ? Math.max(1, 7 / entity.customDays.length)
            : 1;
        upcoming.push({
          entityId: entity.id,
          habitName: entity.name,
          category: entity.category,
          targetDays: nextMilestone.days,
          currentStreak: stats.currentStreak,
          daysRemaining,
          progressPct: Math.min(
            99,
            Math.round((stats.currentStreak / nextMilestone.days) * 100)
          ),
          projectedDate: addDays(today, Math.ceil(daysRemaining * multiplier)),
        });
      }
    }
  }

  // Identify earliest global date for each medal tier
  const earliestByTier = new Map<MedalDays, string>();
  const chronological = [...rawEvents].sort((a, b) =>
    a.unlockedDate.localeCompare(b.unlockedDate) || a.days - b.days
  );
  for (const ev of chronological) {
    if (!earliestByTier.has(ev.days)) {
      earliestByTier.set(ev.days, ev.id);
    }
  }

  const events: StreakMilestoneEvent[] = rawEvents
    .map((ev) => ({
      ...ev,
      isFirstOfTier: earliestByTier.get(ev.days) === ev.id,
    }))
    .sort(
      (a, b) =>
        b.unlockedDate.localeCompare(a.unlockedDate) || b.days - a.days
    );

  upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining || b.progressPct - a.progressPct);

  return {
    events,
    upcoming,
    tierTotals,
  };
}

export function getHabitLastNDays(
  entityId: string,
  activities: Activity[],
  today: LocalDate,
  count: number
): Array<{ date: LocalDate; status: 'vacio' | 'parcial' | 'hecho'; value: number }> {
  const byDate = new Map<LocalDate, Activity>();
  for (const act of activities) {
    if (act.entityId === entityId) {
      byDate.set(act.date, act);
    }
  }
  return getLastNDates(count, today).map((date) => {
    const act = byDate.get(date);
    return {
      date,
      status: act?.status ?? 'vacio',
      value: act?.value ?? 0,
    };
  });
}

