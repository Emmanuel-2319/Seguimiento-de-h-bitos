export type HabitCategory = 'salud' | 'estudio' | 'trabajo' | 'personal';

export type CadenceType = 'diario' | 'laborables' | 'semanal';

export type ActivityStatus = 'vacio' | 'parcial' | 'hecho';

export type MedalDays = 7 | 30 | 100;

export type ActiveView = 'tablero' | 'calendario' | 'minijuego' | 'ajustes';

export type LocalDate = string; // Strict YYYY-MM-DD format

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  recoveryKey: string; // 12-character key formatted XXXX-XXXX-XXXX
  timezone: string;
  createdAt: string;
}

export interface Entity {
  id: string;
  userId: string;
  name: string;
  category: HabitCategory;
  cadence: CadenceType;
  startDate: LocalDate;
  endDate?: LocalDate;
  targetValue: number;
  unit: string;
  monthlyGoal: number;
  graceDays: number;
  createdAt: string;
}

export interface Activity {
  id: string;
  userId: string;
  entityId: string;
  date: LocalDate;
  value: number;
  status: ActivityStatus;
  updatedAt: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  email: string;
  name: string;
  issuedAt: number;
  expiresAt: number;
}

export interface DatabaseTables {
  users: User[];
  entities: Entity[];
  activities: Activity[];
}

export interface MedalStatus {
  days: MedalDays;
  label: string;
  unlocked: boolean;
  unlockedBy?: string;
}

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  graceActive: boolean;
  graceUsedToday: boolean;
  monthlyCompleted: number;
  todayStatus: ActivityStatus;
  todayValue: number;
  lastFiveDays: Array<{
    date: LocalDate;
    status: ActivityStatus;
    value: number;
  }>;
  unlockedMedals: MedalDays[];
}

export interface HeatmapDay {
  date: LocalDate;
  completedCount: number;
  partialCount: number;
  totalEntities: number;
  ratio: number; // 0..1
  level: 0 | 1 | 2 | 3 | 4;
}

export interface GlobalStats {
  maxStreak: number;
  maxStreakHabitName: string;
  maxStreakGraceDays: number;
  maxStreakGraceActive: boolean;
  todayCompletionPct: number;
  todayCompletedCount: number;
  activeCount: number;
  activeCategories: HabitCategory[];
  categoryCounts: Record<HabitCategory, number>;
  medals: MedalStatus[];
  heatmapDays: HeatmapDay[];
  consistencyPct: number;
  registeredDaysCount: number;
}
