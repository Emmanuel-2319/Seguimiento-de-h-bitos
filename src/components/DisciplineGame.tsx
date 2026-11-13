import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { gameAudio } from '../utils/gameAudio';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
type DifficultyMode = 'diario' | 'implacable';

interface HabitNode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  label: string;
  category: string;
  life: number;
  maxLife: number;
  isGraceBonus: boolean;
}

interface HazardSpike {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  windup: number; // >0 telegraphs launch before dashing
  maxWindup: number;
  dashed: boolean;
  label: string;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
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
  pulseCooldownPct: number; // 100 = ready
  comboLabel: string;
}

const BEST_SCORE_STORAGE_KEY = 'racha_forja_best_score_v1';
const DISTRACTION_LABELS = [
  'Scroll infinito',
  'Posponer',
  'Excusa',
  'Ruido',
  'Fatiga',
  'Desvío',
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

interface DisciplineGameProps {
  onExit: () => void;
}

export const DisciplineGame: React.FC<DisciplineGameProps> = ({ onExit }) => {
  const { entities, globalStats } = useStore();

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [difficulty, setDifficulty] = useState<DifficultyMode>('diario');
  const [muted, setMuted] = useState<boolean>(false);
  const [bestScore, setBestScore] = useState<number>(() => readBestScore());

  const initialShields = useMemo(() => {
    const totalGrace = entities.reduce((acc, e) => acc + e.graceDays, 0);
    return Math.max(1, Math.min(3, Math.ceil(totalGrace / 2) || 1));
  }, [entities]);

  const habitPool = useMemo(() => {
    if (entities.length === 0) {
      return [
        { name: 'Enfoque', category: 'trabajo' },
        { name: 'Lectura', category: 'estudio' },
        { name: 'Entreno', category: 'salud' },
        { name: 'Diario', category: 'personal' },
      ];
    }
    return entities.map((e) => ({ name: e.name.split(' ')[0], category: e.category }));
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
    comboLabel: 'Inicio',
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameStateRef = useRef<GameState>('TITLE_MENU');
  const difficultyRef = useRef<DifficultyMode>('diario');
  const habitPoolRef = useRef(habitPool);
  const initialShieldsRef = useRef(initialShields);
  const bestScoreRef = useRef(bestScore);

  habitPoolRef.current = habitPool;
  initialShieldsRef.current = initialShields;
  difficultyRef.current = difficulty;
  bestScoreRef.current = bestScore;

  // Mutable simulation state (isolated from React render cycle for smooth 60fps)
  const simRef = useRef({
    width: 960,
    height: 600,
    player: {
      x: 480,
      y: 300,
      vx: 0,
      vy: 0,
      radius: 17,
      scaleX: 1,
      scaleY: 1,
      flashTimer: 0,
      invulnTimer: 0,
    },
    keysHeld: new Set<string>(),
    pointerTarget: null as { x: number; y: number } | null,
    pulseQueued: false,
    pulseCooldown: 0,
    pulseMaxCooldown: 5.5,
    hitstopTimer: 0,
    shakeTimer: 0,
    shakeMag: 0,
    dayTimer: 0,
    dayDuration: 14, // seconds per simulated day
    spawnHabitTimer: 0.4,
    spawnHazardTimer: 1.6,
    nextEntityId: 1,
    habits: [] as HabitNode[],
    hazards: [] as HazardSpike[],
    shockwaves: [] as Shockwave[],
    particles: Array.from({ length: 140 }, (): Particle => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 3,
      color: '#d8f23a',
    })),
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
    hudSyncAcc: 0,
    bgOffset: 0,
  });

  const spawnParticles = useCallback(
    (x: number, y: number, color: string, count: number, speed = 180) => {
      const pool = simRef.current.particles;
      let spawned = 0;
      for (let i = 0; i < pool.length && spawned < count; i++) {
        if (!pool[i].active) {
          const angle = Math.random() * Math.PI * 2;
          const mag = (0.35 + Math.random() * 0.75) * speed;
          pool[i].active = true;
          pool[i].x = x;
          pool[i].y = y;
          pool[i].vx = Math.cos(angle) * mag;
          pool[i].vy = Math.sin(angle) * mag;
          pool[i].life = 0.25 + Math.random() * 0.35;
          pool[i].maxLife = pool[i].life;
          pool[i].size = 2 + Math.random() * 3.5;
          pool[i].color = color;
          spawned++;
        }
      }
    },
    []
  );

  const syncHudNow = useCallback(() => {
    const s = simRef.current;
    const pulsePct = Math.round(
      Math.max(0, Math.min(1, 1 - s.pulseCooldown / s.pulseMaxCooldown)) * 100
    );
    const streak = s.stats.streak;
    let comboLabel = 'Constante';
    if (streak >= 30) comboLabel = 'Leyenda 30d+';
    else if (streak >= 14) comboLabel = 'Imparable';
    else if (streak >= 7) comboLabel = 'Racha 7d+';
    else if (streak === 0) comboLabel = 'Reiniciada';

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
      comboLabel,
    });
  }, []);

  const resetSimulation = useCallback(() => {
    const s = simRef.current;
    const mode = difficultyRef.current;
    s.player.x = s.width / 2;
    s.player.y = s.height / 2;
    s.player.vx = 0;
    s.player.vy = 0;
    s.player.scaleX = 1;
    s.player.scaleY = 1;
    s.player.flashTimer = 0;
    s.player.invulnTimer = 0;
    s.pointerTarget = null;
    s.pulseQueued = false;
    s.pulseCooldown = 0;
    s.hitstopTimer = 0;
    s.shakeTimer = 0;
    s.shakeMag = 0;
    s.dayTimer = 0;
    s.spawnHabitTimer = 0.35;
    s.spawnHazardTimer = mode === 'implacable' ? 1.1 : 1.7;
    s.habits = [];
    s.hazards = [];
    s.shockwaves = [];
    for (const p of s.particles) p.active = false;

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
    syncHudNow();
  }, [syncHudNow]);

  const startGame = useCallback(() => {
    resetSimulation();
    gameStateRef.current = 'PLAYING';
    setGameState('PLAYING');
    gameAudio.playDayUp();
  }, [resetSimulation]);

  const togglePause = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') {
      gameStateRef.current = 'PAUSED';
      setGameState('PAUSED');
    } else if (gameStateRef.current === 'PAUSED') {
      gameStateRef.current = 'PLAYING';
      setGameState('PLAYING');
    }
  }, []);

  const triggerFocusPulse = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') {
      simRef.current.pulseQueued = true;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      gameAudio.setMuted(next);
      return next;
    });
  }, []);

  // Keyboard & Blur Listeners
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

      if (key === ' ' && gameStateRef.current === 'PLAYING') {
        simRef.current.pulseQueued = true;
        return;
      }

      simRef.current.keysHeld.add(key);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      simRef.current.keysHeld.delete(e.key.toLowerCase());
    };

    const onBlur = () => {
      simRef.current.keysHeld.clear();
      simRef.current.pointerTarget = null;
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

  // Isolated 60fps Canvas Loop & ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(320, Math.floor(rect.width * dpr));
      canvas.height = Math.max(320, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      simRef.current.width = rect.width;
      simRef.current.height = rect.height;
      simRef.current.player.x = Math.min(
        Math.max(24, simRef.current.player.x),
        rect.width - 24
      );
      simRef.current.player.y = Math.min(
        Math.max(24, simRef.current.player.y),
        rect.height - 24
      );
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    let rafId = 0;
    let lastTime = performance.now();

    const spawnHabitNode = () => {
      const s = simRef.current;
      const pool = habitPoolRef.current;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      const margin = 48;
      const x = margin + Math.random() * Math.max(40, s.width - margin * 2);
      const y = margin + Math.random() * Math.max(40, s.height - margin * 2);
      const angle = Math.random() * Math.PI * 2;
      const drift = 22 + Math.min(60, s.stats.day * 4);
      const isGraceBonus = s.stats.shields < 3 && Math.random() < 0.14;

      s.habits.push({
        id: s.nextEntityId++,
        x,
        y,
        vx: Math.cos(angle) * drift,
        vy: Math.sin(angle) * drift,
        radius: isGraceBonus ? 14 : 16,
        label: isGraceBonus ? 'Gracia +1' : picked.name,
        category: picked.category,
        life: difficultyRef.current === 'implacable' ? 6.5 : 8.5,
        maxLife: difficultyRef.current === 'implacable' ? 6.5 : 8.5,
        isGraceBonus,
      });
    };

    const spawnHazardSpike = () => {
      const s = simRef.current;
      const side = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      if (side === 0) {
        x = Math.random() * s.width;
        y = 24;
      } else if (side === 1) {
        x = s.width - 24;
        y = Math.random() * s.height;
      } else if (side === 2) {
        x = Math.random() * s.width;
        y = s.height - 24;
      } else {
        x = 24;
        y = Math.random() * s.height;
      }

      const windup = Math.max(0.55, 1.15 - s.stats.day * 0.03);
      s.hazards.push({
        id: s.nextEntityId++,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: 14,
        windup,
        maxWindup: windup,
        dashed: false,
        label:
          DISTRACTION_LABELS[
            Math.floor(Math.random() * DISTRACTION_LABELS.length)
          ],
      });
    };

    const applyDamage = (reason: 'hazard' | 'missed') => {
      const s = simRef.current;
      if (s.player.invulnTimer > 0 && reason === 'hazard') return;

      if (s.stats.shields > 0) {
        s.stats.shields -= 1;
        s.player.invulnTimer = 0.85;
        s.player.flashTimer = 0.22;
        s.hitstopTimer = 0.045;
        s.shakeTimer = 0.22;
        s.shakeMag = 7;
        s.shockwaves.push({
          x: s.player.x,
          y: s.player.y,
          radius: 16,
          maxRadius: 110,
          alpha: 0.9,
          color: '#facc15',
        });
        spawnParticles(s.player.x, s.player.y, '#facc15', 16, 220);
        gameAudio.playGraceShield();
        syncHudNow();
        return;
      }

      // Break streak + lose 1 Focus HP
      s.stats.streak = 0;
      s.stats.hp = Math.max(0, s.stats.hp - 1);
      s.player.invulnTimer = 1.0;
      s.player.flashTimer = 0.3;
      s.player.scaleX = 1.35;
      s.player.scaleY = 0.7;
      s.hitstopTimer = 0.065;
      s.shakeTimer = 0.3;
      s.shakeMag = 11;
      spawnParticles(s.player.x, s.player.y, '#ef4444', 24, 260);

      if (s.stats.hp <= 0) {
        gameAudio.playGameOver();
        if (s.stats.score > bestScoreRef.current) {
          saveBestScore(s.stats.score);
          setBestScore(s.stats.score);
        }
        gameStateRef.current = 'GAME_OVER';
        setGameState('GAME_OVER');
      } else {
        gameAudio.playHit();
      }
      syncHudNow();
    };

    const step = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      const s = simRef.current;
      s.bgOffset = (s.bgOffset + dt * 14) % 48;

      if (gameStateRef.current === 'PLAYING') {
        // Hitstop freeze for heavy impacts
        if (s.hitstopTimer > 0) {
          s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
        } else {
          // Cooldowns & timers
          if (s.pulseCooldown > 0) s.pulseCooldown = Math.max(0, s.pulseCooldown - dt);
          if (s.player.invulnTimer > 0) s.player.invulnTimer = Math.max(0, s.player.invulnTimer - dt);
          if (s.player.flashTimer > 0) s.player.flashTimer = Math.max(0, s.player.flashTimer - dt);
          if (s.shakeTimer > 0) s.shakeTimer = Math.max(0, s.shakeTimer - dt);

          // Day progression
          s.dayTimer += dt;
          if (s.dayTimer >= s.dayDuration) {
            s.dayTimer -= s.dayDuration;
            s.stats.day += 1;
            s.stats.score += 100 + s.stats.streak * 5;
            gameAudio.playDayUp();
            s.shockwaves.push({
              x: s.player.x,
              y: s.player.y,
              radius: 20,
              maxRadius: 150,
              alpha: 0.7,
              color: '#d8f23a',
            });
            syncHudNow();
          }

          // Focus Pulse Action (edge-triggered)
          if (s.pulseQueued) {
            s.pulseQueued = false;
            if (s.pulseCooldown <= 0) {
              s.pulseCooldown = s.pulseMaxCooldown;
              s.player.scaleX = 1.25;
              s.player.scaleY = 1.25;
              s.shakeTimer = 0.14;
              s.shakeMag = 5;
              s.shockwaves.push({
                x: s.player.x,
                y: s.player.y,
                radius: 18,
                maxRadius: 195,
                alpha: 1,
                color: '#d8f23a',
              });
              spawnParticles(s.player.x, s.player.y, '#d8f23a', 20, 260);
              gameAudio.playPulse();

              // Clear hazards inside blast radius and pull habits slightly
              const blastR = 195;
              s.hazards = s.hazards.filter((hz) => {
                const dist = Math.hypot(hz.x - s.player.x, hz.y - s.player.y);
                if (dist <= blastR) {
                  spawnParticles(hz.x, hz.y, '#ef4444', 10, 170);
                  s.stats.score += 25;
                  return false;
                }
                return true;
              });

              for (const hb of s.habits) {
                const dx = s.player.x - hb.x;
                const dy = s.player.y - hb.y;
                const dist = Math.hypot(dx, dy) || 1;
                if (dist <= blastR * 1.35) {
                  hb.vx = (dx / dist) * 260;
                  hb.vy = (dy / dist) * 260;
                }
              }
              syncHudNow();
            }
          }

          // Player Movement (WASD / Arrows + smooth Pointer/Touch steer)
          let moveX = 0;
          let moveY = 0;
          if (s.keysHeld.has('w') || s.keysHeld.has('arrowup')) moveY -= 1;
          if (s.keysHeld.has('s') || s.keysHeld.has('arrowdown')) moveY += 1;
          if (s.keysHeld.has('a') || s.keysHeld.has('arrowleft')) moveX -= 1;
          if (s.keysHeld.has('d') || s.keysHeld.has('arrowright')) moveX += 1;

          const speed = 350;
          if (moveX !== 0 || moveY !== 0) {
            s.pointerTarget = null;
            const len = Math.hypot(moveX, moveY);
            s.player.vx = (moveX / len) * speed;
            s.player.vy = (moveY / len) * speed;
          } else if (s.pointerTarget) {
            const dx = s.pointerTarget.x - s.player.x;
            const dy = s.pointerTarget.y - s.player.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 6) {
              const factor = Math.min(1, dist / 34);
              s.player.vx = (dx / dist) * speed * factor;
              s.player.vy = (dy / dist) * speed * factor;
            } else {
              s.player.vx *= 0.7;
              s.player.vy *= 0.7;
            }
          } else {
            s.player.vx *= 0.82;
            s.player.vy *= 0.82;
          }

          s.player.x = Math.min(
            Math.max(s.player.radius + 8, s.player.x + s.player.vx * dt),
            s.width - s.player.radius - 8
          );
          s.player.y = Math.min(
            Math.max(s.player.radius + 8, s.player.y + s.player.vy * dt),
            s.height - s.player.radius - 8
          );

          // Squash & stretch recovery
          s.player.scaleX += (1 - s.player.scaleX) * Math.min(1, dt * 12);
          s.player.scaleY += (1 - s.player.scaleY) * Math.min(1, dt * 12);

          // Spawners
          s.spawnHabitTimer -= dt;
          if (s.spawnHabitTimer <= 0) {
            spawnHabitNode();
            const baseInterval = difficultyRef.current === 'implacable' ? 1.5 : 1.9;
            s.spawnHabitTimer = Math.max(0.8, baseInterval - s.stats.day * 0.05);
          }

          s.spawnHazardTimer -= dt;
          if (s.spawnHazardTimer <= 0) {
            spawnHazardSpike();
            const baseHz = difficultyRef.current === 'implacable' ? 1.55 : 2.25;
            s.spawnHazardTimer = Math.max(0.75, baseHz - s.stats.day * 0.08);
          }

          // Update Habit Orbs
          const remainingHabits: HabitNode[] = [];
          for (const hb of s.habits) {
            hb.x += hb.vx * dt;
            hb.y += hb.vy * dt;
            if (hb.x < 24 || hb.x > s.width - 24) hb.vx *= -1;
            if (hb.y < 24 || hb.y > s.height - 24) hb.vy *= -1;
            hb.life -= dt;

            const dist = Math.hypot(hb.x - s.player.x, hb.y - s.player.y);
            if (dist <= hb.radius + s.player.radius + 4) {
              // Captured Habit!
              s.stats.streak += 1;
              s.stats.capturedCount += 1;
              if (s.stats.streak > s.stats.bestStreakInRun) {
                s.stats.bestStreakInRun = s.stats.streak;
              }
              if (hb.isGraceBonus) {
                s.stats.shields = Math.min(3, s.stats.shields + 1);
                spawnParticles(hb.x, hb.y, '#facc15', 14, 190);
              } else {
                spawnParticles(hb.x, hb.y, '#d8f23a', 14, 190);
              }
              s.stats.score += 50 + s.stats.streak * 10;
              if (s.stats.streak > 0 && s.stats.streak % 10 === 0 && s.stats.shields < 3) {
                s.stats.shields += 1;
              }
              s.player.scaleX = 1.2;
              s.player.scaleY = 0.85;
              gameAudio.playCapture(s.stats.streak);
              syncHudNow();
              continue;
            }

            if (hb.life <= 0) {
              // Missed a daily habit -> only penalize non-bonus orbs
              if (!hb.isGraceBonus) {
                applyDamage('missed');
              }
              continue;
            }
            remainingHabits.push(hb);
          }
          s.habits = remainingHabits;

          // Update Hazard Spikes
          const remainingHazards: HazardSpike[] = [];
          for (const hz of s.hazards) {
            if (hz.windup > 0) {
              hz.windup -= dt;
              if (hz.windup <= 0 && !hz.dashed) {
                hz.dashed = true;
                const dx = s.player.x - hz.x;
                const dy = s.player.y - hz.y;
                const len = Math.hypot(dx, dy) || 1;
                const dashSpeed =
                  (difficultyRef.current === 'implacable' ? 235 : 185) +
                  Math.min(130, s.stats.day * 10);
                hz.vx = (dx / len) * dashSpeed;
                hz.vy = (dy / len) * dashSpeed;
              }
            } else {
              hz.x += hz.vx * dt;
              hz.y += hz.vy * dt;
            }

            // Despawn offscreen hazards
            if (
              hz.x < -60 ||
              hz.x > s.width + 60 ||
              hz.y < -60 ||
              hz.y > s.height + 60
            ) {
              continue;
            }

            const dist = Math.hypot(hz.x - s.player.x, hz.y - s.player.y);
            if (hz.dashed && dist <= hz.radius + s.player.radius - 2) {
              applyDamage('hazard');
              continue;
            }
            remainingHazards.push(hz);
          }
          s.hazards = remainingHazards;

          // Periodic HUD sync for pulse bar
          s.hudSyncAcc += dt;
          if (s.hudSyncAcc >= 0.12) {
            s.hudSyncAcc = 0;
            syncHudNow();
          }
        }
      }

      // Update particles & shockwaves even during pause/hitstop fade
      for (const p of s.particles) {
        if (!p.active) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.life -= dt;
        if (p.life <= 0) p.active = false;
      }

      s.shockwaves = s.shockwaves.filter((sw) => {
        sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, dt * 10);
        sw.alpha -= dt * 2.2;
        return sw.alpha > 0.02;
      });

      // --- RENDER ---
      ctx.save();
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, s.width, s.height);

      // Camera shake
      if (s.shakeTimer > 0 && gameStateRef.current === 'PLAYING') {
        const mag = s.shakeMag * (s.shakeTimer / 0.3);
        ctx.translate(
          (Math.random() - 0.5) * mag * 2,
          (Math.random() - 0.5) * mag * 2
        );
      }

      // Subtle architectural discipline grid
      ctx.strokeStyle = '#121212';
      ctx.lineWidth = 1;
      for (let x = s.bgOffset; x < s.width; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, s.height);
        ctx.stroke();
      }
      for (let y = s.bgOffset; y < s.height; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(s.width, y);
        ctx.stroke();
      }

      // Title menu live ambient floating rings
      if (gameStateRef.current === 'TITLE_MENU') {
        const pulse = (Math.sin(now * 0.002) + 1) * 0.5;
        ctx.strokeStyle = 'rgba(216, 242, 58, 0.10)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(s.width * 0.5, s.height * 0.5, 110 + pulse * 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(216, 242, 58, 0.05)';
        ctx.beginPath();
        ctx.arc(s.width * 0.5, s.height * 0.5, 190 + (1 - pulse) * 35, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Shockwaves
      for (const sw of s.shockwaves) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Habit Nodes
      for (const hb of s.habits) {
        const ratio = Math.max(0, hb.life / hb.maxLife);
        ctx.save();
        ctx.translate(hb.x, hb.y);

        // Countdown outer arc
        ctx.strokeStyle = hb.isGraceBonus ? '#facc15' : '#d8f23a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, hb.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
        ctx.stroke();

        // Core circle
        ctx.fillStyle = hb.isGraceBonus ? '#2a2208' : '#161a08';
        ctx.beginPath();
        ctx.arc(0, 0, hb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hb.isGraceBonus ? '#facc15' : '#d8f23a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 10px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(hb.label, 0, hb.radius + 19);
        ctx.restore();
      }

      // Hazard Spikes with windup telegraph
      for (const hz of s.hazards) {
        ctx.save();
        ctx.translate(hz.x, hz.y);

        if (hz.windup > 0) {
          const pct = 1 - hz.windup / hz.maxWindup;
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, hz.radius + 14 * (1 - pct), 0, Math.PI * 2);
          ctx.stroke();
        }

        // Diamond hazard shape
        ctx.rotate(now * 0.004);
        ctx.fillStyle = hz.windup > 0 ? '#450a0a' : '#dc2626';
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -hz.radius);
        ctx.lineTo(hz.radius, 0);
        ctx.lineTo(0, hz.radius);
        ctx.lineTo(-hz.radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = '#fca5a5';
        ctx.font = '500 9px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(hz.label, hz.x, hz.y + hz.radius + 14);
        ctx.restore();
      }

      // Player Vessel (Discipline Core)
      if (gameStateRef.current !== 'TITLE_MENU') {
        const pl = s.player;
        ctx.save();
        ctx.translate(pl.x, pl.y);
        ctx.scale(pl.scaleX, pl.scaleY);

        if (s.stats.shields > 0) {
          ctx.strokeStyle = 'rgba(216, 242, 58, 0.45)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, pl.radius + 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const blinking = pl.invulnTimer > 0 && Math.floor(now / 70) % 2 === 0;
        ctx.fillStyle =
          pl.flashTimer > 0 ? '#ffffff' : blinking ? '#555555' : '#d8f23a';
        ctx.beginPath();
        ctx.arc(0, 0, pl.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner core emblem
        ctx.fillStyle = '#050505';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Particles
      for (const p of s.particles) {
        if (!p.active) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [spawnParticles, syncHudNow]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameStateRef.current !== 'PLAYING') return;
    if (e.buttons > 0 || e.pointerType === 'touch' || e.pointerType === 'mouse') {
      const rect = e.currentTarget.getBoundingClientRect();
      simRef.current.pointerTarget = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const handlePointerLeave = () => {
    simRef.current.pointerTarget = null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] text-white select-none overflow-hidden">
      {/* Isolated Full-Viewport Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerMove}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="w-full h-full block touch-none cursor-crosshair"
      />

      {/* Perimeter HUD (Unobstructed center >= 85%, pointer-events: none wrapper) */}
      {gameState !== 'TITLE_MENU' && (
        <div className="pointer-events-none fixed inset-0 flex flex-col justify-between p-3 sm:p-5">
          {/* Top Perimeter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 bg-[#0b0b0b]/90 border border-[#222222] rounded-xl px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">
                  Día
                </span>
                <span className="text-sm font-bold text-white tabular-nums">
                  {hud.day}
                </span>
              </div>
              <span className="text-[#2a2a2a]">|</span>
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#d8f23a]" />
                <span className="text-sm font-bold text-[#d8f23a] tabular-nums">
                  {hud.streak}d
                </span>
              </div>
              <span className="hidden sm:inline text-[#2a2a2a]">|</span>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">
                  Puntos
                </span>
                <span className="text-sm font-bold text-white tabular-nums">
                  {hud.score}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Focus HP + Grace Shields */}
              <div className="flex items-center gap-2.5 bg-[#0b0b0b]/90 border border-[#222222] rounded-xl px-3 py-2">
                <div className="flex items-center gap-1" title="Enfoque restante">
                  <span className="text-[10px] uppercase text-[#8a8a8a] mr-1">
                    Enfoque
                  </span>
                  {Array.from({ length: hud.maxHp }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`w-2.5 h-2.5 rounded-sm ${
                        idx < hud.hp ? 'bg-[#d8f23a]' : 'bg-[#262626]'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[#2a2a2a]">|</span>
                <div className="flex items-center gap-1" title="Escudos de Gracia">
                  <Shield className="w-3.5 h-3.5 text-[#facc15]" />
                  <span className="text-xs font-bold text-white tabular-nums">
                    {hud.shields}
                  </span>
                </div>
              </div>

              {/* Interactive Audio & Pause Controls */}
              <div className="pointer-events-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
                  className="p-2 rounded-xl bg-[#0b0b0b]/90 border border-[#222222] hover:border-[#d8f23a] text-[#8a8a8a] hover:text-white transition-colors cursor-pointer"
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
                  className="p-2 rounded-xl bg-[#0b0b0b]/90 border border-[#222222] hover:border-[#d8f23a] text-white transition-colors cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Perimeter Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="bg-[#0b0b0b]/90 border border-[#222222] rounded-xl px-3 py-1.5 text-[11px] text-[#8a8a8a] tabular-nums">
              Capturados: <span className="text-white font-semibold">{hud.capturedCount}</span>
              <span className="mx-2 text-[#2a2a2a]">·</span>
              Estado: <span className="text-[#d8f23a] font-semibold">{hud.comboLabel}</span>
            </div>

            <button
              type="button"
              onClick={triggerFocusPulse}
              disabled={hud.pulseCooldownPct < 100}
              className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer tabular-nums ${
                hud.pulseCooldownPct >= 100
                  ? 'bg-[#d8f23a] border-[#d8f23a] text-black hover:bg-[#c8e22a]'
                  : 'bg-[#0b0b0b]/90 border-[#222222] text-[#8a8a8a]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>
                {hud.pulseCooldownPct >= 100
                  ? 'Pulso de Enfoque (Espacio)'
                  : `Recargando ${hud.pulseCooldownPct}%`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Title Screen */}
      {gameState === 'TITLE_MENU' && (
        <div className="fixed inset-0 flex flex-col justify-between p-5 sm:p-8">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-2 bg-[#0b0b0b] border border-[#222222] hover:border-[#d8f23a] text-white text-xs font-medium px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al Tablero</span>
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
              className="p-2 rounded-xl bg-[#0b0b0b] border border-[#222222] hover:border-[#d8f23a] text-[#8a8a8a] hover:text-white transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#d8f23a]" />}
            </button>
          </div>

          <div className="max-w-lg mx-auto w-full text-center space-y-6">
            {/* Bespoke Inline SVG Title Lockup */}
            <div className="flex flex-col items-center gap-3">
              <svg
                viewBox="0 0 320 64"
                className="w-72 sm:w-80 h-auto"
                aria-label="Forja de Racha"
              >
                <rect
                  x="4"
                  y="10"
                  width="44"
                  height="44"
                  rx="11"
                  fill="#d8f23a"
                />
                <path
                  d="M28 19L18 33h8l-2 12 10-14h-8l2-12z"
                  fill="#050505"
                />
                <text
                  x="62"
                  y="39"
                  fill="#ffffff"
                  fontFamily="Space Grotesk, sans-serif"
                  fontWeight="700"
                  fontSize="26"
                  letterSpacing="-0.5"
                >
                  FORJA DE RACHA
                </text>
                <text
                  x="63"
                  y="54"
                  fill="#8a8a8a"
                  fontFamily="Space Grotesk, sans-serif"
                  fontWeight="500"
                  fontSize="10.5"
                  letterSpacing="2"
                >
                  ENTRENAMIENTO DE DISCIPLINA DIARIA
                </text>
              </svg>

              <p className="text-xs sm:text-sm text-[#8a8a8a] max-w-md leading-relaxed">
                Captura tus rutinas antes de que caduque el día y esquiva las distracciones.
                Tus <span className="text-[#d8f23a] font-semibold">días de gracia</span> se
                convierten en escudos protectores.
              </p>
            </div>

            {/* Live Sync Summary + Difficulty */}
            <div className="bg-[#0b0b0b]/95 border border-[#1c1c1c] rounded-2xl p-4 space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#121212] rounded-xl py-2.5 px-2">
                  <span className="block text-[10px] uppercase text-[#8a8a8a]">Rutinas</span>
                  <span className="text-sm font-bold text-white tabular-nums">
                    {entities.length}
                  </span>
                </div>
                <div className="bg-[#121212] rounded-xl py-2.5 px-2">
                  <span className="block text-[10px] uppercase text-[#8a8a8a]">Escudos</span>
                  <span className="text-sm font-bold text-[#d8f23a] tabular-nums">
                    {initialShields}
                  </span>
                </div>
                <div className="bg-[#121212] rounded-xl py-2.5 px-2">
                  <span className="block text-[10px] uppercase text-[#8a8a8a]">Récord</span>
                  <span className="text-sm font-bold text-white tabular-nums">
                    {bestScore}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-[#121212] p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDifficulty('diario')}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    difficulty === 'diario'
                      ? 'bg-[#d8f23a] text-black'
                      : 'text-[#8a8a8a] hover:text-white'
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
                      : 'text-[#8a8a8a] hover:text-white'
                  }`}
                >
                  Modo Implacable
                </button>
              </div>

              <button
                type="button"
                onClick={startGame}
                className="w-full py-3 rounded-xl bg-[#d8f23a] hover:bg-[#c8e22a] text-black font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Iniciar Partida</span>
              </button>
            </div>
          </div>

          <div className="text-center text-[11px] text-[#8a8a8a] tracking-wide">
            WASD / Ratón / Táctil Mover · Espacio Pulso · Esc Pausa · Consistencia real:{' '}
            <span className="text-[#d8f23a] tabular-nums">{globalStats.consistencyPct}%</span>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {gameState === 'PAUSED' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm bg-[#0b0b0b] border border-[#242424] rounded-2xl p-6 text-center space-y-5">
            <h2 className="text-lg font-bold text-white">Partida en pausa</h2>
            <p className="text-xs text-[#8a8a8a] tabular-nums">
              Día {hud.day} · Racha actual: {hud.streak}d · Puntos: {hud.score}
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
                className="w-full py-2.5 rounded-xl bg-[#141414] border border-[#262626] hover:border-white text-white font-semibold text-xs cursor-pointer"
              >
                Reiniciar
              </button>
              <button
                type="button"
                onClick={onExit}
                className="w-full py-2.5 rounded-xl bg-transparent text-[#8a8a8a] hover:text-white text-xs cursor-pointer"
              >
                Salir al Tablero
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Summary Modal */}
      {gameState === 'GAME_OVER' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md bg-[#0b0b0b] border border-[#242424] rounded-2xl p-6 space-y-5">
            <div className="text-center space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-[#d8f23a] font-semibold">
                Sesión completada
              </span>
              <h2 className="text-xl font-bold text-white">Racha finalizada</h2>
              <p className="text-xs text-[#8a8a8a]">
                Cada día cuenta. Ajusta tu ritmo y vuelve a intentarlo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#121212] border border-[#1f1f1f] rounded-xl p-3.5">
                <span className="text-[11px] text-[#8a8a8a]">Puntuación</span>
                <p className="text-2xl font-bold text-[#d8f23a] tabular-nums mt-0.5">
                  {hud.score}
                </p>
              </div>
              <div className="bg-[#121212] border border-[#1f1f1f] rounded-xl p-3.5">
                <span className="text-[11px] text-[#8a8a8a]">Mejor racha</span>
                <p className="text-2xl font-bold text-white tabular-nums mt-0.5">
                  {hud.bestStreakInRun} d
                </p>
              </div>
              <div className="bg-[#121212] border border-[#1f1f1f] rounded-xl p-3.5">
                <span className="text-[11px] text-[#8a8a8a]">Días superados</span>
                <p className="text-lg font-bold text-white tabular-nums mt-0.5">
                  {hud.day}
                </p>
              </div>
              <div className="bg-[#121212] border border-[#1f1f1f] rounded-xl p-3.5">
                <span className="text-[11px] text-[#8a8a8a]">Rutinas capturadas</span>
                <p className="text-lg font-bold text-white tabular-nums mt-0.5">
                  {hud.capturedCount}
                </p>
              </div>
            </div>

            {hud.bestStreakInRun >= 7 && (
              <div className="flex items-center justify-center gap-2 bg-[#161a08] border border-[#34420e] text-[#d8f23a] text-xs font-semibold py-2 px-3 rounded-xl">
                <Award className="w-4 h-4" />
                <span>
                  Hito de sesión:{' '}
                  {hud.bestStreakInRun >= 30
                    ? '30+ días continuos'
                    : '7+ días continuos'}
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={startGame}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#d8f23a] hover:bg-[#c8e22a] text-black font-bold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Jugar de nuevo</span>
              </button>
              <button
                type="button"
                onClick={onExit}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#141414] border border-[#262626] hover:border-white text-white font-semibold text-xs whitespace-nowrap cursor-pointer"
              >
                Volver al Tablero
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
