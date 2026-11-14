import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowLeft,
  Award,
  Camera,
  Check,
  Crosshair,
  Flame,
  Gamepad2,
  Magnet,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { gameAudio } from '../utils/gameAudio';
import { getPendingHabitsForDate } from '../utils/notifications';
import { createMaterialRegistry } from '../game/materials';
import {
  ARENA_RADIUS,
  createBoostOrbModel,
  createBossSpecterModel,
  createCompanionSeelie,
  createDistractionSpecterModel,
  createDrainSpecterModel,
  createHabitShardModel,
  createHeroTraveler,
  createSanctuaryWorld,
  getCategoryColor,
  groundHeightAt,
  type BoostOrbRig,
  type BossSpecterRig,
  type DistractionSpecterRig,
  type DrainSpecterRig,
  type HabitShardRig,
  type HeroRig,
  type SeelieRig,
  type SeelieSkin,
  type SwordStyle,
} from '../game/models';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
type DifficultyMode = 'diario' | 'implacable';
type MissionKind = 'capture' | 'slash' | 'target';

interface DailyMission {
  kind: MissionKind;
  label: string;
  progress: number;
  goal: number;
}

interface HabitNode3D {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  label: string;
  category: string;
  life: number;
  maxLife: number;
  isGraceBonus: boolean;
  phase: number;
  rig: HabitShardRig;
}

interface HazardSpecter3D {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  windup: number;
  maxWindup: number;
  dashed: boolean;
  label: string;
  rig: DistractionSpecterRig;
}

interface BoostOrb3D {
  id: number;
  kind: 'magnet' | 'speed';
  x: number;
  z: number;
  life: number;
  phase: number;
  rig: BoostOrbRig;
}

interface DrainSpecter3D {
  id: number;
  x: number;
  z: number;
  radius: number;
  phase: number;
  label: string;
  rig: DrainSpecterRig;
}

interface BossEntity3D {
  x: number;
  z: number;
  vx: number;
  vz: number;
  hp: number;
  maxHp: number;
  radius: number;
  attackTimer: number;
  windup: number;
  hitFlash: number;
  label: string;
  rig: BossSpecterRig;
}

interface RadarBlip {
  x: number;
  z: number;
  kind: 'habit' | 'hazard' | 'drainer' | 'orb' | 'boss' | 'shrine';
}

interface Shockwave3D {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxScale: number;
}

