import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  LocalDate,
  User,
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
    status: ActivityStatus
  ) => void;
  createHabit: (payload: {
    name: string;
    category: HabitCategory;
    cadence: CadenceType;
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
  exportJson: () => void;
  exportCsv: () => void;
  importJson: (jsonText: string) => void;
  resetDemo: () => void;

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
  URL.revokeObjectURL(url);
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

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() =>
    loadNotificationPrefs(db.getActiveUser().id)
  );
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => getNotificationPermission());

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const markSynced = useCallback(() => {
    setSyncLabel('ahora');
  }, []);

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

  const today = useMemo(() => getTodayLocalDate(user.timezone), [user.timezone]);

  const globalStats = useMemo(
    () => calculateGlobalStats(entities, activities, today),
    [entities, activities, today]
  );

  const pendingTodayHabits = useMemo(
    () => getPendingHabitsForDate(entities, activities, today),
    [entities, activities, today]
  );

  // Daily scheduler checking every 30s if it's time to notify about pending habits
  useEffect(() => {
    if (!notificationPrefs.enabled || notificationPermission !== 'granted') return;

    const checkAndNotify = () => {
      if (notificationPrefs.lastNotifiedDate === today) return;
      if (pendingTodayHabits.length === 0) return;

      const nowHHMM = getCurrentTimeHHMM(user.timezone);
      if (nowHHMM >= notificationPrefs.reminderTime) {
        const sent = sendPendingHabitsNotification({
          pendingHabits: pendingTodayHabits,
          today,
        });
        if (sent) {
          const updated: NotificationPreferences = {
            ...notificationPrefs,
            lastNotifiedDate: today,
          };
          setNotificationPrefs(updated);
          saveNotificationPrefs(user.id, updated);
        }
      }
    };

    checkAndNotify();
    const timer = window.setInterval(checkAndNotify, 30000);
    return () => window.clearInterval(timer);
  }, [
    notificationPrefs,
    notificationPermission,
    pendingTodayHabits,
    today,
    user.timezone,
    user.id,
  ]);

  const toggleDayStatus = useCallback(
    (entity: Entity, date: LocalDate) => {
      const existing = activities.find(
        (a) => a.entityId === entity.id && a.date === date
      );
      const nextStatus: ActivityStatus =
        existing?.status === 'hecho' ? 'vacio' : 'hecho';
      const nextValue = nextStatus === 'hecho' ? entity.targetValue : 0;
      const updated = db.upsertActivity(user.id, entity.id, date, nextValue, nextStatus);
      setActivities(updated);
      markSynced();
    },
    [activities, user.id, markSynced]
  );

  const setDayActivity = useCallback(
    (entity: Entity, date: LocalDate, value: number, status: ActivityStatus) => {
      const updated = db.upsertActivity(user.id, entity.id, date, value, status);
      setActivities(updated);
      markSynced();
    },
    [user.id, markSynced]
  );

  const createHabit = useCallback(
    (payload: {
      name: string;
      category: HabitCategory;
      cadence: CadenceType;
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
      showToast(`Hábito «${created.name}» creado`);
    },
    [user.id, markSynced, showToast]
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
      showToast(`Zona horaria actualizada a ${timezone}`);
    },
    [user.id, markSynced, showToast]
  );

  const exportJson = useCallback(() => {
    const content = db.exportUserJson(user.id);
    triggerDownload(`racha-backup-${today}.json`, content, 'application/json');
    showToast('Copia JSON descargada');
  }, [user.id, today, showToast]);

  const exportCsv = useCallback(() => {
    const content = db.exportUserCsv(user.id);
    triggerDownload(`racha-actividades-${today}.csv`, content, 'text/csv;charset=utf-8;');
    showToast('Registro CSV descargado');
  }, [user.id, today, showToast]);

  const importJson = useCallback(
    (jsonText: string) => {
      const res = db.importUserJson(user.id, jsonText);
      reloadUserWorkspace();
      showToast(`Importados ${res.entitiesCount} hábitos y ${res.activitiesCount} registros`);
    },
    [user.id, reloadUserWorkspace, showToast]
  );

  const resetDemo = useCallback(() => {
    db.resetUserDemoData(user.id, user.timezone);
    reloadUserWorkspace();
    showToast('Datos de demostración restaurados');
  }, [user.id, user.timezone, reloadUserWorkspace, showToast]);

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
    const ok = sendPendingHabitsNotification({
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
    openShareModal: () => setIsShareModalOpen(true),
    closeShareModal: () => setIsShareModalOpen(false),
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
    exportJson,
    exportCsv,
    importJson,
    resetDemo,
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
