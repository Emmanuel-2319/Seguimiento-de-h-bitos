import type { CadenceType, LocalDate } from '../types';

export const DEFAULT_TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
  } catch {
    return 'Europe/Madrid';
  }
})();

/**
 * Returns today's date in YYYY-MM-DD format according to the user's timezone.
 */
export function getTodayLocalDate(timezone: string = DEFAULT_TIMEZONE): LocalDate {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
}

/**
 * Parses a YYYY-MM-DD string into UTC Date at noon to avoid DST boundary drift.
 */
export function parseLocalDate(dateStr: LocalDate): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0));
}

export function formatUtcNoonDate(date: Date): LocalDate {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: LocalDate, delta: number): LocalDate {
  const d = parseLocalDate(dateStr);
  d.setUTCDate(d.getUTCDate() + delta);
  return formatUtcNoonDate(d);
}

export function getLastNDates(count: number, endDate: LocalDate): LocalDate[] {
  const dates: LocalDate[] = [];
  for (let i = count - 1; i >= 0; i--) {
    dates.push(addDays(endDate, -i));
  }
  return dates;
}

/**
 * Returns day of week: 0 = Sunday, 1 = Monday ... 6 = Saturday
 */
export function getDayOfWeek(dateStr: LocalDate): number {
  return parseLocalDate(dateStr).getUTCDay();
}

/**
 * Determines whether a habit occurrence is expected on dateStr according to its cadence.
 */
export function isExpectedOccurrence(
  dateStr: LocalDate,
  cadence: CadenceType,
  startDate: LocalDate,
  endDate?: LocalDate
): boolean {
  if (dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;

  if (cadence === 'diario') return true;
  const dow = getDayOfWeek(dateStr);
  if (cadence === 'laborables') {
    return dow >= 1 && dow <= 5;
  }
  if (cadence === 'semanal') {
    return dow === getDayOfWeek(startDate);
  }
  return true;
}

export function getMonthPrefix(dateStr: LocalDate): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

export function getMonthDays(year: number, monthIndexZeroBased: number): LocalDate[] {
  const days: LocalDate[] = [];
  const totalDays = new Date(Date.UTC(year, monthIndexZeroBased + 1, 0)).getUTCDate();
  const y = String(year);
  const m = String(monthIndexZeroBased + 1).padStart(2, '0');
  for (let day = 1; day <= totalDays; day++) {
    days.push(`${y}-${m}-${String(day).padStart(2, '0')}`);
  }
  return days;
}

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAYS_SHORT_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function formatMonthYearEs(year: number, monthIndexZeroBased: number): string {
  return `${MONTHS_ES[monthIndexZeroBased]} ${year}`;
}

export function formatReadableDateEs(dateStr: LocalDate): string {
  const d = parseLocalDate(dateStr);
  const weekday = WEEKDAYS_SHORT_ES[d.getUTCDay()];
  const day = d.getUTCDate();
  const month = MONTHS_ES[d.getUTCMonth()].slice(0, 3).toLowerCase();
  return `${weekday}, ${day} ${month}`;
}

export const COMMON_TIMEZONES = [
  { value: 'Europe/Madrid', label: 'España — Madrid (CET/CEST)' },
  { value: 'Atlantic/Canary', label: 'España — Canarias (WET/WEST)' },
  { value: 'Europe/London', label: 'Reino Unido — Londres (GMT/BST)' },
  { value: 'America/Mexico_City', label: 'México — Ciudad de México' },
  { value: 'America/Bogota', label: 'Colombia — Bogotá' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina — Buenos Aires' },
  { value: 'America/Santiago', label: 'Chile — Santiago' },
  { value: 'America/New_York', label: 'EE. UU. — Nueva York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'EE. UU. — Los Ángeles (PST/PDT)' },
  { value: 'UTC', label: 'Tiempo Universal Coordinado (UTC)' },
];