interface BurstParticle3D {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

interface HudSnapshot {
  day: number;
  score: number;
  streak: number;
  bestStreakInRun: number;
  hp: number;
  maxHp: number;
  shields: number;
  capturedCount: number;
  pulseCooldownPct: number;
  dashCooldownPct: number;
  slashCooldownPct: number;
  burstChargePct: number;
  fervorTimer: number;
  magnetTimer: number;
  speedBoostTimer: number;
  shrineCooldown: number;
  comboMult: number;
  comboLabel: string;
  mission: DailyMission;
  boss: { label: string; hp: number; maxHp: number } | null;
  playerRadar: { x: number; z: number };
  radarBlips: RadarBlip[];
}

const BEST_SCORE_STORAGE_KEY = 'racha_forja_best_score_v1';
const SWORD_STYLE_STORAGE_KEY = 'racha_forja_sword_style_v1';
const FORJA_PROGRESS_STORAGE_KEY = 'racha_forja_progress_v1';

interface ForjaProgress {
  runsPlayed: number;
  bossesDefeated: number;
  shrinesActivated: number;
  totalCaptured: number;
  seelieSkin: SeelieSkin;
  achievements: string[];
}

const ISLAND_ACHIEVEMENTS: Array<{
  id: string;
  label: string;
  hint: string;
}> = [
  { id: 'primer_desafio', label: 'Primer Desafío', hint: 'Inicia tu 1ª expedición' },
  { id: 'cazatitanes', label: 'Cazatitanes', hint: 'Derrota a un Titán Día 5+' },
  { id: 'maestro_altar', label: 'Maestro del Altar', hint: 'Activa 3 veces el Altar' },
  { id: 'racha_imparable', label: 'Racha Imparable', hint: 'Alcanza 10d de racha en partida' },
  { id: 'santuario_vivo', label: 'Santuario Vivo', hint: 'Reúne 50 fragmentos de hábito' },
];

const DEFAULT_FORJA_PROGRESS: ForjaProgress = {
  runsPlayed: 0,
  bossesDefeated: 0,
  shrinesActivated: 0,
  totalCaptured: 0,
  seelieSkin: 'celeste',
  achievements: [],
};

function readForjaProgress(): ForjaProgress {
  try {
    const raw = localStorage.getItem(FORJA_PROGRESS_STORAGE_KEY);
    if (!raw) return DEFAULT_FORJA_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<ForjaProgress>;
    const seelieSkin: SeelieSkin =
      parsed.seelieSkin === 'dorado' || parsed.seelieSkin === 'amatista'
        ? parsed.seelieSkin
        : 'celeste';
    return {
      runsPlayed: Number(parsed.runsPlayed) || 0,
      bossesDefeated: Number(parsed.bossesDefeated) || 0,
      shrinesActivated: Number(parsed.shrinesActivated) || 0,
      totalCaptured: Number(parsed.totalCaptured) || 0,
      seelieSkin,
      achievements: Array.isArray(parsed.achievements)
        ? parsed.achievements.filter((a): a is string => typeof a === 'string')
        : [],
    };
  } catch {
    return DEFAULT_FORJA_PROGRESS;
  }
}

function saveForjaProgress(progress: ForjaProgress): void {
  try {
    localStorage.setItem(FORJA_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors
  }
}

const DISTRACTION_LABELS = [
  'Scroll infinito',
  'Posponer',
  'Excusa',
  'Ruido mental',
  'Fatiga',
  'Distracción',
];

function readBestScore(): number {
  try {
    return Number(localStorage.getItem(BEST_SCORE_STORAGE_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(score));
  } catch {
    // Ignore storage quota errors
  }
}

function makeMissionForDay(day: number): DailyMission {
  const mod = (day - 1) % 3;
  if (mod === 0) {
    const goal = Math.min(8, 4 + Math.floor(day / 3));
    return { kind: 'capture', label: 'Captura hábitos', progress: 0, goal };
  }
  if (mod === 1) {
    const goal = Math.min(5, 2 + Math.floor(day / 4));
    return { kind: 'slash', label: 'Purifica espectros', progress: 0, goal };
  }
  return { kind: 'target', label: 'Golpea dianas', progress: 0, goal: 1 };
}

// Pre-allocated zero-GC math helpers
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hitPoint = new THREE.Vector3();
const _dummy = new THREE.Object3D();

interface DisciplineGameProps {
  onExit: () => void;
}

function readSwordStyle(): SwordStyle {
  try {
    const val = localStorage.getItem(SWORD_STYLE_STORAGE_KEY);
    if (val === 'celeste' || val === 'solar') return val;
    return 'volt';
  } catch {
    return 'volt';
  }
}

function saveSwordStyle(style: SwordStyle): void {
  try {
    localStorage.setItem(SWORD_STYLE_STORAGE_KEY, style);
  } catch {
    // Ignore storage quota errors
  }
}

export const DisciplineGame: React.FC<DisciplineGameProps> = ({ onExit }) => {
  const { entities, activities, today, globalStats, toggleDayStatus, showToast } = useStore();

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [difficulty, setDifficulty] = useState<DifficultyMode>('diario');
  const [muted, setMuted] = useState<boolean>(false);
  const [bestScore, setBestScore] = useState<number>(() => readBestScore());
  const [swordStyle, setSwordStyle] = useState<SwordStyle>(() => readSwordStyle());
  const [forjaProgress, setForjaProgress] = useState<ForjaProgress>(() => readForjaProgress());
  const [cameraPreset, setCameraPreset] = useState<'rpg' | 'alta'>('rpg');
  const [showTouchJoystick, setShowTouchJoystick] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    return coarse || 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768;
  });
  const [callout, setCallout] = useState<string | null>(null);

  const initialShields = useMemo(() => {
    const totalGrace = entities.reduce((acc, e) => acc + e.graceDays, 0);
    return Math.max(1, Math.min(3, Math.ceil(totalGrace / 2) || 1));
  }, [entities]);

  const hasFocusBuff = globalStats.todayCompletionPct >= 50;
  const hasStreakBuff = globalStats.maxStreak >= 7;
  const celesteUnlocked = globalStats.maxStreak >= 7 || bestScore >= 1000;
  const solarUnlocked = globalStats.maxStreak >= 30 || bestScore >= 3000;

  const activeSwordStyle: SwordStyle =
    swordStyle === 'solar' && !solarUnlocked
      ? celesteUnlocked
        ? 'celeste'
        : 'volt'
      : swordStyle === 'celeste' && !celesteUnlocked
      ? 'volt'
      : swordStyle;

  const pendingTodayHabits = useMemo(
    () => getPendingHabitsForDate(entities, activities, today),
    [entities, activities, today]
  );

  const habitPool = useMemo(() => {
    if (entities.length === 0) {
      return [
        { name: 'Enfoque', category: 'trabajo' },
        { name: 'Lectura', category: 'estudio' },
        { name: 'Entreno', category: 'salud' },
        { name: 'Diario', category: 'personal' },
      ];
    }
    return entities.map((e) => ({
      name: e.name.split(' ')[0] || e.name,
      category: e.category,
    }));
  }, [entities]);

  const [hud, setHud] = useState<HudSnapshot>({
    day: 1,
    score: 0,
    streak: 0,
    bestStreakInRun: 0,
    hp: 3,
    maxHp: 3,
    shields: initialShields,
    capturedCount: 0,
    pulseCooldownPct: 100,
    dashCooldownPct: 100,
    slashCooldownPct: 100,
    burstChargePct: 0,
    fervorTimer: 0,
    magnetTimer: 0,
    speedBoostTimer: 0,
    shrineCooldown: 0,
    comboMult: 1,
    comboLabel: 'Juramento',
    mission: makeMissionForDay(1),
    boss: null,
    playerRadar: { x: 0, z: 0 },
    radarBlips: [],
  });

  const mountRef = useRef<HTMLDivElement | null>(null);
  const joyThumbRef = useRef<HTMLDivElement | null>(null);
  const heroRigRef = useRef<HeroRig | null>(null);
  const seelieRigRef = useRef<SeelieRig | null>(null);
  const calloutTimerRef = useRef<number>(0);

  const gameStateRef = useRef<GameState>('TITLE_MENU');
  const difficultyRef = useRef<DifficultyMode>('diario');
  const habitPoolRef = useRef(habitPool);
  const initialShieldsRef = useRef(initialShields);
  const bestScoreRef = useRef(bestScore);
  const cameraPresetRef = useRef<'rpg' | 'alta'>('rpg');
  const swordStyleRef = useRef<SwordStyle>(activeSwordStyle);
  const progressRef = useRef<ForjaProgress>(forjaProgress);
  const realBuffsRef = useRef({ hasFocusBuff, hasStreakBuff });

  habitPoolRef.current = habitPool;
  initialShieldsRef.current = initialShields;
  difficultyRef.current = difficulty;
  bestScoreRef.current = bestScore;
  cameraPresetRef.current = cameraPreset;
  swordStyleRef.current = activeSwordStyle;
  progressRef.current = forjaProgress;
  realBuffsRef.current = { hasFocusBuff, hasStreakBuff };

  useEffect(() => {
    heroRigRef.current?.setSwordStyle(activeSwordStyle);
  }, [activeSwordStyle]);

  useEffect(() => {
    seelieRigRef.current?.setSkin(forjaProgress.seelieSkin);
  }, [forjaProgress.seelieSkin]);

  const handleSelectSwordStyle = useCallback((style: SwordStyle) => {
    setSwordStyle(style);
    saveSwordStyle(style);
    heroRigRef.current?.setSwordStyle(style);
  }, []);

  const triggerCallout = useCallback((msg: string) => {
    setCallout(msg);
    window.clearTimeout(calloutTimerRef.current);
    calloutTimerRef.current = window.setTimeout(() => {
      setCallout((prev) => (prev === msg ? null : prev));
    }, 2200);
  }, []);

  const recordForjaProgress = useCallback(
    (delta: {
      runsPlayedDelta?: number;
      bossesDefeatedDelta?: number;
      shrinesActivatedDelta?: number;
      totalCapturedDelta?: number;
      bestStreakInRun?: number;
      seelieSkin?: SeelieSkin;
    }) => {
      const prev = progressRef.current;
      const runsPlayed = prev.runsPlayed + (delta.runsPlayedDelta ?? 0);
      const bossesDefeated = prev.bossesDefeated + (delta.bossesDefeatedDelta ?? 0);
      const shrinesActivated = prev.shrinesActivated + (delta.shrinesActivatedDelta ?? 0);
      const totalCaptured = prev.totalCaptured + (delta.totalCapturedDelta ?? 0);
      const seelieSkin = delta.seelieSkin ?? prev.seelieSkin;

      const unlocked = new Set(prev.achievements);
      const newlyUnlocked: string[] = [];
      const check = (id: string, condition: boolean) => {
        if (condition && !unlocked.has(id)) {
          unlocked.add(id);
          newlyUnlocked.push(id);
        }
      };

      check('primer_desafio', runsPlayed >= 1);
      check('cazatitanes', bossesDefeated >= 1);
      check('maestro_altar', shrinesActivated >= 3);
      check('racha_imparable', (delta.bestStreakInRun ?? 0) >= 10);
      check('santuario_vivo', totalCaptured >= 50 || bossesDefeated >= 3);

      const next: ForjaProgress = {
        runsPlayed,
        bossesDefeated,
        shrinesActivated,
        totalCaptured,
        seelieSkin,
        achievements: Array.from(unlocked),
      };
      progressRef.current = next;
      saveForjaProgress(next);
      setForjaProgress(next);

      if (newlyUnlocked.length > 0) {
        const ach = ISLAND_ACHIEVEMENTS.find((a) => a.id === newlyUnlocked[0]);
        if (ach) {
          triggerCallout(`Logro desbloqueado: ${ach.label}`);
        }
      }
    },
    [triggerCallout]
  );

  const handleSelectSeelieSkin = useCallback(
    (skin: SeelieSkin) => {
      seelieRigRef.current?.setSkin(skin);
      recordForjaProgress({ seelieSkin: skin });
    },
    [recordForjaProgress]
  );

  const simRef = useRef({
    player: {
      x: 0,
      y: 0.14,
      z: 0,
      vx: 0,
      vz: 0,
      yaw: 0,
      walkCycle: 0,
      invulnTimer: 0,
      flashTimer: 0,
      swingTimer: 0,
      dashTimer: 0,
    },
    camera: {
      yaw: 0,
      pitch: 0.56,
      dist: 12.0,
      shakeTimer: 0,
      shakeMag: 0,
      snapTargetYaw: 0,
      snapTimer: 0,
    },
    keysHeld: new Set<string>(),
    joyInput: { x: 0, y: 0 },
    tapTarget: null as { x: number; z: number } | null,
    pulseQueued: false,
    dashQueued: false,
    slashQueued: false,
    burstQueued: false,
    pulseCooldown: 0,
    pulseMaxCooldown: 5.0,
    dashCooldown: 0,
    dashMaxCooldown: 1.8,
    slashCooldown: 0,
    slashMaxCooldown: 0.48,
    burstCharge: 0,
    burstMaxCharge: 100,
    fervorTimer: 0,
    magnetTimer: 0,
    speedBoostTimer: 0,
    shrineCooldown: 0,
    lastBossDay: 0,
    comboTimer: 0,
    comboMult: 1,
    hitstopTimer: 0,
    dayTimer: 0,
    dayDuration: 16,
    spawnHabitTimer: 0.4,
    spawnHazardTimer: 1.8,
    spawnDrainTimer: 5.0,
    spawnOrbTimer: 8.5,
    nextEntityId: 1,
    hudSyncAcc: 0,
    mission: makeMissionForDay(1),
    bossSnapshot: null as { label: string; hp: number; maxHp: number } | null,
    radarBlipsSnapshot: [] as RadarBlip[],
    stats: {
      day: 1,
      score: 0,
      streak: 0,
      bestStreakInRun: 0,
      hp: 3,
      maxHp: 3,
      shields: 1,
      capturedCount: 0,
    },
    resetWorldEntities: null as null | (() => void),
  });

  const syncHudNow = useCallback(() => {
    const s = simRef.current;
    const pulsePct = Math.round(
      Math.max(0, Math.min(1, 1 - s.pulseCooldown / s.pulseMaxCooldown)) * 100
    );
    const dashPct = Math.round(
      Math.max(0, Math.min(1, 1 - s.dashCooldown / s.dashMaxCooldown)) * 100
    );
    const slashPct = Math.round(
      Math.max(0, Math.min(1, 1 - s.slashCooldown / s.slashMaxCooldown)) * 100
    );
    const burstPct = Math.round(
      Math.max(0, Math.min(1, s.burstCharge / s.burstMaxCharge)) * 100
    );

    const streak = s.stats.streak;
    let comboLabel = 'Constante';
    if (s.fervorTimer > 0) comboLabel = 'Fervor ×2';
    else if (streak >= 30) comboLabel = 'Leyenda 30d+';
    else if (streak >= 14) comboLabel = 'Imparable';
    else if (streak >= 7) comboLabel = 'Racha 7d+';
    else if (streak === 0) comboLabel = 'Juramento';

    setHud({
      day: s.stats.day,
      score: s.stats.score,
      streak: s.stats.streak,
      bestStreakInRun: s.stats.bestStreakInRun,
      hp: s.stats.hp,
      maxHp: s.stats.maxHp,
      shields: s.stats.shields,
      capturedCount: s.stats.capturedCount,
      pulseCooldownPct: pulsePct,
      dashCooldownPct: dashPct,
      slashCooldownPct: slashPct,
      burstChargePct: burstPct,
      fervorTimer: s.fervorTimer,
      magnetTimer: s.magnetTimer,
      speedBoostTimer: s.speedBoostTimer,
      shrineCooldown: s.shrineCooldown,
      comboMult: s.comboMult,
      comboLabel,
      mission: { ...s.mission },
      boss: s.bossSnapshot ? { ...s.bossSnapshot } : null,
      playerRadar: {
        x: THREE.MathUtils.clamp(s.player.x / ARENA_RADIUS, -1, 1),
        z: THREE.MathUtils.clamp(s.player.z / ARENA_RADIUS, -1, 1),
      },
      radarBlips: s.radarBlipsSnapshot.slice(),
    });
  }, []);

  const resetSimulation = useCallback(() => {
    const s = simRef.current;
    const mode = difficultyRef.current;
    s.player = {
      x: 0,
      y: groundHeightAt(0, 0),
      z: 0,
      vx: 0,
      vz: 0,
      yaw: 0,
      walkCycle: 0,
      invulnTimer: 0,
      flashTimer: 0,
      swingTimer: 0,
      dashTimer: 0,
    };
    s.camera.yaw = 0;
    s.camera.shakeTimer = 0;
    s.camera.snapTimer = 0;
    s.tapTarget = null;
    s.pulseQueued = false;
    s.dashQueued = false;
    s.slashQueued = false;
    s.burstQueued = false;
    s.pulseCooldown = 0;
    s.dashCooldown = 0;
    s.slashCooldown = 0;
    s.burstCharge = 0;
    s.fervorTimer = 0;
    s.magnetTimer = 0;
    s.speedBoostTimer = 0;
    s.shrineCooldown = 0;
    s.lastBossDay = 0;
    s.comboTimer = 0;
    s.comboMult = 1;
    s.hitstopTimer = 0;
    s.dayTimer = 0;
    s.spawnHabitTimer = 0.35;
    s.spawnHazardTimer = mode === 'implacable' ? 1.2 : 1.8;
    s.spawnDrainTimer = 4.5;
    s.spawnOrbTimer = 8.0;
    s.mission = makeMissionForDay(1);
    s.bossSnapshot = null;
    s.radarBlipsSnapshot = [];
    s.stats = {
      day: 1,
      score: 0,
      streak: 0,
      bestStreakInRun: 0,
      hp: mode === 'implacable' ? 2 : 3,
      maxHp: mode === 'implacable' ? 2 : 3,
      shields: mode === 'implacable' ? 1 : initialShieldsRef.current,
      capturedCount: 0,
    };
    s.resetWorldEntities?.();
    setCallout(null);
    syncHudNow();
  }, [syncHudNow]);

  const startGame = useCallback(() => {
    resetSimulation();
    gameStateRef.current = 'PLAYING';
    setGameState('PLAYING');
    recordForjaProgress({ runsPlayedDelta: 1 });
    gameAudio.playDayUp();
  }, [recordForjaProgress, resetSimulation]);

  const togglePause = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') {
      gameStateRef.current = 'PAUSED';
      setGameState('PAUSED');
    } else if (gameStateRef.current === 'PAUSED') {
      gameStateRef.current = 'PLAYING';
      setGameState('PLAYING');
    }
  }, []);

  const triggerPulse = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') simRef.current.pulseQueued = true;
  }, []);

  const triggerDash = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') simRef.current.dashQueued = true;
  }, []);

  const triggerSlash = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') simRef.current.slashQueued = true;
  }, []);

  const triggerBurst = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') simRef.current.burstQueued = true;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      gameAudio.setMuted(next);
      return next;
    });
  }, []);

  const toggleCameraPreset = useCallback(() => {
    setCameraPreset((prev) => (prev === 'rpg' ? 'alta' : 'rpg'));
  }, []);

  const centerCamera = useCallback(() => {
    const s = simRef.current;
    s.camera.snapTargetYaw = s.player.yaw + Math.PI;
    s.camera.snapTimer = 0.28;
  }, []);

  // Keyboard bindings
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault();
      }

      if (key === 'escape') {
        if (gameStateRef.current === 'PLAYING' || gameStateRef.current === 'PAUSED') {
          togglePause();
        }
        return;
      }

      if ((key === ' ' || key === 'enter') && gameStateRef.current === 'TITLE_MENU') {
        startGame();
        return;
      }

      if (gameStateRef.current === 'PLAYING') {
        if (key === 'f' || key === 'j') {
          simRef.current.slashQueued = true;
          return;
        }
        if (key === ' ' || key === 'e') {
          simRef.current.pulseQueued = true;
          return;
        }
        if (key === 'shift') {
          simRef.current.dashQueued = true;
          return;
        }
        if (key === 'q') {
          simRef.current.burstQueued = true;
          return;
        }
      }

      simRef.current.keysHeld.add(key);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      simRef.current.keysHeld.delete(e.key.toLowerCase());
    };

    const onBlur = () => {
      simRef.current.keysHeld.clear();
      simRef.current.joyInput = { x: 0, y: 0 };
      simRef.current.tapTarget = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [startGame, togglePause]);

  // Isolated Three.js WebGL Scene & 60fps Game Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const isMobileViewport = () => window.innerWidth < 768;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.setPixelRatio(
      isSoftwareGl
        ? 1
        : Math.min(window.devicePixelRatio || 1, isMobileViewport() ? 1.5 : 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const rect = container.getBoundingClientRect();
    const initW = Math.max(300, Math.floor(rect.width));
    const initH = Math.max(300, Math.floor(rect.height));
    const initAspect = initW / initH;
    renderer.setSize(initW, initH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Far-horizon fog only: keeps the entire playable island crisp with zero milky haze
    scene.fog = new THREE.Fog(0x75bce8, 45, 135);

    // Responsive FOV for portrait mobile so entire arena remains legible!
    const computeFov = (aspect: number) => (aspect < 0.85 ? 64 : 52);
    const camera = new THREE.PerspectiveCamera(computeFov(initAspect), initAspect, 0.1, 240);
    camera.position.set(0, 7.5, 13.5);

    // Studio Environment Reflection (RoomEnvironment at controlled intensity to avoid washing out toon materials)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.35;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Balanced Sunny Daytime Lighting Rig (crisp cel-shaded contrast without overexposure)
    const hemiLight = new THREE.HemisphereLight(0x6ab8f7, 0x1e3a24, 0.48);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff0cc, 1.35);
    sunLight.position.set(22, 32, -18);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(isMobileViewport() ? 1024 : 2048, isMobileViewport() ? 1024 : 2048);
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 85;
      const d = 24;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x88ccff, 0.32);
    rimLight.position.set(-16, 12, 18);
    scene.add(rimLight);

    // Build Sunny Stylized Island World + Hero + Seelie
    const matRegistry = createMaterialRegistry(renderer);

    const skyGeo = new THREE.SphereGeometry(130, 32, 20);
    const skyDome = new THREE.Mesh(skyGeo, matRegistry.skyMaterial);
    scene.add(skyDome);

    const sanctuary = createSanctuaryWorld(matRegistry);
    scene.add(sanctuary.group);

    const heroBuilt = createHeroTraveler(matRegistry);
    heroBuilt.rig.setSwordStyle(swordStyleRef.current);
    heroRigRef.current = heroBuilt.rig;
    heroBuilt.rig.root.position.set(0, groundHeightAt(0, 0), 0);
    scene.add(heroBuilt.rig.root);

    const seelieBuilt = createCompanionSeelie();
    seelieBuilt.rig.setSkin(progressRef.current.seelieSkin);
    seelieRigRef.current = seelieBuilt.rig;
    scene.add(seelieBuilt.rig.root);

    const burstBeamGeo = new THREE.CylinderGeometry(3.2, 4.6, 28, 24, 1, true);
    const burstBeamMat = new THREE.MeshBasicMaterial({
      color: 0xd8f23a,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const burstBeam = new THREE.Mesh(burstBeamGeo, burstBeamMat);
    burstBeam.position.y = 14;
    burstBeam.visible = false;
    scene.add(burstBeam);

    // Pooled InstancedMesh Particles + Shockwave Rings
    const PARTICLE_COUNT = 160;
    const particleGeo = new THREE.OctahedronGeometry(0.14, 0);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInst = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_COUNT);
    particleInst.frustumCulled = false;
    const particlePool: BurstParticle3D[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      active: false,
      x: 0,
      y: -50,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      scale: 0,
      color: new THREE.Color(0xd8f23a),
    }));
    scene.add(particleInst);

    const shockwaveGeo = new THREE.TorusGeometry(1, 0.08, 8, 40);
    shockwaveGeo.rotateX(Math.PI / 2);
    const activeShockwaves: Shockwave3D[] = [];
    const activeHabits: HabitNode3D[] = [];
    const activeHazards: HazardSpecter3D[] = [];
    const activeDrainers: DrainSpecter3D[] = [];
    const activeOrbs: BoostOrb3D[] = [];
    let activeBoss: BossEntity3D | null = null;

    // Pre-compile scene shaders once for hitch-free first frame and razor-sharp cel contrast
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const spawnParticles3D = (
      x: number,
      y: number,
      z: number,
      hexColor: number,
      count: number,
      speed = 6.5
    ) => {
      let spawned = 0;
      for (let i = 0; i < particlePool.length && spawned < count; i++) {
        const p = particlePool[i];
        if (!p.active) {
          const theta = Math.random() * Math.PI * 2;
          const up = 2.0 + Math.random() * 4.5;
          const horiz = (0.35 + Math.random() * 0.75) * speed;
          p.active = true;
          p.x = x;
          p.y = y;
          p.z = z;
          p.vx = Math.cos(theta) * horiz;
          p.vy = up;
          p.vz = Math.sin(theta) * horiz;
          p.life = 0.35 + Math.random() * 0.35;
          p.maxLife = p.life;
          p.scale = 0.75 + Math.random() * 0.85;
          p.color.setHex(hexColor);
          spawned++;
        }
      }
    };

    const spawnShockwave3D = (
      x: number,
      y: number,
      z: number,
      hexColor: number,
      maxScale: number,
      duration = 0.42
    ) => {
      const mat = new THREE.MeshBasicMaterial({
        color: hexColor,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(shockwaveGeo, mat);
      mesh.position.set(x, y + 0.14, z);
      mesh.scale.setScalar(0.4);
      scene.add(mesh);
      activeShockwaves.push({
        mesh,
        life: duration,
        maxLife: duration,
        maxScale,
      });
    };

    const advanceMission = (kind: MissionKind, amount = 1) => {
      const s = simRef.current;
      if (s.mission.kind !== kind) return;
      s.mission.progress = Math.min(s.mission.goal, s.mission.progress + amount);
      if (s.mission.progress >= s.mission.goal) {
        s.stats.score += 200;
        if (s.stats.shields < 3) s.stats.shields += 1;
        s.stats.day += 1;
        s.dayTimer = 0;
        s.mission = makeMissionForDay(s.stats.day);
        gameAudio.playDayUp();
        spawnShockwave3D(s.player.x, s.player.y, s.player.z, 0xfacc15, 6.0, 0.5);
        triggerCallout('¡Misión cumplida! +200 pts · +1 Escudo');
      }
    };

    const clearDynamicEntities = () => {
      for (const hb of activeHabits) {
        scene.remove(hb.rig.root);
        hb.rig.dispose();
      }
      activeHabits.length = 0;

      for (const hz of activeHazards) {
        scene.remove(hz.rig.root);
        hz.rig.dispose();
      }
      activeHazards.length = 0;

      for (const dr of activeDrainers) {
        scene.remove(dr.rig.root);
        dr.rig.dispose();
      }
      activeDrainers.length = 0;

      for (const orb of activeOrbs) {
        scene.remove(orb.rig.root);
        orb.rig.dispose();
      }
      activeOrbs.length = 0;

      if (activeBoss) {
        scene.remove(activeBoss.rig.root);
        activeBoss.rig.dispose();
        activeBoss = null;
      }

      for (const sw of activeShockwaves) {
        scene.remove(sw.mesh);
        (sw.mesh.material as THREE.Material).dispose();
      }
      activeShockwaves.length = 0;

      for (const p of particlePool) p.active = false;
      burstBeam.visible = false;
    };

    simRef.current.resetWorldEntities = clearDynamicEntities;

    const spawnHabitShard = () => {
      const s = simRef.current;
      const pool = habitPoolRef.current;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      const angle = Math.random() * Math.PI * 2;
      const rad = 2.6 + Math.random() * (ARENA_RADIUS - 4.4);
      const x = Math.cos(angle) * rad;
      const z = Math.sin(angle) * rad;
      const driftAngle = Math.random() * Math.PI * 2;
      const driftSpeed = 0.75 + Math.min(2.0, s.stats.day * 0.14);
      const isGraceBonus = s.stats.shields < 3 && Math.random() < 0.16;
      const label = isGraceBonus ? 'Gracia +1' : picked.name;
      const rig = createHabitShardModel(label, picked.category, isGraceBonus, matRegistry);
      rig.root.position.set(x, groundHeightAt(x, z), z);
      scene.add(rig.root);

      const maxLife = difficultyRef.current === 'implacable' ? 7.2 : 9.5;
      activeHabits.push({
        id: s.nextEntityId++,
        x,
        z,
        vx: Math.cos(driftAngle) * driftSpeed,
        vz: Math.sin(driftAngle) * driftSpeed,
        radius: 0.95,
        label,
        category: picked.category,
        life: maxLife,
        maxLife,
        isGraceBonus,
        phase: Math.random() * Math.PI * 2,
        rig,
      });
    };

    const spawnBoostOrb = () => {
      const s = simRef.current;
      const kind: 'magnet' | 'speed' = Math.random() < 0.5 ? 'magnet' : 'speed';
      const angle = Math.random() * Math.PI * 2;
      const rad = 4.2 + Math.random() * (ARENA_RADIUS - 6.8);
      const x = Math.cos(angle) * rad;
      const z = Math.sin(angle) * rad;
      const rig = createBoostOrbModel(kind, matRegistry);
      rig.root.position.set(x, groundHeightAt(x, z), z);
      scene.add(rig.root);
      activeOrbs.push({
        id: s.nextEntityId++,
        kind,
        x,
        z,
        life: 11,
        phase: Math.random() * Math.PI * 2,
        rig,
      });
    };

    const spawnBossTitan = (day: number) => {
      const s = simRef.current;
      const angle = Math.random() * Math.PI * 2;
      const rad = ARENA_RADIUS - 2.4;
      const x = Math.cos(angle) * rad;
      const z = Math.sin(angle) * rad;
      const maxHp = 4 + Math.floor(day / 5) * 2;
      const label = `Titán Día ${day}`;
      const rig = createBossSpecterModel(label, matRegistry);
      rig.root.position.set(x, groundHeightAt(x, z), z);
      scene.add(rig.root);
      activeBoss = {
        x,
        z,
        vx: 0,
        vz: 0,
        hp: maxHp,
        maxHp,
        radius: 1.55,
        attackTimer: 3.4,
        windup: 0,
        hitFlash: 0,
        label,
        rig,
      };
      s.bossSnapshot = { label, hp: maxHp, maxHp };
      spawnShockwave3D(x, 0, z, 0xf43f5e, 6.2, 0.55);
      gameAudio.playHit();
      triggerCallout(`¡${label} ha aparecido! Usa Corte (F) o Onda (E)`);
      syncHudNow();
    };

    const damageBoss = (amount: number) => {
      const s = simRef.current;
      if (!activeBoss) return;
      activeBoss.hp = Math.max(0, activeBoss.hp - amount);
      activeBoss.hitFlash = 0.25;
      spawnParticles3D(activeBoss.x, 1.8, activeBoss.z, 0xfacc15, 22, 7.5);
      spawnShockwave3D(activeBoss.x, 0, activeBoss.z, 0xf43f5e, 3.2, 0.3);
      if (activeBoss.hp <= 0) {
        const mult = (s.fervorTimer > 0 ? 2 : 1) * s.comboMult;
        s.stats.score += 450 * mult;
        s.stats.hp = Math.min(s.stats.maxHp, s.stats.hp + 1);
        s.stats.shields = Math.min(3, s.stats.shields + 1);
        s.burstCharge = Math.min(s.burstMaxCharge, s.burstCharge + 35);
        spawnParticles3D(activeBoss.x, 2.0, activeBoss.z, 0xfacc15, 45, 10.5);
        spawnShockwave3D(activeBoss.x, 0, activeBoss.z, 0xfacc15, 9.5, 0.6);
        scene.remove(activeBoss.rig.root);
        activeBoss.rig.dispose();
        activeBoss = null;
        s.bossSnapshot = null;
        gameAudio.playBossDefeat();
        recordForjaProgress({ bossesDefeatedDelta: 1 });
        triggerCallout('¡Titán derrotado! +450 pts · +1 Enfoque · +1 Escudo');
      } else {
        s.bossSnapshot = {
          label: activeBoss.label,
          hp: activeBoss.hp,
          maxHp: activeBoss.maxHp,
        };
        gameAudio.playBossHit();
      }
    };

    const activateShrine = () => {
      const s = simRef.current;
      if (s.shrineCooldown > 0) return;
      s.shrineCooldown = 22.0;
      s.fervorTimer = Math.max(s.fervorTimer, 6.0);
      s.burstCharge = Math.min(s.burstMaxCharge, s.burstCharge + 25);
      if (s.stats.hp < s.stats.maxHp) {
        s.stats.hp += 1;
        triggerCallout('¡Altar activado! +1 Enfoque · Fervor ×2');
      } else {
        s.stats.shields = Math.min(3, s.stats.shields + 1);
        triggerCallout('¡Altar activado! +1 Escudo · Fervor ×2');
      }
      spawnShockwave3D(sanctuary.shrinePos.x, 0, sanctuary.shrinePos.z, 0x38bdf8, 6.4, 0.55);
      spawnParticles3D(sanctuary.shrinePos.x, 1.8, sanctuary.shrinePos.z, 0x38bdf8, 30, 7.5);
      gameAudio.playShrineActivate();
      recordForjaProgress({ shrinesActivatedDelta: 1 });
      syncHudNow();
    };

    const updateRadarSnapshot = () => {
      const s = simRef.current;
      const blips: RadarBlip[] = [
        {
          x: sanctuary.shrinePos.x / ARENA_RADIUS,
          z: sanctuary.shrinePos.z / ARENA_RADIUS,
          kind: 'shrine',
        },
      ];
      for (const hb of activeHabits) {
        blips.push({
          x: THREE.MathUtils.clamp(hb.x / ARENA_RADIUS, -1, 1),
          z: THREE.MathUtils.clamp(hb.z / ARENA_RADIUS, -1, 1),
          kind: 'habit',
        });
      }
      for (const hz of activeHazards) {
        blips.push({
          x: THREE.MathUtils.clamp(hz.x / ARENA_RADIUS, -1, 1),
          z: THREE.MathUtils.clamp(hz.z / ARENA_RADIUS, -1, 1),
          kind: 'hazard',
        });
      }
      for (const dr of activeDrainers) {
        blips.push({
          x: THREE.MathUtils.clamp(dr.x / ARENA_RADIUS, -1, 1),
          z: THREE.MathUtils.clamp(dr.z / ARENA_RADIUS, -1, 1),
          kind: 'drainer',
        });
      }
      for (const orb of activeOrbs) {
        blips.push({
          x: THREE.MathUtils.clamp(orb.x / ARENA_RADIUS, -1, 1),
          z: THREE.MathUtils.clamp(orb.z / ARENA_RADIUS, -1, 1),
          kind: 'orb',
        });
      }
      if (activeBoss) {
        blips.push({
          x: THREE.MathUtils.clamp(activeBoss.x / ARENA_RADIUS, -1, 1),
          z: THREE.MathUtils.clamp(activeBoss.z / ARENA_RADIUS, -1, 1),
          kind: 'boss',
        });
      }
      s.radarBlipsSnapshot = blips;
    };

    const spawnDistractionSpecter = () => {
      const s = simRef.current;
      const angle = Math.random() * Math.PI * 2;
      const rad = ARENA_RADIUS - 1.5;
      const x = Math.cos(angle) * rad;
      const z = Math.sin(angle) * rad;
      const label =
        DISTRACTION_LABELS[Math.floor(Math.random() * DISTRACTION_LABELS.length)];
      const rig = createDistractionSpecterModel(label, matRegistry);
      rig.root.position.set(x, groundHeightAt(x, z), z);
      scene.add(rig.root);

      const windup = Math.max(0.65, 1.25 - s.stats.day * 0.035);
      activeHazards.push({
        id: s.nextEntityId++,
        x,
        z,
        vx: 0,
        vz: 0,
        radius: 0.92,
        windup,
        maxWindup: windup,
        dashed: false,
        label,
        rig,
      });
    };

    const spawnDrainSpecter = () => {
      const s = simRef.current;
      const angle = Math.random() * Math.PI * 2;
      const rad = ARENA_RADIUS - 2.0;
      const x = Math.cos(angle) * rad;
      const z = Math.sin(angle) * rad;
      const label = 'Sombra Drenadora';
      const rig = createDrainSpecterModel(label, matRegistry);
      rig.root.position.set(x, groundHeightAt(x, z), z);
      scene.add(rig.root);

      activeDrainers.push({
        id: s.nextEntityId++,
        x,
        z,
        radius: 0.95,
        phase: Math.random() * Math.PI * 2,
        label,
        rig,
      });
    };

    const applyDamage = (reason: 'hazard' | 'missed') => {
      const s = simRef.current;
      if (s.player.invulnTimer > 0 && reason === 'hazard') return;

      if (s.stats.shields > 0) {
        s.stats.shields -= 1;
        s.player.invulnTimer = 0.95;
        s.player.flashTimer = 0.25;
        s.hitstopTimer = 0.04;
        s.camera.shakeTimer = 0.24;
        s.camera.shakeMag = 0.35;
        spawnShockwave3D(s.player.x, s.player.y, s.player.z, 0xfacc15, 4.4);
        spawnParticles3D(s.player.x, s.player.y + 1.0, s.player.z, 0xfacc15, 22, 6);
        gameAudio.playGraceShield();
        triggerCallout('¡Escudo de Gracia consumido!');
        syncHudNow();
        return;
      }

      s.stats.streak = 0;
      s.comboMult = 1;
      s.comboTimer = 0;
      s.stats.hp = Math.max(0, s.stats.hp - 1);
      s.player.invulnTimer = 1.1;
      s.player.flashTimer = 0.3;
      s.hitstopTimer = 0.06;
      s.camera.shakeTimer = 0.32;
      s.camera.shakeMag = 0.52;
      spawnShockwave3D(s.player.x, s.player.y, s.player.z, 0xef4444, 3.5);
      spawnParticles3D(s.player.x, s.player.y + 1.0, s.player.z, 0xef4444, 28, 7.5);

      if (s.stats.hp <= 0) {
        gameAudio.playGameOver();
        if (s.stats.score > bestScoreRef.current) {
          saveBestScore(s.stats.score);
          setBestScore(s.stats.score);
        }
        recordForjaProgress({ bestStreakInRun: s.stats.bestStreakInRun });
        gameStateRef.current = 'GAME_OVER';
        setGameState('GAME_OVER');
      } else {
        gameAudio.playHit();
      }
      syncHudNow();
    };

    // Pointer Orbit + Tap-to-Move Raycast + Wheel Zoom
    let isDragging = false;
    let dragDistance = 0;
    let lastPtrX = 0;
    let lastPtrY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (gameStateRef.current !== 'PLAYING') return;
      isDragging = true;
      dragDistance = 0;
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging || gameStateRef.current !== 'PLAYING') return;
      const dx = e.clientX - lastPtrX;
      const dy = e.clientY - lastPtrY;
      dragDistance += Math.hypot(dx, dy);
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
      simRef.current.camera.yaw -= dx * 0.0065;
      simRef.current.camera.pitch = THREE.MathUtils.clamp(
        simRef.current.camera.pitch + dy * 0.004,
        0.26,
        1.15
      );
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      if (gameStateRef.current === 'PLAYING' && dragDistance < 8) {
        const bounds = renderer.domElement.getBoundingClientRect();
        _pointerNdc.set(
          ((e.clientX - bounds.left) / bounds.width) * 2 - 1,
          -((e.clientY - bounds.top) / bounds.height) * 2 + 1
        );
        _raycaster.setFromCamera(_pointerNdc, camera);
        if (_raycaster.ray.intersectPlane(_groundPlane, _hitPoint)) {
          const r = Math.hypot(_hitPoint.x, _hitPoint.z);
          if (r > ARENA_RADIUS - 0.8) {
            const scale = (ARENA_RADIUS - 0.8) / r;
            _hitPoint.x *= scale;
            _hitPoint.z *= scale;
          }
          simRef.current.tapTarget = { x: _hitPoint.x, z: _hitPoint.z };
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      simRef.current.camera.dist = THREE.MathUtils.clamp(
        simRef.current.camera.dist + e.deltaY * 0.008,
        7.5,
        18.5
      );
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    let curAspect = initAspect;
    const resize = () => {
      const r = container.getBoundingClientRect();
      const w = Math.max(300, Math.floor(r.width));
      const h = Math.max(300, Math.floor(r.height));
      curAspect = w / h;
      camera.fov = computeFov(curAspect);
      camera.aspect = curAspect;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const rawDt = clock.getDelta();
      const elapsed = clock.elapsedTime;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      const s = simRef.current;

      // Sky, Lagoon Water & Drifting Clouds
      matRegistry.skyMaterial.uniforms.uTime.value = elapsed;
      matRegistry.waterMaterial.uniforms.uTime.value = elapsed;

      for (const cloud of sanctuary.floatingClouds) {
        const orbitAngle = (cloud.userData.orbitAngle as number) + elapsed * 0.025;
        const rad = cloud.userData.orbitRadius as number;
        const baseY = cloud.userData.baseY as number;
        cloud.position.set(
          Math.cos(orbitAngle) * rad,
          baseY + Math.sin(elapsed * 0.5 + orbitAngle) * 0.45,
          Math.sin(orbitAngle) * rad
        );
      }

      for (let i = 0; i < sanctuary.lanterns.length; i++) {
        const lan = sanctuary.lanterns[i];
        lan.rotation.z = Math.sin(elapsed * 2.2 + i) * 0.08;
      }

      for (const sign of sanctuary.targetSigns) {
        if (sign.cooldown > 0) sign.cooldown = Math.max(0, sign.cooldown - dt);
        if (sign.wobble > 0) {
          sign.wobble = Math.max(0, sign.wobble - dt * 3.5);
          sign.headPivot.rotation.x = Math.sin(elapsed * 26) * 0.35 * sign.wobble;
        } else {
          sign.headPivot.rotation.x = THREE.MathUtils.damp(sign.headPivot.rotation.x, 0, 12, dt);
        }
      }

      // Animate Interactive Altar de Enfoque
      const shrineReady = simRef.current.shrineCooldown <= 0;
      sanctuary.shrineCrystal.rotation.y += dt * (shrineReady ? 2.4 : 0.6);
      sanctuary.shrineCrystal.position.y =
        1.65 + Math.sin(elapsed * (shrineReady ? 3.5 : 1.4)) * (shrineReady ? 0.16 : 0.05);
      sanctuary.shrineRing.visible = shrineReady;
      if (shrineReady) {
        const pulse = 1 + Math.sin(elapsed * 4) * 0.08;
        sanctuary.shrineRing.scale.setScalar(pulse);
      }

      if (gameStateRef.current === 'PLAYING') {
        if (s.hitstopTimer > 0) {
          s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
        } else {
          if (s.pulseCooldown > 0) s.pulseCooldown = Math.max(0, s.pulseCooldown - dt);
          if (s.dashCooldown > 0) s.dashCooldown = Math.max(0, s.dashCooldown - dt);
          if (s.slashCooldown > 0) s.slashCooldown = Math.max(0, s.slashCooldown - dt);
          if (s.fervorTimer > 0) s.fervorTimer = Math.max(0, s.fervorTimer - dt);
          if (s.magnetTimer > 0) s.magnetTimer = Math.max(0, s.magnetTimer - dt);
          if (s.speedBoostTimer > 0) s.speedBoostTimer = Math.max(0, s.speedBoostTimer - dt);
          if (s.shrineCooldown > 0) s.shrineCooldown = Math.max(0, s.shrineCooldown - dt);
          if (s.comboTimer > 0) {
            s.comboTimer = Math.max(0, s.comboTimer - dt);
            if (s.comboTimer === 0) s.comboMult = 1;
          }
          if (s.player.invulnTimer > 0)
            s.player.invulnTimer = Math.max(0, s.player.invulnTimer - dt);
          if (s.player.flashTimer > 0)
            s.player.flashTimer = Math.max(0, s.player.flashTimer - dt);
          if (s.player.swingTimer > 0)
            s.player.swingTimer = Math.max(0, s.player.swingTimer - dt);
          if (s.player.dashTimer > 0)
            s.player.dashTimer = Math.max(0, s.player.dashTimer - dt);
          if (s.camera.shakeTimer > 0)
            s.camera.shakeTimer = Math.max(0, s.camera.shakeTimer - dt);

          // Day progression + Boss spawning every 5th day
          s.dayTimer += dt;
          if (s.dayTimer >= s.dayDuration) {
            s.dayTimer -= s.dayDuration;
            s.stats.day += 1;
            const mult = (s.fervorTimer > 0 ? 2 : 1) * s.comboMult;
            s.stats.score += (120 + s.stats.streak * 6) * mult;
            gameAudio.playDayUp();
            spawnShockwave3D(s.player.x, s.player.y, s.player.z, 0xd8f23a, 5.5);
            syncHudNow();
          }

          if (s.stats.day % 5 === 0 && !activeBoss && s.lastBossDay !== s.stats.day) {
            s.lastBossDay = s.stats.day;
            spawnBossTitan(s.stats.day);
          }

          // Check walking directly over ready Altar de Enfoque
          if (
            s.shrineCooldown <= 0 &&
            Math.hypot(sanctuary.shrinePos.x - s.player.x, sanctuary.shrinePos.z - s.player.z) <=
              2.15
          ) {
            activateShrine();
          }

          // Skill 0: Basic Sword Slash (F / J / Espada button) -> hits Specters, Targets, Boss & Altar!
          if (s.slashQueued) {
            s.slashQueued = false;
            if (s.slashCooldown <= 0) {
              s.slashCooldown = s.slashMaxCooldown;
              s.player.swingTimer = 0.3;
              heroBuilt.rig.slashArc.visible = true;
              (heroBuilt.rig.slashArc.material as THREE.MeshBasicMaterial).opacity = 0.92;
              gameAudio.playDash();

              const slashRange = realBuffsRef.current.hasStreakBuff ? 4.2 : 3.5;
              const burstBonus = realBuffsRef.current.hasStreakBuff ? 13 : 10;
              const fx = Math.sin(s.player.yaw);
              const fz = Math.cos(s.player.yaw);

              for (let i = activeHazards.length - 1; i >= 0; i--) {
                const hz = activeHazards[i];
                const dx = hz.x - s.player.x;
                const dz = hz.z - s.player.z;
                const dist = Math.hypot(dx, dz);
                const forwardDot = dist > 0.01 ? (dx * fx + dz * fz) / dist : 1;
                if (dist <= slashRange && forwardDot > -0.15) {
                  spawnParticles3D(hz.x, 1.0, hz.z, 0xef4444, 18, 6.5);
                  spawnShockwave3D(hz.x, 0, hz.z, 0xd8f23a, 2.0, 0.25);
                  scene.remove(hz.rig.root);
                  hz.rig.dispose();
                  activeHazards.splice(i, 1);
                  s.stats.score += 55 * (s.fervorTimer > 0 ? 2 : 1);
                  s.burstCharge = Math.min(s.burstMaxCharge, s.burstCharge + burstBonus);
                  advanceMission('slash', 1);
                  gameAudio.playCapture(s.stats.streak + 2);
                }
              }

              // Slash also purifies Sombra Drenadora (+75 pts, +15% Ult)
              for (let i = activeDrainers.length - 1; i >= 0; i--) {
                const dr = activeDrainers[i];
                const dx = dr.x - s.player.x;
                const dz = dr.z - s.player.z;
                const dist = Math.hypot(dx, dz);
                const forwardDot = dist > 0.01 ? (dx * fx + dz * fz) / dist : 1;
                if (dist <= slashRange && forwardDot > -0.15) {
                  spawnParticles3D(dr.x, 1.1, dr.z, 0xc084fc, 22, 7.0);
                  spawnShockwave3D(dr.x, 0, dr.z, 0xc084fc, 2.4, 0.28);
                  scene.remove(dr.rig.root);
                  dr.rig.dispose();
                  activeDrainers.splice(i, 1);
                  s.stats.score += 75 * (s.fervorTimer > 0 ? 2 : 1);
                  s.burstCharge = Math.min(s.burstMaxCharge, s.burstCharge + 15);
                  advanceMission('slash', 1);
                  gameAudio.playCapture(s.stats.streak + 3);
                  triggerCallout('¡Sombra Drenadora purificada! +75 pts · +15% Ult');
                }
              }

              // Hit active Boss Titan if within slash range
              if (activeBoss) {
                const bdx = activeBoss.x - s.player.x;
                const bdz = activeBoss.z - s.player.z;
                const bDist = Math.hypot(bdx, bdz);
                const bDot = bDist > 0.01 ? (bdx * fx + bdz * fz) / bDist : 1;
                if (bDist <= slashRange + 1.1 && bDot > -0.25) {
                  damageBoss(s.fervorTimer > 0 ? 2 : 1);
                }
              }

              // Slashing near ready Altar de Enfoque triggers it too
              if (
                s.shrineCooldown <= 0 &&
                Math.hypot(
                  sanctuary.shrinePos.x - s.player.x,
                  sanctuary.shrinePos.z - s.player.z
                ) <= 3.3
              ) {
                activateShrine();
              }

              // Check interactive Red-White Bullseye Target Signs!
              for (const sign of sanctuary.targetSigns) {
                if (sign.cooldown <= 0) {
                  const d = Math.hypot(sign.x - s.player.x, sign.z - s.player.z);
                  if (d <= 4.3) {
                    sign.cooldown = 3.5;
                    sign.wobble = 1.0;
                    s.stats.score += 150 * (s.fervorTimer > 0 ? 2 : 1);
                    s.burstCharge = Math.min(s.burstMaxCharge, s.burstCharge + 22);
                    spawnParticles3D(sign.x, 4.2, sign.z, 0xfacc15, 22, 6);
                    spawnShockwave3D(sign.x, 0, sign.z, 0xef4444, 3.0, 0.38);
                    gameAudio.playGracePickup();
                    advanceMission('target', 1);
                    triggerCallout('¡Diana! +150 pts · +22% Definitiva');
                  }
                }
              }
              syncHudNow();
            }
          }

          // Skill 1: Dash / Esquiva Elemental (Shift)
          if (s.dashQueued) {
            s.dashQueued = false;
            if (s.dashCooldown <= 0) {
              s.dashCooldown = s.speedBoostTimer > 0 ? s.dashMaxCooldown * 0.55 : s.dashMaxCooldown;
              s.player.dashTimer = 0.22;
              s.player.invulnTimer = Math.max(s.player.invulnTimer, 0.36);
              const dirX = Math.sin(s.player.yaw);
              const dirZ = Math.cos(s.player.yaw);
              s.player.vx = dirX * 22;
              s.player.vz = dirZ * 22;
              spawnShockwave3D(s.player.x, s.player.y, s.player.z, 0x38bdf8, 2.5, 0.3);
              spawnParticles3D(s.player.x, s.player.y + 0.8, s.player.z, 0x7dd3fc, 14, 5);
              gameAudio.playDash();
              syncHudNow();
            }
          }

          // Skill 2: Estallido de Enfoque (E / Espacio)
          if (s.pulseQueued) {
            s.pulseQueued = false;
            if (s.pulseCooldown <= 0) {
              s.pulseCooldown = s.pulseMaxCooldown;
              s.player.swingTimer = 0.32;
              s.camera.shakeTimer = 0.16;
              s.camera.shakeMag = 0.26;
              spawnShockwave3D(s.player.x, s.player.y, s.player.z, 0xd8f23a, 7.2, 0.45);
              spawnParticles3D(s.player.x, s.player.y + 1.0, s.player.z, 0xd8f23a, 26, 8);
              gameAudio.playPulse();

              const blastR = 7.2;
              for (let i = activeHazards.length - 1; i >= 0; i--) {
                const hz = activeHazards[i];
                if (Math.hypot(hz.x - s.player.x, hz.z - s.player.z) <= blastR) {
                  spawnParticles3D(hz.x, 1.0, hz.z, 0xef4444, 16, 6);
                  scene.remove(hz.rig.root);
                  hz.rig.dispose();
                  activeHazards.splice(i, 1);
                  s.stats.score += 35 * (s.fervorTimer > 0 ? 2 : 1);
                  advanceMission('slash', 1);
                }
              }

              for (let i = activeDrainers.length - 1; i >= 0; i--) {
                const dr = activeDrainers[i];
                if (Math.hypot(dr.x - s.player.x, dr.z - s.player.z) <= blastR) {
                  spawnParticles3D(dr.x, 1.1, dr.z, 0xc084fc, 20, 6.5);
                  scene.remove(dr.rig.root);
                  dr.rig.dispose();
                  activeDrainers.splice(i, 1);
                  s.stats.score += 75 * (s.fervorTimer > 0 ? 2 : 1);
                  s.burstCharge = Math.min(s.burstMaxCharge, s.burstCharge + 15);
                  advanceMission('slash', 1);
                }
              }

              if (activeBoss && Math.hypot(activeBoss.x - s.player.x, activeBoss.z - s.player.z) <= blastR + 1.2) {
                damageBoss(1);
              }

              for (const hb of activeHabits) {
                const dx = s.player.x - hb.x;
                const dz = s.player.z - hb.z;
                const dist = Math.hypot(dx, dz) || 1;
                if (dist <= blastR * 1.45) {
                  hb.vx = (dx / dist) * 11.0;
                  hb.vz = (dz / dist) * 11.0;
                }
              }
              syncHudNow();
            }
          }

          // Skill 3: Juramento Celestial Ultimate (Q)
          if (s.burstQueued) {
            s.burstQueued = false;
            if (s.burstCharge >= s.burstMaxCharge) {
              s.burstCharge = 0;
              s.fervorTimer = 8.0;
              s.stats.hp = Math.min(s.stats.maxHp, s.stats.hp + 1);
              s.player.invulnTimer = Math.max(s.player.invulnTimer, 1.5);
              s.player.swingTimer = 0.45;
              s.camera.shakeTimer = 0.4;
              s.camera.shakeMag = 0.48;

              burstBeam.position.set(s.player.x, 14, s.player.z);
              burstBeam.visible = true;
              burstBeamMat.opacity = 0.72;

              spawnShockwave3D(s.player.x, s.player.y, s.player.z, 0xfacc15, 16.5, 0.7);
              spawnParticles3D(s.player.x, s.player.y + 1.5, s.player.z, 0xd8f23a, 42, 11);
              gameAudio.playBurst();
              triggerCallout('¡Juramento Celestial! Fervor ×2 activo');

              for (const hz of activeHazards) {
                spawnParticles3D(hz.x, 1.0, hz.z, 0xfacc15, 12, 6);
                scene.remove(hz.rig.root);
                hz.rig.dispose();
                s.stats.score += 50;
                advanceMission('slash', 1);
              }
              activeHazards.length = 0;

              for (const dr of activeDrainers) {
                spawnParticles3D(dr.x, 1.1, dr.z, 0xc084fc, 14, 6);
                scene.remove(dr.rig.root);
                dr.rig.dispose();
                s.stats.score += 75;
                advanceMission('slash', 1);
              }
              activeDrainers.length = 0;

              if (activeBoss) {
                damageBoss(3);
              }
              syncHudNow();
            }
          }

          // Camera-relative Movement (enhanced by Real-World Discipline & Wind Orb buffs)
          let inX = s.joyInput.x;
          let inY = s.joyInput.y;
          if (s.keysHeld.has('w') || s.keysHeld.has('arrowup')) inY += 1;
          if (s.keysHeld.has('s') || s.keysHeld.has('arrowdown')) inY -= 1;
          if (s.keysHeld.has('a') || s.keysHeld.has('arrowleft')) inX -= 1;
          if (s.keysHeld.has('d') || s.keysHeld.has('arrowright')) inX += 1;

          const baseSpeed =
            8.8 *
            (realBuffsRef.current.hasFocusBuff ? 1.12 : 1) *
            (s.speedBoostTimer > 0 ? 1.35 : 1);
          if (s.player.dashTimer <= 0) {
            if (Math.hypot(inX, inY) > 0.08) {
              s.tapTarget = null;
              _forward.set(-Math.sin(s.camera.yaw), 0, -Math.cos(s.camera.yaw));
              _right.set(Math.cos(s.camera.yaw), 0, -Math.sin(s.camera.yaw));
              _moveDir
                .set(0, 0, 0)
                .addScaledVector(_forward, inY)
                .addScaledVector(_right, inX);
              if (_moveDir.lengthSq() > 0.001) _moveDir.normalize();
              s.player.vx = THREE.MathUtils.damp(
                s.player.vx,
                _moveDir.x * baseSpeed,
                14,
                dt
              );
              s.player.vz = THREE.MathUtils.damp(
                s.player.vz,
                _moveDir.z * baseSpeed,
                14,
                dt
              );
            } else if (s.tapTarget) {
              const dx = s.tapTarget.x - s.player.x;
              const dz = s.tapTarget.z - s.player.z;
              const dist = Math.hypot(dx, dz);
              if (dist > 0.45) {
                const factor = Math.min(1, dist / 1.5);
                s.player.vx = THREE.MathUtils.damp(
                  s.player.vx,
                  (dx / dist) * baseSpeed * factor,
                  14,
                  dt
                );
                s.player.vz = THREE.MathUtils.damp(
                  s.player.vz,
                  (dz / dist) * baseSpeed * factor,
                  14,
                  dt
                );
              } else {
                s.tapTarget = null;
                s.player.vx = THREE.MathUtils.damp(s.player.vx, 0, 14, dt);
                s.player.vz = THREE.MathUtils.damp(s.player.vz, 0, 14, dt);
              }
            } else {
              s.player.vx = THREE.MathUtils.damp(s.player.vx, 0, 14, dt);
              s.player.vz = THREE.MathUtils.damp(s.player.vz, 0, 14, dt);
            }
          }

          s.player.x += s.player.vx * dt;
          s.player.z += s.player.vz * dt;

          const distFromCenter = Math.hypot(s.player.x, s.player.z);
          if (distFromCenter > ARENA_RADIUS - 0.65) {
            const clampScale = (ARENA_RADIUS - 0.65) / distFromCenter;
            s.player.x *= clampScale;
            s.player.z *= clampScale;
          }
          s.player.y = THREE.MathUtils.damp(
            s.player.y,
            groundHeightAt(s.player.x, s.player.z),
            20,
            dt
          );

          // Spawners
          s.spawnHabitTimer -= dt;
          if (s.spawnHabitTimer <= 0 && activeHabits.length < 7) {
            spawnHabitShard();
            const baseInterval = difficultyRef.current === 'implacable' ? 1.55 : 2.0;
            s.spawnHabitTimer = Math.max(0.85, baseInterval - s.stats.day * 0.05);
          }

          s.spawnHazardTimer -= dt;
          if (s.spawnHazardTimer <= 0 && activeHazards.length < 7) {
            spawnDistractionSpecter();
            const baseHz = difficultyRef.current === 'implacable' ? 1.75 : 2.4;
            s.spawnHazardTimer = Math.max(0.9, baseHz - s.stats.day * 0.08);
          }

          if (s.stats.day >= 3) {
            s.spawnDrainTimer -= dt;
            if (s.spawnDrainTimer <= 0 && activeDrainers.length < 2) {
              spawnDrainSpecter();
              s.spawnDrainTimer = difficultyRef.current === 'implacable' ? 6.2 : 8.2;
            }
          }

          s.spawnOrbTimer -= dt;
          if (s.spawnOrbTimer <= 0 && activeOrbs.length < 2) {
            spawnBoostOrb();
            s.spawnOrbTimer = 11.5;
          }

          // Update Boost Orbs (Imán / Viento)
          for (let i = activeOrbs.length - 1; i >= 0; i--) {
            const orb = activeOrbs[i];
            orb.life -= dt;
            orb.rig.core.rotation.y += dt * 2.2;
            orb.rig.core.position.y = 1.15 + Math.sin(elapsed * 3.4 + orb.phase) * 0.16;
            orb.rig.ring.rotation.z -= dt * 1.9;
            orb.rig.ring.rotation.x = Math.cos(elapsed * 2.0 + orb.phase) * 0.45;

            if (Math.hypot(orb.x - s.player.x, orb.z - s.player.z) <= 1.55) {
              if (orb.kind === 'magnet') {
                s.magnetTimer = 7.0;
                spawnParticles3D(orb.x, 1.2, orb.z, 0xc084fc, 22, 6.5);
                spawnShockwave3D(orb.x, 0, orb.z, 0xc084fc, 3.2, 0.35);
                triggerCallout('¡Imán de Hábitos activo (7s)!');
              } else {
                s.speedBoostTimer = 7.0;
                spawnParticles3D(orb.x, 1.2, orb.z, 0x38bdf8, 22, 6.5);
                spawnShockwave3D(orb.x, 0, orb.z, 0x38bdf8, 3.2, 0.35);
                triggerCallout('¡Viento Celestial activo (7s)!');
              }
              gameAudio.playOrbPickup();
              scene.remove(orb.rig.root);
              orb.rig.dispose();
              activeOrbs.splice(i, 1);
              syncHudNow();
              continue;
            }

            if (orb.life <= 0) {
              scene.remove(orb.rig.root);
              orb.rig.dispose();
              activeOrbs.splice(i, 1);
            }
          }

          // Update Habit Shards (with Magnet Pull if active!)
          for (let i = activeHabits.length - 1; i >= 0; i--) {
            const hb = activeHabits[i];
            if (s.magnetTimer > 0) {
              const dx = s.player.x - hb.x;
              const dz = s.player.z - hb.z;
              const d = Math.hypot(dx, dz) || 1;
              if (d <= 12.5) {
                hb.vx = THREE.MathUtils.damp(hb.vx, (dx / d) * 10.5, 8, dt);
                hb.vz = THREE.MathUtils.damp(hb.vz, (dz / d) * 10.5, 8, dt);
              }
            }

            hb.x += hb.vx * dt;
            hb.z += hb.vz * dt;
            const r = Math.hypot(hb.x, hb.z);
            if (r > ARENA_RADIUS - 1.2) {
              const nx = hb.x / r;
              const nz = hb.z / r;
              const dot = hb.vx * nx + hb.vz * nz;
              if (dot > 0) {
                hb.vx -= 2 * dot * nx;
                hb.vz -= 2 * dot * nz;
              }
            }
            const isDrained = activeDrainers.some(
              (dr) => Math.hypot(dr.x - hb.x, dr.z - hb.z) <= 2.4
            );
            hb.life -= dt * (isDrained ? 2.2 : 1);

            const groundY = groundHeightAt(hb.x, hb.z);
            hb.rig.root.position.set(hb.x, groundY, hb.z);
            hb.rig.crystal.rotation.y += dt * 1.8;
            hb.rig.crystal.position.y = 1.08 + Math.sin(elapsed * 3.0 + hb.phase) * 0.14;
            hb.rig.outerRing.rotation.z += dt * 1.2;
            hb.rig.outerRing.rotation.x = Math.sin(elapsed * 1.5 + hb.phase) * 0.35;
            hb.rig.innerRing.rotation.y -= dt * 2.1;

            const lifeRatio = Math.max(0, hb.life / hb.maxLife);
            if (lifeRatio < 0.28 || isDrained) {
              const warnScale = 0.88 + Math.sin(elapsed * 16) * 0.14;
              hb.rig.crystal.scale.set(0.88 * warnScale, 1.38 * warnScale, 0.88 * warnScale);
            }

            const distToPlayer = Math.hypot(hb.x - s.player.x, hb.z - s.player.z);
            if (distToPlayer <= hb.radius + 0.7) {
              s.stats.streak += 1;
              s.stats.capturedCount += 1;
              if (s.stats.streak > s.stats.bestStreakInRun) {
                s.stats.bestStreakInRun = s.stats.streak;
              }
              s.comboTimer = 4.6;
              if (s.stats.streak % 5 === 0 && s.comboMult < 3) {
                s.comboMult += 1;
              }

              const mult = (s.fervorTimer > 0 ? 2 : 1) * s.comboMult;
              s.stats.score += (60 + s.stats.streak * 10) * mult;
              const burstStep = realBuffsRef.current.hasStreakBuff ? 17 : 14;
              s.burstCharge = Math.min(s.burstMaxCharge, s.burstCharge + burstStep);
              s.player.swingTimer = 0.22;

              const colInfo = getCategoryColor(hb.category, hb.isGraceBonus);
              if (hb.isGraceBonus) {
                s.stats.shields = Math.min(3, s.stats.shields + 1);
                gameAudio.playGracePickup();
                triggerCallout('¡Escudo de Gracia +1!');
              } else {
                if (s.stats.streak > 0 && s.stats.streak % 10 === 0 && s.stats.shields < 3) {
                  s.stats.shields += 1;
                }
                gameAudio.playCapture(s.stats.streak);
                advanceMission('capture', 1);
              }
              recordForjaProgress({
                totalCapturedDelta: 1,
                bestStreakInRun: s.stats.bestStreakInRun,
              });
              spawnParticles3D(hb.x, groundY + 1.0, hb.z, colInfo.three, 18, 6.5);
              spawnShockwave3D(hb.x, groundY, hb.z, colInfo.three, 2.2, 0.32);

              scene.remove(hb.rig.root);
              hb.rig.dispose();
              activeHabits.splice(i, 1);
              syncHudNow();
              continue;
            }

            if (hb.life <= 0) {
              scene.remove(hb.rig.root);
              hb.rig.dispose();
              activeHabits.splice(i, 1);
              if (!hb.isGraceBonus) {
                applyDamage('missed');
              }
            }
          }

          // Update Distraction Specters
          for (let i = activeHazards.length - 1; i >= 0; i--) {
            const hz = activeHazards[i];
            if (hz.windup > 0) {
              hz.windup -= dt;
              const pct = 1 - Math.max(0, hz.windup / hz.maxWindup);
              hz.rig.telegraphRing.scale.setScalar(0.5 + pct * 0.9);
              hz.rig.body.rotation.y += dt * 4.5;
              if (hz.windup <= 0 && !hz.dashed) {
                hz.dashed = true;
                hz.rig.telegraphRing.visible = false;
                const dx = s.player.x - hz.x;
                const dz = s.player.z - hz.z;
                const len = Math.hypot(dx, dz) || 1;
                const dashSpeed =
                  (difficultyRef.current === 'implacable' ? 10.2 : 8.0) +
                  Math.min(4.8, s.stats.day * 0.36);
                hz.vx = (dx / len) * dashSpeed;
                hz.vz = (dz / len) * dashSpeed;
              }
            } else {
              hz.x += hz.vx * dt;
              hz.z += hz.vz * dt;
              hz.rig.body.rotation.y += dt * 6.5;
            }

            hz.rig.root.position.set(hz.x, groundHeightAt(hz.x, hz.z), hz.z);
            hz.rig.body.position.y = 1.05 + Math.sin(elapsed * 4 + i) * 0.12;

            if (Math.hypot(hz.x, hz.z) > ARENA_RADIUS + 4.5) {
              scene.remove(hz.rig.root);
              hz.rig.dispose();
              activeHazards.splice(i, 1);
              continue;
            }

            const dist = Math.hypot(hz.x - s.player.x, hz.z - s.player.z);
            if (hz.dashed && dist <= hz.radius + 0.5) {
              scene.remove(hz.rig.root);
              hz.rig.dispose();
              activeHazards.splice(i, 1);
              applyDamage('hazard');
              continue;
            }
          }

          // Update Sombra Drenadora (chases nearest Habit Shard to drain it faster)
          for (let i = activeDrainers.length - 1; i >= 0; i--) {
            const dr = activeDrainers[i];
            let targetHabit: HabitNode3D | null = null;
            let bestDist = Infinity;
            for (const hb of activeHabits) {
              const d = Math.hypot(hb.x - dr.x, hb.z - dr.z);
              if (d < bestDist) {
                bestDist = d;
                targetHabit = hb;
              }
            }

            if (targetHabit && bestDist > 1.2) {
              const dx = targetHabit.x - dr.x;
              const dz = targetHabit.z - dr.z;
              const speed = difficultyRef.current === 'implacable' ? 3.5 : 2.85;
              dr.x += (dx / bestDist) * speed * dt;
              dr.z += (dz / bestDist) * speed * dt;
            } else if (!targetHabit) {
              const orbitA = elapsed * 0.7 + dr.phase;
              const tx = Math.cos(orbitA) * 5.5;
              const tz = Math.sin(orbitA) * 5.5;
              dr.x = THREE.MathUtils.damp(dr.x, tx, 2.2, dt);
              dr.z = THREE.MathUtils.damp(dr.z, tz, 2.2, dt);
            }

            dr.rig.root.position.set(dr.x, groundHeightAt(dr.x, dr.z), dr.z);
            dr.rig.update(elapsed + dr.phase);

            if (Math.hypot(dr.x - s.player.x, dr.z - s.player.z) <= dr.radius + 0.45) {
              scene.remove(dr.rig.root);
              dr.rig.dispose();
              activeDrainers.splice(i, 1);
              applyDamage('hazard');
              continue;
            }
          }

          // Update Boss Titan Specter
          if (activeBoss) {
            const b = activeBoss;
            const dx = s.player.x - b.x;
            const dz = s.player.z - b.z;
            const dist = Math.hypot(dx, dz) || 1;
            const chaseSpeed = 2.4 + Math.min(1.6, s.stats.day * 0.08);

            if (b.windup > 0) {
              b.windup -= dt;
              const pct = 1 - Math.max(0, b.windup / 1.15);
              b.rig.telegraphRing.visible = true;
              b.rig.telegraphRing.scale.setScalar(0.8 + pct * 2.1);
              b.rig.body.rotation.y += dt * 6.0;
              if (b.windup <= 0) {
                b.rig.telegraphRing.visible = false;
                spawnShockwave3D(b.x, 0, b.z, 0xf43f5e, 5.4, 0.45);
                if (dist <= 5.1) {
                  applyDamage('hazard');
                }
                b.attackTimer = 3.8;
              }
            } else {
              b.rig.telegraphRing.visible = false;
              b.x += (dx / dist) * chaseSpeed * dt;
              b.z += (dz / dist) * chaseSpeed * dt;
              b.rig.body.rotation.y += dt * 2.1;
              b.attackTimer -= dt;
              if (b.attackTimer <= 0) {
                b.windup = 1.15;
              }
            }

            if (b.hitFlash > 0) {
              b.hitFlash = Math.max(0, b.hitFlash - dt);
              const sFlash = 1 + b.hitFlash * 0.6;
              b.rig.body.scale.setScalar(sFlash);
            } else {
              b.rig.body.scale.setScalar(1);
            }

            b.rig.root.position.set(b.x, groundHeightAt(b.x, b.z), b.z);
            b.rig.body.position.y = 1.6 + Math.sin(elapsed * 2.8) * 0.16;
            b.rig.haloRing.rotation.z += dt * 1.8;

            if (dist <= b.radius + 0.55) {
              applyDamage('hazard');
            }
          }

          s.hudSyncAcc += dt;
          if (s.hudSyncAcc >= 0.12) {
            s.hudSyncAcc = 0;
            updateRadarSnapshot();
            syncHudNow();
          }
        }
      }

      // Fade Slash Crescent Arc & Burst Beam
      const slashMat = heroBuilt.rig.slashArc.material as THREE.MeshBasicMaterial;
      if (heroBuilt.rig.slashArc.visible) {
        slashMat.opacity = Math.max(0, slashMat.opacity - dt * 4.2);
        heroBuilt.rig.slashArc.rotation.z += dt * 8;
        if (slashMat.opacity <= 0.02) heroBuilt.rig.slashArc.visible = false;
      }

      if (burstBeam.visible) {
        burstBeamMat.opacity = Math.max(0, burstBeamMat.opacity - dt * 1.1);
        burstBeam.rotation.y += dt * 3;
        if (burstBeamMat.opacity <= 0.01) burstBeam.visible = false;
      }

      // Update Shockwaves
      for (let i = activeShockwaves.length - 1; i >= 0; i--) {
        const sw = activeShockwaves[i];
        sw.life -= dt;
        const t = 1 - Math.max(0, sw.life / sw.maxLife);
        const curScale = THREE.MathUtils.lerp(0.4, sw.maxScale, 1 - Math.pow(1 - t, 3));
        sw.mesh.scale.setScalar(curScale);
        (sw.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - t) * 0.88);
        if (sw.life <= 0) {
          scene.remove(sw.mesh);
          (sw.mesh.material as THREE.Material).dispose();
          activeShockwaves.splice(i, 1);
        }
      }

      // Update Pooled InstancedMesh Particles
      for (let i = 0; i < particlePool.length; i++) {
        const p = particlePool[i];
        if (p.active) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vy -= 11.5 * dt;
          p.life -= dt;
          if (p.life <= 0 || p.y < -0.5) {
            p.active = false;
            _dummy.position.set(0, -100, 0);
            _dummy.scale.setScalar(0.001);
          } else {
            const fade = Math.max(0.05, p.life / p.maxLife);
            _dummy.position.set(p.x, p.y, p.z);
            _dummy.rotation.set(elapsed * 4 + i, elapsed * 3, 0);
            _dummy.scale.setScalar(p.scale * fade);
            particleInst.setColorAt(i, p.color);
          }
        } else {
          _dummy.position.set(0, -100, 0);
          _dummy.scale.setScalar(0.001);
        }
        _dummy.updateMatrix();
        particleInst.setMatrixAt(i, _dummy.matrix);
      }
      particleInst.instanceMatrix.needsUpdate = true;
      if (particleInst.instanceColor) particleInst.instanceColor.needsUpdate = true;

      // Animate Hero Articulation
      const hero = heroBuilt.rig;
      const speed = Math.hypot(s.player.vx, s.player.vz);
      if (speed > 0.35 && gameStateRef.current === 'PLAYING') {
        const targetYaw = Math.atan2(s.player.vx, s.player.vz);
        let diff = targetYaw - s.player.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        s.player.yaw += diff * Math.min(1, dt * 14);
        s.player.walkCycle += dt * (speed * 1.45);
      } else {
        s.player.walkCycle += dt * 1.8;
      }

      hero.root.position.set(s.player.x, s.player.y, s.player.z);
      hero.root.rotation.y = s.player.yaw;

      const movingRatio = Math.min(1, speed / 8.5);
      const stride = Math.sin(s.player.walkCycle) * 0.65 * movingRatio;
      hero.leftLeg.rotation.x = stride;
      hero.rightLeg.rotation.x = -stride;
      hero.leftArm.rotation.x = -stride * 0.7;

      if (s.player.swingTimer > 0) {
        const swingProg = 1 - s.player.swingTimer / 0.3;
        hero.rightArm.rotation.x = -1.6 + swingProg * 2.4;
        hero.rightArm.rotation.z = 0.55 - swingProg * 0.8;
      } else {
        hero.rightArm.rotation.x = stride * 0.65;
        hero.rightArm.rotation.z = THREE.MathUtils.damp(hero.rightArm.rotation.z, 0, 12, dt);
      }

      hero.bodyPivot.rotation.x = THREE.MathUtils.damp(
        hero.bodyPivot.rotation.x,
        movingRatio * 0.16,
        10,
        dt
      );
      hero.bodyPivot.position.y = Math.abs(Math.sin(s.player.walkCycle)) * 0.06 * movingRatio;
      hero.scarfLeft.rotation.x =
        0.35 + movingRatio * 0.72 + Math.sin(elapsed * 7) * (0.08 + movingRatio * 0.12);
      hero.scarfRight.rotation.x =
        0.35 + movingRatio * 0.72 + Math.cos(elapsed * 7.4) * (0.08 + movingRatio * 0.12);
      hero.visionOrb.rotation.y += dt * 2.2;

      const visibleNow =
        s.player.invulnTimer <= 0 || Math.floor(elapsed * 18) % 2 === 0;
      hero.bodyPivot.visible = visibleNow;

      for (let i = 0; i < hero.shieldRings.length; i++) {
        const ring = hero.shieldRings[i];
        ring.visible = i < s.stats.shields && gameStateRef.current !== 'TITLE_MENU';
        ring.rotation.z += dt * (1.2 + i * 0.4);
      }
      hero.auraRing.visible = gameStateRef.current === 'PLAYING';
      hero.auraRing.rotation.z -= dt * 0.8;

      // Animate Floating Seelie Companion ("Chispa")
      const seelie = seelieBuilt.rig;
      const seelieOrbit = elapsed * 1.45;
      const targetSx = s.player.x + Math.cos(seelieOrbit) * 1.35;
      const targetSz = s.player.z + Math.sin(seelieOrbit) * 1.35;
      const targetSy = s.player.y + 1.85 + Math.sin(elapsed * 3.2) * 0.18;
      seelie.root.position.x = THREE.MathUtils.damp(seelie.root.position.x, targetSx, 7, dt);
      seelie.root.position.y = THREE.MathUtils.damp(seelie.root.position.y, targetSy, 7, dt);
      seelie.root.position.z = THREE.MathUtils.damp(seelie.root.position.z, targetSz, 7, dt);
      seelie.root.rotation.y = -seelieOrbit;
      seelie.halo.rotation.z += dt * 2.5;
      seelie.wingLeft.rotation.z = Math.PI * 0.62 + Math.sin(elapsed * 9) * 0.2;
      seelie.wingRight.rotation.z = -Math.PI * 0.62 - Math.sin(elapsed * 9) * 0.2;

      // Mobile-aware Responsive Camera Rig
      if (gameStateRef.current === 'TITLE_MENU') {
        const orbitAngle = elapsed * 0.16;
        const titleRadius = curAspect < 0.85 ? 20.5 : 15.5;
        _camDesired.set(
          Math.sin(orbitAngle) * titleRadius,
          curAspect < 0.85 ? 8.5 : 7.0 + Math.sin(elapsed * 0.4) * 0.7,
          Math.cos(orbitAngle) * titleRadius
        );
        camera.position.lerp(_camDesired, Math.min(1, dt * 4));
        camera.lookAt(0, 2.2, 0);
      } else {
        if (s.camera.snapTimer > 0) {
          s.camera.snapTimer = Math.max(0, s.camera.snapTimer - dt);
          let diff = s.camera.snapTargetYaw - s.camera.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          s.camera.yaw += diff * Math.min(1, dt * 16);
        }

        const portraitBoost = curAspect < 0.85 ? 3.2 : 0;
        const effectiveDist = s.camera.dist + portraitBoost;
        const presetPitch =
          cameraPresetRef.current === 'alta'
            ? Math.max(s.camera.pitch, 0.94)
            : curAspect < 0.85
            ? Math.max(s.camera.pitch, 0.68)
            : s.camera.pitch;
        const horizDist = Math.cos(presetPitch) * effectiveDist;
        const vertHeight = Math.sin(presetPitch) * effectiveDist + 1.4;

        _camDesired.set(
          s.player.x + Math.sin(s.camera.yaw) * horizDist,
          s.player.y + vertHeight,
          s.player.z + Math.cos(s.camera.yaw) * horizDist
        );

        if (s.camera.shakeTimer > 0) {
          const mag = s.camera.shakeMag * (s.camera.shakeTimer / 0.35);
          _camDesired.x += (Math.random() - 0.5) * mag;
          _camDesired.y += (Math.random() - 0.5) * mag * 0.7;
        }

        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesired.x, 10, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesired.y, 10, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesired.z, 10, dt);

        _camLookTarget.set(s.player.x, s.player.y + 1.1, s.player.z);
        camera.lookAt(_camLookTarget);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.clearTimeout(calloutTimerRef.current);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);

      clearDynamicEntities();
      skyGeo.dispose();
      burstBeamGeo.dispose();
      burstBeamMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      shockwaveGeo.dispose();
      heroBuilt.dispose();
      seelieRigRef.current = null;
      seelieBuilt.dispose();
      sanctuary.disposeGeometries();
      matRegistry.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [recordForjaProgress, syncHudNow, triggerCallout]);

  // Smooth Touch Virtual Joystick with live visual thumb indicator
  const handleJoyPointer = (e: React.PointerEvent<HTMLDivElement>, active: boolean) => {
    if (!active) {
      simRef.current.joyInput = { x: 0, y: 0 };
      if (joyThumbRef.current) {
        joyThumbRef.current.style.transform = 'translate(0px, 0px)';
      }
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const maxR = r.width / 2 - 12;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR && dist > 0) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    if (joyThumbRef.current) {
      joyThumbRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    simRef.current.joyInput = {
      x: THREE.MathUtils.clamp(dx / maxR, -1, 1),
      y: THREE.MathUtils.clamp(-dy / maxR, -1, 1),
    };
  };

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-screen bg-[#3898ec] text-white select-none overflow-hidden">
      {/* Isolated Full-Viewport WebGL Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Active Gameplay Perimeter HUD (Mobile-optimized, zero center occlusion, safe-area aware) */}
      {gameState !== 'TITLE_MENU' && (
        <div className="pointer-events-none fixed inset-0 flex flex-col justify-between p-2.5 sm:p-5 pt-[max(0.65rem,env(safe-area-inset-top))] pb-[max(0.65rem,env(safe-area-inset-bottom))]">
          {/* Top Bar */}
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              {/* Top-Left Compact Status Pill */}
              <div className="bg-[#0b111c]/88 border border-[#243247] rounded-2xl px-2.5 sm:px-3.5 py-2 flex items-center gap-2 sm:gap-3 shadow-lg">
                <div>
                  <span className="block text-[8px] sm:text-[9px] uppercase tracking-wider text-[#94a3b8]">
                    Día
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white tabular-nums">
                    {hud.day}
                  </span>
                </div>
                <span className="text-[#2c3b52]">|</span>
                <div className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-[#d8f23a]" />
                  <span className="text-xs sm:text-sm font-bold text-[#d8f23a] tabular-nums">
                    {hud.streak}d
                  </span>
                  {hud.comboMult > 1 && (
                    <span className="text-[10px] font-extrabold bg-[#d8f23a] text-black px-1 py-0.5 rounded">
                      ×{hud.comboMult}
                    </span>
                  )}
                </div>
                <span className="text-[#2c3b52]">|</span>
                <div>
                  <span className="block text-[8px] sm:text-[9px] uppercase tracking-wider text-[#94a3b8]">
                    Puntos
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white tabular-nums">
                    {hud.score}
                    {hud.fervorTimer > 0 && (
                      <span className="ml-1 text-[10px] text-[#facc15] font-extrabold">×2</span>
                    )}
                  </span>
                </div>
                <span className="text-[#2c3b52]">|</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5" title="Enfoque">
                    {Array.from({ length: hud.maxHp }).map((_, idx) => (
                      <span
                        key={idx}
                        className={`w-2 sm:w-2.5 h-2 rounded-sm ${
                          idx < hud.hp ? 'bg-[#d8f23a]' : 'bg-[#222d3f]'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-0.5 bg-[#1e1b0d] border border-[#524518] px-1.5 py-0.5 rounded-md">
                    <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#facc15]" />
                    <span className="text-[10px] sm:text-xs font-bold text-[#facc15] tabular-nums">
                      {hud.shields}
                    </span>
                  </div>
                </div>
              </div>

              {/* Top-Right: Center Camera, Joystick Toggle, Camera Preset, Audio, Pause */}
              <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={centerCamera}
                  title="Centrar cámara detrás del viajero"
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-2 rounded-xl bg-[#0b111c]/88 border border-[#243247] hover:border-[#d8f23a] text-[#e2e8f0] text-xs font-medium cursor-pointer"
                >
                  <Crosshair className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span className="hidden lg:inline">Centrar cámara</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTouchJoystick((v) => !v)}
                  title="Mostrar u ocultar joystick táctil"
                  className={`flex items-center gap-1 px-2 py-2 rounded-xl border text-xs font-medium cursor-pointer ${
                    showTouchJoystick
                      ? 'bg-[#192408]/90 border-[#d8f23a] text-[#d8f23a]'
                      : 'bg-[#0b111c]/88 border-[#243247] text-[#94a3b8] hover:text-white'
                  }`}
                >
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Joystick</span>
                </button>
                <button
                  type="button"
                  onClick={toggleCameraPreset}
                  title="Alternar vista de cámara"
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-2 rounded-xl bg-[#0b111c]/88 border border-[#243247] hover:border-[#d8f23a] text-[#e2e8f0] text-xs font-medium cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-[#d8f23a]" />
                  <span className="hidden md:inline">
                    {cameraPreset === 'rpg' ? 'Vista RPG' : 'Vista Alta'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
                  className="p-2 rounded-xl bg-[#0b111c]/88 border border-[#243247] hover:border-[#d8f23a] text-[#e2e8f0] cursor-pointer"
                >
                  {muted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-[#d8f23a]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={togglePause}
                  aria-label="Pausar partida"
                  className="p-2 rounded-xl bg-[#0b111c]/88 border border-[#243247] hover:border-[#d8f23a] text-white cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Boss HP Bar + Mini-Mission + Buffs + Mini-Radar */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="inline-flex items-center gap-1.5 bg-[#0b111c]/85 border border-[#243247] rounded-xl px-2.5 py-1 text-[10px] sm:text-[11px] text-[#cbd5e1] tabular-nums">
                    <Target className="w-3 h-3 text-[#d8f23a] shrink-0" />
                    <span>{hud.mission.label}:</span>
                    <span className="text-[#d8f23a] font-bold">
                      {hud.mission.progress}/{hud.mission.goal}
                    </span>
                  </div>

                  {hud.magnetTimer > 0 && (
                    <div className="inline-flex items-center gap-1 bg-[#221036]/90 border border-[#c084fc] rounded-xl px-2 py-1 text-[10px] font-bold text-[#e9d5ff] tabular-nums">
                      <Magnet className="w-3 h-3 text-[#c084fc]" />
                      <span>{hud.magnetTimer.toFixed(0)}s</span>
                    </div>
                  )}

                  {hud.speedBoostTimer > 0 && (
                    <div className="inline-flex items-center gap-1 bg-[#0b2338]/90 border border-[#38bdf8] rounded-xl px-2 py-1 text-[10px] font-bold text-[#bae6fd] tabular-nums">
                      <Wind className="w-3 h-3 text-[#38bdf8]" />
                      <span>{hud.speedBoostTimer.toFixed(0)}s</span>
                    </div>
                  )}

                  <div className="hidden sm:inline-flex items-center gap-1 bg-[#0b111c]/85 border border-[#243247] rounded-xl px-2 py-1 text-[10px] text-[#94a3b8] tabular-nums">
                    <Sparkles
                      className={`w-3 h-3 ${
                        hud.shrineCooldown <= 0 ? 'text-[#38bdf8]' : 'text-[#64748b]'
                      }`}
                    />
                    <span>
                      {hud.shrineCooldown <= 0
                        ? 'Altar listo'
                        : `Altar ${Math.ceil(hud.shrineCooldown)}s`}
                    </span>
                  </div>
                </div>

                {hud.boss && (
                  <div className="bg-[#1b080e]/92 border border-[#f43f5e] rounded-xl px-3 py-1.5 w-52 sm:w-64 shadow-lg">
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#fecdd3] mb-1">
                      <span className="inline-flex items-center gap-1">
                        <Skull className="w-3 h-3 text-[#f43f5e]" />
                        {hud.boss.label}
                      </span>
                      <span className="tabular-nums">
                        {hud.boss.hp}/{hud.boss.maxHp}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#3b0b18] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#f43f5e] transition-all duration-150"
                        style={{
                          width: `${Math.round((hud.boss.hp / hud.boss.maxHp) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2">
                {callout && (
                  <div className="bg-[#141d08]/95 border border-[#d8f23a] text-[#d8f23a] text-[11px] font-bold px-3 py-1 rounded-xl shadow-md">
                    {callout}
                  </div>
                )}

                {/* Compact Circular Mini-Radar */}
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#0b111c]/88 border border-[#243247] shadow-lg shrink-0 relative overflow-hidden"
                  title="Radar de la isla"
                >
                  <svg viewBox="-1.12 -1.12 2.24 2.24" className="w-full h-full">
                    <circle cx={0} cy={0} r={1} fill="none" stroke="#243247" strokeWidth={0.04} />
                    <circle cx={0} cy={0} r={0.5} fill="none" stroke="#1e293b" strokeWidth={0.03} />
                    {hud.radarBlips.map((b, idx) => {
                      const fill =
                        b.kind === 'habit'
                          ? '#d8f23a'
                          : b.kind === 'hazard'
                          ? '#ef4444'
                          : b.kind === 'drainer'
                          ? '#c084fc'
                          : b.kind === 'orb'
                          ? '#c084fc'
                          : b.kind === 'boss'
                          ? '#f43f5e'
                          : '#38bdf8';
                      const r = b.kind === 'boss' ? 0.14 : b.kind === 'shrine' || b.kind === 'drainer' ? 0.1 : 0.085;
                      return <circle key={idx} cx={b.x} cy={b.z} r={r} fill={fill} />;
                    })}
                    <circle
                      cx={hud.playerRadar.x}
                      cy={hud.playerRadar.z}
                      r={0.12}
                      fill="#ffffff"
                      stroke="#d8f23a"
                      strokeWidth={0.05}
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Touch Thumb Stick on Left + Genshin Action Wheel on Right */}
          <div className="flex items-end justify-between gap-2">
            {/* Left: Smooth Visual Touch Joystick (Mobile + Tablets via toggle) / Compact Hint on Desktop */}
            <div className="flex flex-col gap-1.5">
              {showTouchJoystick && (
                <div
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    handleJoyPointer(e, true);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons > 0) handleJoyPointer(e, true);
                  }}
                  onPointerUp={(e) => handleJoyPointer(e, false)}
                  onPointerCancel={(e) => handleJoyPointer(e, false)}
                  className="pointer-events-auto relative w-24 h-24 rounded-full bg-[#0b111c]/70 border-2 border-white/25 flex items-center justify-center touch-none shadow-lg"
                  aria-label="Control táctil de movimiento"
                >
                  <div
                    ref={joyThumbRef}
                    className="w-9 h-9 rounded-full bg-[#d8f23a] border-2 border-black shadow-md transition-transform duration-75"
                  />
                </div>
              )}

              <div className="hidden md:flex items-center gap-2 bg-[#0b111c]/88 border border-[#243247] rounded-xl px-3 py-1.5 text-[11px] text-[#cbd5e1] tabular-nums">
                <span>
                  Fragmentos: <strong className="text-white">{hud.capturedCount}</strong>
                </span>
                <span className="text-[#334155]">·</span>
                <span className="text-[#d8f23a] font-semibold">{hud.comboLabel}</span>
                <span className="text-[#334155]">·</span>
                <span className="text-[#94a3b8]">
                  WASD Mover · Arrastrar Cámara · F Espada · E Estallido · Q Definitiva
                </span>
              </div>
            </div>

            {/* Right: Mobile-ergonomic Genshin Action Wheel (Slash, Dash, Skill, Burst) */}
            <div className="pointer-events-auto flex items-end gap-2 sm:gap-2.5">
              {/* Dash (Shift) */}
              <button
                type="button"
                onClick={triggerDash}
                disabled={hud.dashCooldownPct < 100}
                title="Esquiva Elemental (Shift)"
                className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full border-2 flex flex-col items-center justify-center active:scale-95 cursor-pointer shadow-lg ${
                  hud.dashCooldownPct >= 100
                    ? 'bg-[#0c1d2e]/95 border-[#38bdf8] text-[#7dd3fc]'
                    : 'bg-[#0b111c]/85 border-[#243247] text-[#64748b]'
                }`}
              >
                <Wind className="w-4 h-4" />
                <span className="text-[8px] sm:text-[9px] font-bold tabular-nums">
                  {hud.dashCooldownPct >= 100 ? 'ESQ' : `${hud.dashCooldownPct}%`}
                </span>
              </button>

              {/* Elemental Skill (E / Espacio) */}
              <button
                type="button"
                onClick={triggerPulse}
                disabled={hud.pulseCooldownPct < 100}
                title="Estallido de Enfoque (E o Espacio)"
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex flex-col items-center justify-center active:scale-95 cursor-pointer shadow-lg ${
                  hud.pulseCooldownPct >= 100
                    ? 'bg-[#192408]/95 border-[#d8f23a] text-[#d8f23a]'
                    : 'bg-[#0b111c]/85 border-[#243247] text-[#64748b]'
                }`}
              >
                <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[8px] sm:text-[9px] font-bold tabular-nums">
                  {hud.pulseCooldownPct >= 100 ? 'ONDA' : `${hud.pulseCooldownPct}%`}
                </span>
              </button>

              {/* Basic Sword Slash (F / J) - Hits Specters & Red-White Targets! */}
              <button
                type="button"
                onClick={triggerSlash}
                disabled={hud.slashCooldownPct < 100}
                title="Corte de Espada (F)"
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 flex flex-col items-center justify-center active:scale-95 cursor-pointer shadow-lg ${
                  hud.slashCooldownPct >= 100
                    ? 'bg-[#182234]/95 border-[#f8fafc] text-white'
                    : 'bg-[#0b111c]/85 border-[#243247] text-[#64748b]'
                }`}
              >
                <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-[#d8f23a]" />
                <span className="text-[8px] sm:text-[9px] font-bold">CORTE</span>
              </button>

              {/* Elemental Burst (Q) */}
              <button
                type="button"
                onClick={triggerBurst}
                disabled={hud.burstChargePct < 100}
                title="Juramento Celestial (Q)"
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 flex flex-col items-center justify-center active:scale-95 cursor-pointer shadow-lg ${
                  hud.burstChargePct >= 100
                    ? 'bg-[#d8f23a] border-[#fef08a] text-black'
                    : 'bg-[#0b111c]/85 border-[#334155] text-[#cbd5e1]'
                }`}
              >
                <Sparkles className="w-5 h-5" />
                <span className="text-[8px] sm:text-[9px] font-extrabold tabular-nums">
                  {hud.burstChargePct >= 100 ? 'Q · ULT' : `${hud.burstChargePct}%`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-Safe Title Screen over live sunny Fantasy Island */}
      {gameState === 'TITLE_MENU' && (
        <div className="fixed inset-0 flex flex-col justify-between p-3.5 sm:p-8 pt-[max(0.9rem,env(safe-area-inset-top))] pb-[max(0.9rem,env(safe-area-inset-bottom))] overflow-y-auto pointer-events-none">
          <div className="flex items-center justify-between pointer-events-auto shrink-0">
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-2 bg-[#0b111c]/92 border border-[#243247] hover:border-[#d8f23a] text-white text-xs font-medium px-3.5 py-2 rounded-xl cursor-pointer shadow-md"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al Tablero</span>
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
              className="p-2 rounded-xl bg-[#0b111c]/92 border border-[#243247] hover:border-[#d8f23a] text-white cursor-pointer shadow-md"
            >
              {muted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#d8f23a]" />
              )}
            </button>
          </div>

          <div className="max-w-md mx-auto w-full my-auto py-3 text-center pointer-events-auto">
            <div className="bg-[#0b111c]/90 border border-[#28384f] rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl">
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#d8f23a] bg-[#161e09] border border-[#3a4d11] px-2.5 py-1 rounded-lg">
                  <Sparkles className="w-3 h-3" />
                  Isla del Juramento 3D
                </span>
                <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white">
                  FORJA DE RACHA
                </h1>
                <p className="text-xs sm:text-sm text-[#cbd5e1] leading-relaxed">
                  Reúne los <span className="text-[#d8f23a] font-semibold">cristales de tus hábitos</span>, golpea las dianas con tu espada y protege tu racha de las distracciones.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#121a28] border border-[#212e42] rounded-xl py-2 px-1.5">
                  <span className="block text-[9px] sm:text-[10px] uppercase text-[#94a3b8]">
                    Rutinas
                  </span>
                  <span className="text-sm font-bold text-white tabular-nums">
                    {entities.length}
                  </span>
                </div>
                <div className="bg-[#121a28] border border-[#212e42] rounded-xl py-2 px-1.5">
                  <span className="block text-[9px] sm:text-[10px] uppercase text-[#94a3b8]">
                    Escudos
                  </span>
                  <span className="text-sm font-bold text-[#facc15] tabular-nums">
                    {initialShields}
                  </span>
                </div>
                <div className="bg-[#121a28] border border-[#212e42] rounded-xl py-2 px-1.5">
                  <span className="block text-[9px] sm:text-[10px] uppercase text-[#94a3b8]">
                    Récord
                  </span>
                  <span className="text-sm font-bold text-[#d8f23a] tabular-nums">
                    {bestScore}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-[#121a28] p-1 rounded-xl border border-[#212e42]">
                <button
                  type="button"
                  onClick={() => setDifficulty('diario')}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    difficulty === 'diario'
                      ? 'bg-[#d8f23a] text-black'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  Modo Diario
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty('implacable')}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    difficulty === 'implacable'
                      ? 'bg-[#d8f23a] text-black'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  Implacable
                </button>
              </div>

              {/* Sword Style Unlock Selector */}
              <div className="space-y-1.5 text-left">
                <span className="block text-[10px] uppercase tracking-wider text-[#94a3b8]">
                  Estilo de espada
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectSwordStyle('volt')}
                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                      activeSwordStyle === 'volt'
                        ? 'bg-[#192408] border-[#d8f23a] text-[#d8f23a]'
                        : 'bg-[#121a28] border-[#212e42] text-[#cbd5e1]'
                    }`}
                  >
                    Filo Volt
                  </button>
                  <button
                    type="button"
                    disabled={!celesteUnlocked}
                    onClick={() => handleSelectSwordStyle('celeste')}
                    title={
                      celesteUnlocked
                        ? 'Desbloqueada'
                        : 'Desbloquea con racha 7d o 1000 pts'
                    }
                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold ${
                      !celesteUnlocked
                        ? 'bg-[#0f1622] border-[#1c2636] text-[#475569] cursor-not-allowed'
                        : activeSwordStyle === 'celeste'
                        ? 'bg-[#0c2338] border-[#38bdf8] text-[#7dd3fc] cursor-pointer'
                        : 'bg-[#121a28] border-[#212e42] text-[#cbd5e1] cursor-pointer'
                    }`}
                  >
                    {celesteUnlocked ? 'Hoja Celeste' : 'Celeste (7d)'}
                  </button>
                  <button
                    type="button"
                    disabled={!solarUnlocked}
                    onClick={() => handleSelectSwordStyle('solar')}
                    title={
                      solarUnlocked
                        ? 'Desbloqueada'
                        : 'Desbloquea con racha 30d o 3000 pts'
                    }
                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold ${
                      !solarUnlocked
                        ? 'bg-[#0f1622] border-[#1c2636] text-[#475569] cursor-not-allowed'
                        : activeSwordStyle === 'solar'
                        ? 'bg-[#281e06] border-[#facc15] text-[#fde047] cursor-pointer'
                        : 'bg-[#121a28] border-[#212e42] text-[#cbd5e1] cursor-pointer'
                    }`}
                  >
                    {solarUnlocked ? 'Espada Solar' : 'Solar (30d)'}
                  </button>
                </div>
              </div>

              {/* Seelie ("Chispa") Skin Selector */}
              <div className="space-y-1.5 text-left">
                <span className="block text-[10px] uppercase tracking-wider text-[#94a3b8]">
                  Aspecto de Chispa (Seelie)
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'celeste', label: 'Celeste', activeCls: 'bg-[#0c2338] border-[#38bdf8] text-[#7dd3fc]' },
                      { id: 'dorado', label: 'Dorado', activeCls: 'bg-[#281e06] border-[#facc15] text-[#fde047]' },
                      { id: 'amatista', label: 'Amatista', activeCls: 'bg-[#231036] border-[#c084fc] text-[#e9d5ff]' },
                    ] as const
                  ).map((skin) => (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => handleSelectSeelieSkin(skin.id)}
                      className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                        forjaProgress.seelieSkin === skin.id
                          ? skin.activeCls
                          : 'bg-[#121a28] border-[#212e42] text-[#cbd5e1]'
                      }`}
                    >
                      {skin.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Island Achievements Summary */}
              <div className="bg-[#121a28] border border-[#212e42] rounded-xl p-2.5 text-left space-y-1.5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#94a3b8]">
                  <span className="inline-flex items-center gap-1 text-[#d8f23a] font-bold">
                    <Trophy className="w-3 h-3" />
                    Logros de la Isla
                  </span>
                  <span className="tabular-nums font-semibold text-white">
                    {forjaProgress.achievements.length}/{ISLAND_ACHIEVEMENTS.length} · {forjaProgress.bossesDefeated} Titanes
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ISLAND_ACHIEVEMENTS.map((ach) => {
                    const done = forjaProgress.achievements.includes(ach.id);
                    return (
                      <span
                        key={ach.id}
                        title={ach.hint}
                        className={`text-[10px] px-2 py-0.5 rounded-md border ${
                          done
                            ? 'bg-[#192408] border-[#4d6b14] text-[#d8f23a] font-semibold'
                            : 'bg-[#0b111c] border-[#1e293b] text-[#64748b]'
                        }`}
                      >
                        {ach.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {(hasFocusBuff || hasStreakBuff) && (
                <div className="text-[11px] text-[#cbd5e1] bg-[#121a28] border border-[#212e42] rounded-xl px-3 py-2 text-left space-y-0.5">
                  <span className="block text-[9px] uppercase tracking-wider text-[#d8f23a] font-bold">
                    Bonificaciones por tus hábitos reales
                  </span>
                  {hasFocusBuff && (
                    <span className="block text-[11px]">· +12% Velocidad (≥50% completado hoy)</span>
                  )}
                  {hasStreakBuff && (
                    <span className="block text-[11px]">· +20% Alcance y carga (racha ≥7d)</span>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={startGame}
                className="w-full py-3 rounded-xl bg-[#d8f23a] hover:bg-[#c8e22a] text-black font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Explorar la Isla</span>
              </button>
            </div>
          </div>

          <div className="text-center text-[10px] sm:text-[11px] text-white bg-[#0b111c]/85 border border-[#243247] rounded-xl py-1.5 px-3 self-center shrink-0">
            Joystick / WASD · Arrastra para cámara · Altar + Orbes + Titán cada 5 días · Consistencia:{' '}
            <span className="text-[#d8f23a] font-bold tabular-nums">
              {globalStats.consistencyPct}%
            </span>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {gameState === 'PAUSED' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm bg-[#0b111c] border border-[#243247] rounded-2xl p-6 text-center space-y-5 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Aventura en pausa</h2>
            <p className="text-xs text-[#94a3b8] tabular-nums">
              Día {hud.day} · Racha: {hud.streak}d · Puntos: {hud.score}
            </p>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={togglePause}
                className="w-full py-2.5 rounded-xl bg-[#d8f23a] hover:bg-[#c8e22a] text-black font-bold text-xs cursor-pointer"
              >
                Reanudar
              </button>
              <button
                type="button"
                onClick={startGame}
                className="w-full py-2.5 rounded-xl bg-[#131c2b] border border-[#243247] hover:border-white text-white font-semibold text-xs cursor-pointer"
              >
                Reiniciar Isla
              </button>
              <button
                type="button"
                onClick={onExit}
                className="w-full py-2.5 rounded-xl bg-transparent text-[#94a3b8] hover:text-white text-xs cursor-pointer"
              >
                Volver al Tablero
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Summary Modal + Real Habit Check-In */}
      {gameState === 'GAME_OVER' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-[#0b111c] border border-[#243247] rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl my-auto">
            <div className="text-center space-y-1.5">
              <div className="w-11 h-11 rounded-2xl bg-[#1a2209] border border-[#34420e] text-[#d8f23a] flex items-center justify-center mx-auto">
                <Award className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">Juramento Completado</h2>
              <p className="text-xs text-[#94a3b8]">
                Las distracciones quebraron tu concentración hoy, pero tu progreso queda forjado.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#121a28] border border-[#212e42] rounded-xl p-3">
                <span className="block text-[10px] uppercase text-[#94a3b8]">Puntuación</span>
                <span className="text-lg font-bold text-[#d8f23a] tabular-nums">
                  {hud.score}
                </span>
              </div>
              <div className="bg-[#121a28] border border-[#212e42] rounded-xl p-3">
                <span className="block text-[10px] uppercase text-[#94a3b8]">
                  Racha Máxima
                </span>
                <span className="text-lg font-bold text-white tabular-nums">
                  {hud.bestStreakInRun} días
                </span>
              </div>
              <div className="bg-[#121a28] border border-[#212e42] rounded-xl p-3">
                <span className="block text-[10px] uppercase text-[#94a3b8]">
                  Días Superados
                </span>
                <span className="text-base font-bold text-white tabular-nums">
                  Día {hud.day}
                </span>
              </div>
              <div className="bg-[#121a28] border border-[#212e42] rounded-xl p-3">
                <span className="block text-[10px] uppercase text-[#94a3b8]">
                  Récord Personal
                </span>
                <span className="text-base font-bold text-white tabular-nums">
                  {bestScore}
                </span>
              </div>
            </div>

            {pendingTodayHabits.length > 0 && (
              <div className="bg-[#121a28] border border-[#212e42] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#94a3b8]">
                  <span>Aprovecha el impulso · Pendientes hoy</span>
                  <span className="text-[#d8f23a] font-bold tabular-nums">
                    {pendingTodayHabits.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {pendingTodayHabits.slice(0, 3).map((habit) => (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between gap-2 bg-[#0b111c] border border-[#1f2c40] rounded-lg px-2.5 py-1.5"
                    >
                      <span className="text-xs text-white truncate">{habit.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          toggleDayStatus(habit, today);
                          showToast(`«${habit.name}» marcado como hecho hoy`);
                        }}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-[11px] font-bold cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Hecho</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={startGame}
                className="flex-1 py-2.5 rounded-xl bg-[#d8f23a] hover:bg-[#c8e22a] text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Volver a intentar</span>
              </button>
              <button
                type="button"
                onClick={onExit}
                className="px-4 py-2.5 rounded-xl bg-[#131c2b] border border-[#243247] hover:border-white text-white text-xs font-semibold cursor-pointer"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
