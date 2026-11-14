import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../db/db';
import type {
  ActiveView,
  Activity,
  ActivityStatus,
  AuthSession,
  CadenceType,
  Entity,
  GlobalStats,
  HabitCategory,
  HabitType,
  LocalDate,
  User,
  WeekStart,
} from '../types';
import { getTodayLocalDate } from '../utils/date';
import {
  getCurrentTimeHHMM,
  getNotificationPermission,
  getPendingHabitsForDate,
  loadNotificationPrefs,
  type NotificationPreferences,
  requestNotificationPermission,
  saveNotificationPrefs,
  sendPendingHabitsNotification,
} from '../utils/notifications';
import { calculateGlobalStats } from '../utils/streak';

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface StoreContextValue {
  user: User;
  session: AuthSession | null;
  isAuthenticated: boolean;
  today: LocalDate;
  entities: Entity[];
  activities: Activity[];
  globalStats: GlobalStats;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  selectedCategory: 'todos' | HabitCategory;
  setSelectedCategory: (cat: 'todos' | HabitCategory) => void;
  syncLabel: string;
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Cross-view jumps & presets
  calendarFocusDate: LocalDate | null;
  jumpToCalendarDate: (date: LocalDate) => void;
  sharePresetNote: string | null;
  openShareModalWithNote: (note: string) => void;

  // Modals
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  isHabitModalOpen: boolean;
  editingEntity: Entity | null;
  openCreateHabitModal: () => void;
  openEditHabitModal: (entity: Entity) => void;
  closeHabitModal: () => void;
  detailEntityId: string | null;
  openDetailModal: (entityId: string) => void;
  closeDetailModal: () => void;
  isShareModalOpen: boolean;
  openShareModal: () => void;
  closeShareModal: () => void;

  // Domain actions
  toggleDayStatus: (entity: Entity, date: LocalDate) => void;
  setDayActivity: (
    entity: Entity,
    date: LocalDate,
    value: number,
    status: ActivityStatus,
    note?: string
  ) => void;
  createHabit: (payload: {
    name: string;
    category: HabitCategory;
    habitType?: HabitType;
    cadence: CadenceType;
    customDays?: number[];
    startDate: LocalDate;
    endDate?: LocalDate;
    targetValue: number;
    unit: string;
    monthlyGoal: number;
    graceDays: number;
  }) => void;
  updateHabit: (
    entityId: string,
    updates: Partial<Omit<Entity, 'id' | 'userId' | 'createdAt'>>
  ) => void;
  deleteHabit: (entityId: string) => void;

  // Auth & Settings
  registerAccount: (params: {
    name: string;
    email: string;
    password: string;
  }) => { recoveryKey: string };
  loginAccount: (email: string, password: string) => void;
  recoverAccountWithKey: (recoveryKey: string) => void;
  logoutAccount: () => void;
  updateTimezone: (timezone: string) => void;
  updateWeekStart: (weekStart: WeekStart) => void;
  updateUserName: (name: string) => void;
  updateUserPassword: (currentPassword: string, newPassword: string) => void;
  completeAllPendingToday: () => number;
  lastExternalBackupAt: string | null;
  exportJson: () => void;
  exportCsv: (mode?: 'actividades' | 'resumen') => void;
  copyBackupJson: () => Promise<void>;
  importJson: (jsonText: string) => void;
  resetDemo: () => void;
  clearWorkspace: () => void;
  deleteAccount: () => void;

  // Cloud Sync
  effectiveSyncCode: string;
  syncStatus: CloudSyncStatus;
  lastCloudSyncAt: string | null;
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;
  linkSyncCode: (code: string) => void;
  syncUpload: (silent?: boolean) => Promise<void>;
  syncDownload: (codeOverride?: string) => Promise<void>;

  // Browser Notifications
  notificationPrefs: NotificationPreferences;
  notificationPermission: NotificationPermission | 'unsupported';
  pendingTodayCount: number;
  enableNotifications: () => Promise<void>;
  disableNotifications: () => void;
  updateReminderTime: (timeHHMM: string) => void;
  sendTestNotification: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(() => db.getActiveUser());
  const [session, setSession] = useState<AuthSession | null>(() => db.getSession());
  const [entities, setEntities] = useState<Entity[]>(() => db.getEntities(db.getActiveUser().id));
  const [activities, setActivities] = useState<Activity[]>(() =>
    db.getActivities(db.getActiveUser().id)
  );

  const [activeView, setActiveView] = useState<ActiveView>('tablero');
  const [selectedCategory, setSelectedCategory] = useState<'todos' | HabitCategory>('todos');
  const [syncLabel, setSyncLabel] = useState<string>('ahora');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [detailEntityId, setDetailEntityId] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const [calendarFocusDate, setCalendarFocusDate] = useState<LocalDate | null>(null);
  const [sharePresetNote, setSharePresetNote] = useState<string | null>(null);

  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('idle');
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem('racha_last_cloud_sync_at');
    } catch {
      return null;
    }
  });
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('racha_auto_sync') === '1';
    } catch {
      return false;
    }
  });
  const [lastExternalBackupAt, setLastExternalBackupAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem('racha_last_external_backup_at');
    } catch {
      return null;
    }
  });

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() =>
    loadNotificationPrefs(db.getActiveUser().id)
  );
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => getNotificationPermission());

  const toastTimerRef = useRef<number | null>(null);
  const autoSyncTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
      toastTimerRef.current = null;
    }, 3200);
  }, []);

  const markSynced = useCallback(() => {
    setSyncLabel('ahora');
  }, []);

  const effectiveSyncCode = user.syncCode || user.recoveryKey;

  const setAutoSyncEnabled = useCallback(
    (enabled: boolean) => {
      setAutoSyncEnabledState(enabled);
      try {
        localStorage.setItem('racha_auto_sync', enabled ? '1' : '0');
      } catch {
        // Ignore storage error
      }
      showToast(
        enabled
          ? 'Sincronización automática en la nube activada'
          : 'Sincronización automática desactivada'
      );
    },
    [showToast]
  );

  const reloadUserWorkspace = useCallback(() => {
    const active = db.getActiveUser();
    setUser(active);
    setSession(db.getSession());
    setEntities(db.getEntities(active.id));
    setActivities(db.getActivities(active.id));
    setNotificationPrefs(loadNotificationPrefs(active.id));
    setNotificationPermission(getNotificationPermission());
    markSynced();
  }, [markSynced]);

  const syncUpload = useCallback(
    async (silent = false) => {
      const code = effectiveSyncCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (code.length < 8) {
        if (!silent) showToast('Configura un código de sincronización válido');
        return;
      }
      setSyncStatus('syncing');
      try {
        const snapshot = db.getSyncSnapshot(user.id);
        const res = await fetch(`/api/sync/${encodeURIComponent(code)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: snapshot }),
        });
        const data = (await res.json()) as { updatedAt?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo subir el respaldo');
        }
        const timestamp = data.updatedAt || new Date().toISOString();
        setLastCloudSyncAt(timestamp);
        setSyncStatus('synced');
        try {
          localStorage.setItem('racha_last_cloud_sync_at', timestamp);
        } catch {
          // Ignore storage error
        }
        if (!silent) {
          showToast('Datos guardados en la nube correctamente');
        }
      } catch (err) {
        setSyncStatus('error');
        if (!silent) {
          showToast(
            err instanceof Error ? err.message : 'Error al sincronizar con la nube'
          );
        }
      }
    },
    [effectiveSyncCode, user.id, showToast]
  );

  const syncDownload = useCallback(
    async (codeOverride?: string) => {
      const rawCode = (codeOverride ?? effectiveSyncCode)
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase();
      if (rawCode.length < 8) {
        showToast('Introduce un código de sincronización de al menos 8 caracteres');
        return;
      }
      setSyncStatus('syncing');
      try {
        const res = await fetch(`/api/sync/${encodeURIComponent(rawCode)}`);
        const data = (await res.json()) as {
          updatedAt?: string;
          payload?: {
            user?: { timezone?: string; weekStart?: WeekStart } | null;
            entities?: Entity[];
            activities?: Activity[];
          };
          error?: string;
        };
        if (!res.ok || !data.payload) {
          throw new Error(data.error || 'No se encontró respaldo en la nube');
        }
        if (codeOverride) {
          db.updateUserSyncCode(user.id, codeOverride);
        }
        const applied = db.applySyncSnapshot(user.id, data.payload);
        reloadUserWorkspace();
        const timestamp = data.updatedAt || new Date().toISOString();
        setLastCloudSyncAt(timestamp);
        setSyncStatus('synced');
        try {
          localStorage.setItem('racha_last_cloud_sync_at', timestamp);
        } catch {
          // Ignore storage error
        }
        showToast(
          `Sincronizado: ${applied.entitiesCount} hábitos y ${applied.activitiesCount} registros`
        );
      } catch (err) {
        setSyncStatus('error');
        showToast(
          err instanceof Error ? err.message : 'Error al descargar de la nube'
        );
      }
    },
    [effectiveSyncCode, user.id, reloadUserWorkspace, showToast]
  );

  const linkSyncCode = useCallback(
    (code: string) => {
      const updated = db.updateUserSyncCode(user.id, code);
      setUser(updated);
      showToast(`Código vinculado: ${updated.syncCode}`);
    },
    [user.id, showToast]
  );

  // Auto-upload debounced when autoSyncEnabled is active
  const scheduleAutoSync = useCallback(() => {
    if (!autoSyncEnabled) return;
    if (autoSyncTimerRef.current !== null) {
      window.clearTimeout(autoSyncTimerRef.current);
    }
    autoSyncTimerRef.current = window.setTimeout(() => {
      void syncUpload(true);
      autoSyncTimerRef.current = null;
    }, 2000);
  }, [autoSyncEnabled, syncUpload]);

  const today = useMemo(() => getTodayLocalDate(user.timezone), [user.timezone]);

  const globalStats = useMemo(
    () => calculateGlobalStats(entities, activities, today),
    [entities, activities, today]
  );

  const pendingTodayHabits = useMemo(
    () => getPendingHabitsForDate(entities, activities, today),
    [entities, activities, today]
  );

  // Daily scheduler + visibility/focus catch-up checking if it's time to notify
  useEffect(() => {
    if (!notificationPrefs.enabled || notificationPermission !== 'granted') return;

    let cancelled = false;
    const checkAndNotify = async () => {
      if (cancelled) return;
      if (notificationPrefs.lastNotifiedDate === today) return;
      if (pendingTodayHabits.length === 0) return;

      const nowHHMM = getCurrentTimeHHMM(user.timezone);
      if (nowHHMM >= notificationPrefs.reminderTime) {
        const sent = await sendPendingHabitsNotification({
          pendingHabits: pendingTodayHabits,
          today,
        });
        if (sent && !cancelled) {
          const updated: NotificationPreferences = {
            ...notificationPrefs,
            lastNotifiedDate: today,
          };
          setNotificationPrefs(updated);
          saveNotificationPrefs(user.id, updated);
        }
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void checkAndNotify();
      }
    };

    void checkAndNotify();
    const timer = window.setInterval(() => {
      void checkAndNotify();
    }, 30000);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [
    notificationPrefs,
    notificationPermission,
    pendingTodayHabits,
    today,
    user.timezone,
    user.id,
  ]);

  const jumpToCalendarDate = useCallback((date: LocalDate) => {
    setCalendarFocusDate(date);
    setActiveView('calendario');
  }, []);

  const openShareModalWithNote = useCallback((note: string) => {
    setSharePresetNote(note);
    setIsShareModalOpen(true);
  }, []);

  const toggleDayStatus = useCallback(
    (entity: Entity, date: LocalDate) => {
      const existing = activities.find(
        (a) => a.entityId === entity.id && a.date === date
      );
      const nextStatus: ActivityStatus =
        existing?.status === 'hecho' ? 'vacio' : 'hecho';
      const nextValue = nextStatus === 'hecho' ? entity.targetValue : 0;
      const updated = db.upsertActivity(
        user.id,
        entity.id,
        date,
        nextValue,
        nextStatus,
        existing?.note
      );
      setActivities(updated);
      markSynced();
      scheduleAutoSync();
    },
    [activities, user.id, markSynced, scheduleAutoSync]
  );

  const setDayActivity = useCallback(
    (
      entity: Entity,
      date: LocalDate,
      value: number,
      status: ActivityStatus,
      note?: string
    ) => {
      const updated = db.upsertActivity(
        user.id,
        entity.id,
        date,
        value,
        status,
        note
      );
      setActivities(updated);
      markSynced();
      scheduleAutoSync();
    },
    [user.id, markSynced, scheduleAutoSync]
  );

  const createHabit = useCallback(
    (payload: {
      name: string;
      category: HabitCategory;
      habitType?: HabitType;
      cadence: CadenceType;
      customDays?: number[];
      startDate: LocalDate;
      endDate?: LocalDate;
      targetValue: number;
      unit: string;
      monthlyGoal: number;
      graceDays: number;
    }) => {
      const created = db.createEntity(user.id, payload);
      setEntities((prev) => [...prev, created]);
      markSynced();
      scheduleAutoSync();
      showToast(`Hábito «${created.name}» creado`);
    },
    [user.id, markSynced, scheduleAutoSync, showToast]
  );

  const updateHabit = useCallback(
    (
      entityId: string,
      updates: Partial<Omit<Entity, 'id' | 'userId' | 'createdAt'>>
    ) => {
      const updated = db.updateEntity(user.id, entityId, updates);
      setEntities((prev) => prev.map((e) => (e.id === entityId ? updated : e)));
      markSynced();
      showToast(`Hábito «${updated.name}» actualizado`);
    },
    [user.id, markSynced, showToast]
  );

  const deleteHabit = useCallback(
    (entityId: string) => {
      db.deleteEntity(user.id, entityId);
      setEntities((prev) => prev.filter((e) => e.id !== entityId));
      setActivities((prev) => prev.filter((a) => a.entityId !== entityId));
      setDetailEntityId((prev) => (prev === entityId ? null : prev));
      markSynced();
      showToast('Hábito eliminado');
    },
    [user.id, markSynced, showToast]
  );

  const registerAccount = useCallback(
    (params: { name: string; email: string; password: string }) => {
      const result = db.registerUser({ ...params, cloneLocalWorkspace: true });
      reloadUserWorkspace();
      return { recoveryKey: result.recoveryKey };
    },
    [reloadUserWorkspace]
  );

  const loginAccount = useCallback(
    (email: string, password: string) => {
      db.loginWithCredentials(email, password);
      reloadUserWorkspace();
      setIsAuthModalOpen(false);
      showToast('Sesión iniciada correctamente');
    },
    [reloadUserWorkspace, showToast]
  );

  const recoverAccountWithKey = useCallback(
    (recoveryKey: string) => {
      const res = db.loginWithRecoveryKey(recoveryKey);
      reloadUserWorkspace();
      setIsAuthModalOpen(false);
      showToast(`Cuenta recuperada: ${res.user.name}`);
    },
    [reloadUserWorkspace, showToast]
  );

  const logoutAccount = useCallback(() => {
    db.logout();
    reloadUserWorkspace();
    showToast('Sesión cerrada · Modo local activo');
  }, [reloadUserWorkspace, showToast]);

  const updateTimezone = useCallback(
    (timezone: string) => {
      const updated = db.updateUserTimezone(user.id, timezone);
      setUser(updated);
      markSynced();
      scheduleAutoSync();
      showToast(`Zona horaria actualizada a ${timezone}`);
    },
    [user.id, markSynced, scheduleAutoSync, showToast]
  );

  const updateWeekStart = useCallback(
    (weekStart: WeekStart) => {
      const updated = db.updateUserWeekStart(user.id, weekStart);
      setUser(updated);
      markSynced();
      scheduleAutoSync();
      showToast(
        `Semana configurada iniciando en ${weekStart === 'lunes' ? 'lunes' : 'domingo'}`
      );
    },
    [user.id, markSynced, scheduleAutoSync, showToast]
  );

  const updateUserName = useCallback(
    (name: string) => {
      const updated = db.updateUserName(user.id, name);
      setUser(updated);
      setSession(db.getSession());
      markSynced();
      scheduleAutoSync();
      showToast(`Nombre actualizado a ${updated.name}`);
    },
    [user.id, markSynced, scheduleAutoSync, showToast]
  );

  const updateUserPassword = useCallback(
    (currentPassword: string, newPassword: string) => {
      db.updateUserPassword(user.id, currentPassword, newPassword);
      showToast('Contraseña actualizada correctamente');
    },
    [user.id, showToast]
  );

  const completeAllPendingToday = useCallback(() => {
    if (pendingTodayHabits.length === 0) return 0;
    let latestActivities = activities;
    for (const ent of pendingTodayHabits) {
      latestActivities = db.upsertActivity(
        user.id,
        ent.id,
        today,
        ent.targetValue,
        'hecho'
      );
    }
    setActivities(latestActivities);
    markSynced();
    scheduleAutoSync();
    showToast(
      `¡${pendingTodayHabits.length} ${
        pendingTodayHabits.length === 1 ? 'hábito completado' : 'hábitos completados'
      } hoy!`
    );
    return pendingTodayHabits.length;
  }, [pendingTodayHabits, activities, user.id, today, markSynced, scheduleAutoSync, showToast]);

  const recordExternalBackup = useCallback(() => {
    const nowIso = new Date().toISOString();
    setLastExternalBackupAt(nowIso);
    try {
      localStorage.setItem('racha_last_external_backup_at', nowIso);
    } catch {
      // Ignore storage error
    }
  }, []);

  const exportJson = useCallback(() => {
    const content = db.exportUserJson(user.id);
    triggerDownload(`racha-respaldo-${today}.json`, content, 'application/json;charset=utf-8;');
    recordExternalBackup();
    showToast('Respaldo JSON completo descargado');
  }, [user.id, today, recordExternalBackup, showToast]);

  const exportCsv = useCallback(
    (mode: 'actividades' | 'resumen' = 'actividades') => {
      const content = db.exportUserCsv(user.id, mode);
      const filename =
        mode === 'resumen'
          ? `racha-resumen-progreso-${today}.csv`
          : `racha-actividades-${today}.csv`;
      triggerDownload(filename, content, 'text/csv;charset=utf-8;');
      recordExternalBackup();
      showToast(
        mode === 'resumen'
          ? 'Resumen de progreso CSV descargado'
          : 'Registro diario CSV descargado'
      );
    },
    [user.id, today, recordExternalBackup, showToast]
  );

  const copyBackupJson = useCallback(async () => {
    const content = db.exportUserJson(user.id);
    await navigator.clipboard.writeText(content);
    recordExternalBackup();
    showToast('Respaldo JSON copiado al portapapeles');
  }, [user.id, recordExternalBackup, showToast]);

  const importJson = useCallback(
    (jsonText: string) => {
      const res = db.importUserJson(user.id, jsonText);
      reloadUserWorkspace();
      scheduleAutoSync();
      showToast(`Importados ${res.entitiesCount} hábitos y ${res.activitiesCount} registros`);
    },
    [user.id, reloadUserWorkspace, scheduleAutoSync, showToast]
  );

  const resetDemo = useCallback(() => {
    db.resetUserDemoData(user.id, user.timezone);
    reloadUserWorkspace();
    showToast('Datos de demostración restaurados');
  }, [user.id, user.timezone, reloadUserWorkspace, showToast]);

  const clearWorkspace = useCallback(() => {
    db.clearUserWorkspace(user.id);
    reloadUserWorkspace();
    showToast('Espacio de trabajo vaciado (0 hábitos)');
  }, [user.id, reloadUserWorkspace, showToast]);

  const deleteAccount = useCallback(() => {
    db.deleteUserAccount(user.id);
    reloadUserWorkspace();
    setActiveView('tablero');
    showToast('Cuenta eliminada · Volviste al modo local');
  }, [user.id, reloadUserWorkspace, showToast]);

  const enableNotifications = useCallback(async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'unsupported') {
      showToast('Tu navegador no soporta la API de Notificaciones');
      return;
    }
    if (perm !== 'granted') {
      showToast('Permiso de notificaciones denegado por el navegador');
      return;
    }
    const updated: NotificationPreferences = {
      ...notificationPrefs,
      enabled: true,
    };
    setNotificationPrefs(updated);
    saveNotificationPrefs(user.id, updated);
    showToast(`Recordatorio diario activado a las ${updated.reminderTime}`);
  }, [notificationPrefs, user.id, showToast]);

  const disableNotifications = useCallback(() => {
    const updated: NotificationPreferences = {
      ...notificationPrefs,
      enabled: false,
    };
    setNotificationPrefs(updated);
    saveNotificationPrefs(user.id, updated);
    showToast('Recordatorios diarios desactivados');
  }, [notificationPrefs, user.id, showToast]);

  const updateReminderTime = useCallback(
    (timeHHMM: string) => {
      if (!/^\d{2}:\d{2}$/.test(timeHHMM)) return;
      const updated: NotificationPreferences = {
        ...notificationPrefs,
        reminderTime: timeHHMM,
        // Allow re-triggering today if user schedules a future time today
        lastNotifiedDate:
          timeHHMM > getCurrentTimeHHMM(user.timezone)
            ? undefined
            : notificationPrefs.lastNotifiedDate,
      };
      setNotificationPrefs(updated);
      saveNotificationPrefs(user.id, updated);
      showToast(`Hora del recordatorio actualizada a ${timeHHMM}`);
    },
    [notificationPrefs, user.id, user.timezone, showToast]
  );

  const sendTestNotification = useCallback(async () => {
    let perm = notificationPermission;
    if (perm === 'default') {
      perm = await requestNotificationPermission();
      setNotificationPermission(perm);
    }
    if (perm === 'unsupported') {
      showToast('Este navegador no admite notificaciones locales');
      return;
    }
    if (perm !== 'granted') {
      showToast('Concede permiso de notificaciones en tu navegador para probarlas');
      return;
    }
    const ok = await sendPendingHabitsNotification({
      pendingHabits: pendingTodayHabits,
      today,
      isTest: true,
    });
    showToast(
      ok
        ? 'Notificación enviada'
        : 'No se pudo mostrar la notificación en este entorno'
    );
  }, [notificationPermission, pendingTodayHabits, today, showToast]);

  const value: StoreContextValue = {
    user,
    session,
    isAuthenticated: Boolean(session),
    today,
    entities,
    activities,
    globalStats,
    activeView,
    setActiveView,
    selectedCategory,
    setSelectedCategory,
    syncLabel,
    toastMessage,
    showToast,
    calendarFocusDate,
    jumpToCalendarDate,
    sharePresetNote,
    openShareModalWithNote,
    isAuthModalOpen,
    openAuthModal: () => setIsAuthModalOpen(true),
    closeAuthModal: () => setIsAuthModalOpen(false),
    isHabitModalOpen,
    editingEntity,
    openCreateHabitModal: () => {
      setEditingEntity(null);
      setIsHabitModalOpen(true);
    },
    openEditHabitModal: (entity: Entity) => {
      setEditingEntity(entity);
      setIsHabitModalOpen(true);
    },
    closeHabitModal: () => {
      setIsHabitModalOpen(false);
      setEditingEntity(null);
    },
    detailEntityId,
    openDetailModal: (entityId: string) => setDetailEntityId(entityId),
    closeDetailModal: () => setDetailEntityId(null),
    isShareModalOpen,
    openShareModal: () => {
      setSharePresetNote(null);
      setIsShareModalOpen(true);
    },
    closeShareModal: () => {
      setIsShareModalOpen(false);
      setSharePresetNote(null);
    },
    toggleDayStatus,
    setDayActivity,
    createHabit,
    updateHabit,
    deleteHabit,
    registerAccount,
    loginAccount,
    recoverAccountWithKey,
    logoutAccount,
    updateTimezone,
    updateWeekStart,
    updateUserName,
    updateUserPassword,
    completeAllPendingToday,
    lastExternalBackupAt,
    exportJson,
    exportCsv,
    copyBackupJson,
    importJson,
    resetDemo,
    clearWorkspace,
    deleteAccount,
    effectiveSyncCode,
    syncStatus,
    lastCloudSyncAt,
    autoSyncEnabled,
    setAutoSyncEnabled,
    linkSyncCode,
    syncUpload,
    syncDownload,
    notificationPrefs,
    notificationPermission,
    pendingTodayCount: pendingTodayHabits.length,
    enableNotifications,
    disableNotifications,
    updateReminderTime,
    sendTestNotification,
  };

  return React.createElement(StoreContext.Provider, { value }, children);
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore debe utilizarse dentro de StoreProvider');
  }
  return ctx;
}
