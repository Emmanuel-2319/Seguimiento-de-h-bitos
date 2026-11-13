import type {
  Activity,
  ActivityStatus,
  AuthSession,
  CadenceType,
  DatabaseTables,
  Entity,
  HabitCategory,
  LocalDate,
  User,
} from '../types';
import { addDays, DEFAULT_TIMEZONE, getTodayLocalDate } from '../utils/date';

const DB_STORAGE_KEY = 'racha_d1_database_v1';
const SESSION_STORAGE_KEY = 'racha_jwt_session_v1';
const GUEST_USER_ID = 'local-guest';

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRecoveryKey(): string {
  const parts: string[] = [];
  for (let g = 0; g < 3; g++) {
    let chunk = '';
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor(Math.random() * RECOVERY_ALPHABET.length);
      chunk += RECOVERY_ALPHABET[idx];
    }
    parts.push(chunk);
  }
  return parts.join('-'); // e.g. ABCD-EFGH-JKLM (12 chars + hyphens)
}

function hashPassword(raw: string): string {
  // Deterministic lightweight client hash for local mock D1 auth
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h_${(hash >>> 0).toString(16)}`;
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createMockJwt(user: Pick<User, 'id' | 'email' | 'name'>): AuthSession {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 60 * 60 * 24 * 30; // 30 días
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      iat: issuedAt,
      exp: expiresAt,
      iss: 'racha-d1-local',
    })
  );
  const signature = toBase64Url(`sig_${user.id}_${issuedAt}`);
  return {
    token: `${header}.${payload}.${signature}`,
    userId: user.id,
    email: user.email,
    name: user.name,
    issuedAt,
    expiresAt,
  };
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildSeedDataForUser(userId: string, timezone: string): {
  entities: Entity[];
  activities: Activity[];
} {
  const today = getTodayLocalDate(timezone);
  const startDate = addDays(today, -111);
  const nowIso = new Date().toISOString();

  const futureJune = `${Number(today.slice(0, 4)) + 1}-06-30`;
  const futureDec = `${Number(today.slice(0, 4)) + 1}-12-31`;

  const entities: Entity[] = [
    {
      id: createId('hab'),
      userId,
      name: 'Meditación y Respiración',
      category: 'salud',
      cadence: 'diario',
      startDate,
      targetValue: 25,
      unit: 'min',
      monthlyGoal: 25,
      graceDays: 1,
      createdAt: nowIso,
    },
    {
      id: createId('hab'),
      userId,
      name: 'Lectura Técnica / Paper',
      category: 'estudio',
      cadence: 'diario',
      startDate,
      endDate: futureJune,
      targetValue: 22,
      unit: 'páginas',
      monthlyGoal: 22,
      graceDays: 1,
      createdAt: nowIso,
    },
    {
      id: createId('hab'),
      userId,
      name: 'Entrenamiento Físico',
      category: 'salud',
      cadence: 'diario',
      startDate,
      targetValue: 20,
      unit: 'series',
      monthlyGoal: 20,
      graceDays: 1,
      createdAt: nowIso,
    },
    {
      id: createId('hab'),
      userId,
      name: 'Deep Work y Arquitectura',
      category: 'trabajo',
      cadence: 'diario',
      startDate,
      endDate: futureDec,
      targetValue: 20,
      unit: 'horas',
      monthlyGoal: 20,
      graceDays: 1,
      createdAt: nowIso,
    },
    {
      id: createId('hab'),
      userId,
      name: 'Diario Reflexivo y Gratitud',
      category: 'personal',
      cadence: 'diario',
      startDate,
      targetValue: 26,
      unit: 'entradas',
      monthlyGoal: 26,
      graceDays: 1,
      createdAt: nowIso,
    },
  ];

  // Exact active streaks matching the reference: 25, 16, 13, 8, 6 days ending today,
  // plus realistic consistency history across the past 112 days (~84% global density).
  const activeStreakLengths = [25, 16, 13, 8, 6];
  const activities: Activity[] = [];

  entities.forEach((entity, entityIndex) => {
    const targetStreak = activeStreakLengths[entityIndex];
    for (let offset = 111; offset >= 0; offset--) {
      const date = addDays(today, -offset);

      // Keep the day right before the active streak empty (plus one more so grace doesn't bridge)
      if (offset === targetStreak || offset === targetStreak + 1) {
        continue;
      }

      let isDone = false;
      let isPartial = false;

      if (offset < targetStreak) {
        isDone = true;
      } else {
        // Deterministic rich 112-day history (~82% density)
        const pattern = (offset * 7 + entityIndex * 13) % 11;
        if (pattern <= 7) {
          isDone = true;
        } else if (pattern === 8) {
          isPartial = true;
        }
      }

      if (isDone || isPartial) {
        activities.push({
          id: createId('act'),
          userId,
          entityId: entity.id,
          date,
          value: isDone ? entity.targetValue : Math.max(1, Math.floor(entity.targetValue / 2)),
          status: isDone ? 'hecho' : 'parcial',
          updatedAt: nowIso,
        });
      }
    }
  });

  return { entities, activities };
}

function readDb(): DatabaseTables {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DatabaseTables;
      if (
        Array.isArray(parsed.users) &&
        Array.isArray(parsed.entities) &&
        Array.isArray(parsed.activities)
      ) {
        return parsed;
      }
    }
  } catch {
    // Corrupted storage falls back to fresh seed
  }

  const nowIso = new Date().toISOString();
  const guestUser: User = {
    id: GUEST_USER_ID,
    name: 'Modo Local',
    email: 'local@racha.app',
    passwordHash: '',
    recoveryKey: 'LOCA-LD1R-EADY',
    timezone: DEFAULT_TIMEZONE,
    createdAt: nowIso,
  };
  const seeded = buildSeedDataForUser(GUEST_USER_ID, DEFAULT_TIMEZONE);
  const initialDb: DatabaseTables = {
    users: [guestUser],
    entities: seeded.entities,
    activities: seeded.activities,
  };
  writeDb(initialDb);
  return initialDb;
}

function writeDb(db: DatabaseTables): void {
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
}

export const db = {
  getSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as AuthSession;
      if (session.expiresAt * 1000 < Date.now()) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  getActiveUser(): User {
    const database = readDb();
    const session = this.getSession();
    if (session) {
      const found = database.users.find((u) => u.id === session.userId);
      if (found) return found;
    }
    const guest = database.users.find((u) => u.id === GUEST_USER_ID);
    if (guest) return guest;

    const fallback: User = {
      id: GUEST_USER_ID,
      name: 'Modo Local',
      email: 'local@racha.app',
      passwordHash: '',
      recoveryKey: 'LOCA-LD1R-EADY',
      timezone: DEFAULT_TIMEZONE,
      createdAt: new Date().toISOString(),
    };
    database.users.push(fallback);
    writeDb(database);
    return fallback;
  },

  registerUser(params: {
    name: string;
    email: string;
    password: string;
    cloneLocalWorkspace?: boolean;
  }): { user: User; session: AuthSession; recoveryKey: string } {
    const database = readDb();
    const normalizedEmail = params.email.trim().toLowerCase();

    if (database.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      throw new Error('Ya existe una cuenta registrada con ese correo electrónico.');
    }

    const recoveryKey = generateRecoveryKey();
    const userId = createId('usr');
    const guestUser = database.users.find((u) => u.id === GUEST_USER_ID);
    const timezone = guestUser?.timezone || DEFAULT_TIMEZONE;

    const newUser: User = {
      id: userId,
      name: params.name.trim() || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      passwordHash: hashPassword(params.password),
      recoveryKey,
      timezone,
      createdAt: new Date().toISOString(),
    };

    database.users.push(newUser);

    // Optionally bring local habits into the newly created account or seed starter habits
    const guestEntities = database.entities.filter((e) => e.userId === GUEST_USER_ID);
    if (params.cloneLocalWorkspace !== false && guestEntities.length > 0) {
      const idMap = new Map<string, string>();
      for (const ge of guestEntities) {
        const clonedId = createId('hab');
        idMap.set(ge.id, clonedId);
        database.entities.push({
          ...ge,
          id: clonedId,
          userId,
        });
      }
      const guestActivities = database.activities.filter((a) => a.userId === GUEST_USER_ID);
      for (const ga of guestActivities) {
        const mappedEntityId = idMap.get(ga.entityId);
        if (mappedEntityId) {
          database.activities.push({
            ...ga,
            id: createId('act'),
            userId,
            entityId: mappedEntityId,
          });
        }
      }
    } else {
      const seeded = buildSeedDataForUser(userId, timezone);
      database.entities.push(...seeded.entities);
      database.activities.push(...seeded.activities);
    }

    writeDb(database);
    const session = createMockJwt(newUser);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    return { user: newUser, session, recoveryKey };
  },

  loginWithCredentials(email: string, password: string): { user: User; session: AuthSession } {
    const database = readDb();
    const normalizedEmail = email.trim().toLowerCase();
    const user = database.users.find(
      (u) => u.id !== GUEST_USER_ID && u.email.toLowerCase() === normalizedEmail
    );
    if (!user || user.passwordHash !== hashPassword(password)) {
      throw new Error('Correo o contraseña incorrectos.');
    }
    const session = createMockJwt(user);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return { user, session };
  },

  loginWithRecoveryKey(recoveryKeyInput: string): { user: User; session: AuthSession } {
    const database = readDb();
    const cleanInput = recoveryKeyInput.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const user = database.users.find(
      (u) =>
        u.id !== GUEST_USER_ID &&
        u.recoveryKey.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanInput
    );
    if (!user) {
      throw new Error('Clave de recuperación inválida. Verifica los 12 caracteres.');
    }
    const session = createMockJwt(user);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return { user, session };
  },

  logout(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  },

  updateUserTimezone(userId: string, timezone: string): User {
    const database = readDb();
    const idx = database.users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('Usuario no encontrado');
    database.users[idx] = { ...database.users[idx], timezone };
    writeDb(database);
    return database.users[idx];
  },

  getEntities(userId: string): Entity[] {
    const database = readDb();
    return database.entities.filter((e) => e.userId === userId);
  },

  createEntity(
    userId: string,
    payload: {
      name: string;
      category: HabitCategory;
      cadence: CadenceType;
      startDate: LocalDate;
      endDate?: LocalDate;
      targetValue: number;
      unit: string;
      monthlyGoal: number;
      graceDays: number;
    }
  ): Entity {
    const database = readDb();
    const entity: Entity = {
      id: createId('hab'),
      userId,
      name: payload.name.trim(),
      category: payload.category,
      cadence: payload.cadence,
      startDate: payload.startDate,
      endDate: payload.endDate || undefined,
      targetValue: Math.max(1, Number(payload.targetValue) || 1),
      unit: payload.unit.trim() || 'veces',
      monthlyGoal: Math.max(1, Number(payload.monthlyGoal) || 20),
      graceDays: Math.max(0, Math.min(7, Number(payload.graceDays) || 0)),
      createdAt: new Date().toISOString(),
    };
    database.entities.push(entity);
    writeDb(database);
    return entity;
  },

  updateEntity(
    userId: string,
    entityId: string,
    updates: Partial<Omit<Entity, 'id' | 'userId' | 'createdAt'>>
  ): Entity {
    const database = readDb();
    const idx = database.entities.findIndex(
      (e) => e.id === entityId && e.userId === userId
    );
    if (idx === -1) throw new Error('Hábito no encontrado');
    database.entities[idx] = {
      ...database.entities[idx],
      ...updates,
    };
    writeDb(database);
    return database.entities[idx];
  },

  deleteEntity(userId: string, entityId: string): void {
    const database = readDb();
    database.entities = database.entities.filter(
      (e) => !(e.id === entityId && e.userId === userId)
    );
    database.activities = database.activities.filter(
      (a) => !(a.entityId === entityId && a.userId === userId)
    );
    writeDb(database);
  },

  getActivities(userId: string): Activity[] {
    const database = readDb();
    return database.activities.filter((a) => a.userId === userId);
  },

  upsertActivity(
    userId: string,
    entityId: string,
    date: LocalDate,
    value: number,
    status: ActivityStatus
  ): Activity[] {
    const database = readDb();
    const existingIdx = database.activities.findIndex(
      (a) => a.userId === userId && a.entityId === entityId && a.date === date
    );
    const nowIso = new Date().toISOString();

    if (status === 'vacio') {
      if (existingIdx !== -1) {
        database.activities.splice(existingIdx, 1);
      }
    } else if (existingIdx !== -1) {
      database.activities[existingIdx] = {
        ...database.activities[existingIdx],
        value,
        status,
        updatedAt: nowIso,
      };
    } else {
      database.activities.push({
        id: createId('act'),
        userId,
        entityId,
        date,
        value,
        status,
        updatedAt: nowIso,
      });
    }

    writeDb(database);
    return database.activities.filter((a) => a.userId === userId);
  },

  resetUserDemoData(userId: string, timezone: string): void {
    const database = readDb();
    database.entities = database.entities.filter((e) => e.userId !== userId);
    database.activities = database.activities.filter((a) => a.userId !== userId);
    const seeded = buildSeedDataForUser(userId, timezone);
    database.entities.push(...seeded.entities);
    database.activities.push(...seeded.activities);
    writeDb(database);
  },

  exportUserJson(userId: string): string {
    const database = readDb();
    const user = database.users.find((u) => u.id === userId);
    const entities = database.entities.filter((e) => e.userId === userId);
    const activities = database.activities.filter((a) => a.userId === userId);
    return JSON.stringify(
      {
        schema: 'racha-d1-export-v1',
        exportedAt: new Date().toISOString(),
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              timezone: user.timezone,
            }
          : null,
        entities,
        activities,
      },
      null,
      2
    );
  },

  exportUserCsv(userId: string): string {
    const database = readDb();
    const entities = database.entities.filter((e) => e.userId === userId);
    const activities = database.activities.filter((a) => a.userId === userId);
    const entityMap = new Map(entities.map((e) => [e.id, e]));

    const header = [
      'fecha',
      'habito_id',
      'habito',
      'categoria',
      'cadencia',
      'estado',
      'valor',
      'meta_diaria',
      'unidad',
      'dias_gracia',
    ].join(',');

    const escapeCsv = (val: string | number) => {
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const sorted = [...activities].sort((a, b) => b.date.localeCompare(a.date));
    const rows = sorted.map((act) => {
      const ent = entityMap.get(act.entityId);
      return [
        escapeCsv(act.date),
        escapeCsv(act.entityId),
        escapeCsv(ent?.name ?? 'Hábito eliminado'),
        escapeCsv(ent?.category ?? ''),
        escapeCsv(ent?.cadence ?? ''),
        escapeCsv(act.status),
        escapeCsv(act.value),
        escapeCsv(ent?.targetValue ?? 0),
        escapeCsv(ent?.unit ?? ''),
        escapeCsv(ent?.graceDays ?? 0),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  },

  importUserJson(userId: string, jsonText: string): { entitiesCount: number; activitiesCount: number } {
    const parsed = JSON.parse(jsonText) as {
      entities?: Entity[];
      activities?: Activity[];
    };
    if (!Array.isArray(parsed.entities) || !Array.isArray(parsed.activities)) {
      throw new Error('El archivo JSON no contiene tablas válidas (entities, activities).');
    }

    const database = readDb();
    database.entities = database.entities.filter((e) => e.userId !== userId);
    database.activities = database.activities.filter((a) => a.userId !== userId);

    const idMap = new Map<string, string>();
    const importedEntities: Entity[] = parsed.entities.map((e) => {
      const newId = createId('hab');
      idMap.set(e.id, newId);
      return {
        ...e,
        id: newId,
        userId,
      };
    });

    const importedActivities: Activity[] = parsed.activities
      .filter((a) => idMap.has(a.entityId))
      .map((a) => ({
        ...a,
        id: createId('act'),
        userId,
        entityId: idMap.get(a.entityId)!,
      }));

    database.entities.push(...importedEntities);
    database.activities.push(...importedActivities);
    writeDb(database);

    return {
      entitiesCount: importedEntities.length,
      activitiesCount: importedActivities.length,
    };
  },
};
