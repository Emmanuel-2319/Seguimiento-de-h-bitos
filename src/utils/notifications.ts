import type { Activity, Entity, LocalDate } from '../types';
import { isExpectedOccurrence } from './date';

export interface NotificationPreferences {
  enabled: boolean;
  reminderTime: string; // HH:MM (24h)
  lastNotifiedDate?: LocalDate;
}

const NOTIF_STORAGE_PREFIX = 'racha_notif_prefs_v1_';

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: false,
  reminderTime: '20:00',
};

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return window.Notification.permission;
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const result = await window.Notification.requestPermission();
    return result;
  } catch {
    return window.Notification.permission;
  }
}

export function loadNotificationPrefs(userId: string): NotificationPreferences {
  try {
    const raw = localStorage.getItem(`${NOTIF_STORAGE_PREFIX}${userId}`);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      enabled: Boolean(parsed.enabled),
      reminderTime:
        typeof parsed.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(parsed.reminderTime)
          ? parsed.reminderTime
          : DEFAULT_PREFS.reminderTime,
      lastNotifiedDate: parsed.lastNotifiedDate,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveNotificationPrefs(
  userId: string,
  prefs: NotificationPreferences
): void {
  try {
    localStorage.setItem(`${NOTIF_STORAGE_PREFIX}${userId}`, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

export function getCurrentTimeHHMM(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}

export function getPendingHabitsForDate(
  entities: Entity[],
  activities: Activity[],
  date: LocalDate
): Entity[] {
  const doneSet = new Set(
    activities
      .filter((a) => a.date === date && a.status === 'hecho')
      .map((a) => a.entityId)
  );

  return entities.filter(
    (e) =>
      isExpectedOccurrence(date, e.cadence, e.startDate, e.endDate) &&
      !doneSet.has(e.id)
  );
}

const RACHA_BADGE_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#d8f23a"/><path d="M36 12L18 35h13l-3 17 18-23H33l3-17z" fill="#000000"/></svg>'
  );

export function sendPendingHabitsNotification(params: {
  pendingHabits: Entity[];
  today: LocalDate;
  isTest?: boolean;
}): boolean {
  if (!isNotificationSupported() || window.Notification.permission !== 'granted') {
    return false;
  }

  const { pendingHabits, today, isTest } = params;

  let title = 'Racha · Recordatorio diario';
  let body = '';

  if (pendingHabits.length === 0) {
    if (!isTest) return false;
    title = 'Racha · ¡Todo completado hoy!';
    body = `Ya has completado todos tus hábitos de hoy (${today}). ¡Sigue manteniendo tu racha!`;
  } else {
    const names = pendingHabits
      .slice(0, 3)
      .map((h) => h.name)
      .join(', ');
    const extra =
      pendingHabits.length > 3 ? ` y ${pendingHabits.length - 3} más` : '';
    title = `Racha · ${pendingHabits.length} ${
      pendingHabits.length === 1 ? 'hábito pendiente' : 'hábitos pendientes'
    } hoy`;
    body = `No rompas tu racha (${today}): ${names}${extra}.`;
  }

  try {
    const notification = new window.Notification(title, {
      body,
      icon: RACHA_BADGE_SVG,
      tag: isTest ? `racha-test-${Date.now()}` : `racha-daily-${today}`,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
