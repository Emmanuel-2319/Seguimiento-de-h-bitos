import type { GlobalStats, LocalDate, ShareCardTheme } from '../types';

export type CardOrientation = 'landscape' | 'portrait';

export interface DisciplineCardPayload {
  userName: string;
  today: LocalDate;
  globalStats: GlobalStats;
  habitSummaries: Array<{
    name: string;
    category: string;
    streak: number;
    monthlyCompleted: number;
    monthlyGoal: number;
  }>;
  note: string;
  showHabitNames: boolean;
  orientation: CardOrientation;
  theme?: ShareCardTheme;
  milestoneHighlight?: string;
}

interface ThemePalette {
  outerBg: string;
  grid: string;
  frameBg: string;
  frameBorder: string;
  cardBg: string;
  cardBorder: string;
  rowBg: string;
  accent: string;
  accentSoftBg: string;
  accentSoftBorder: string;
  badgeText: string;
  textPrimary: string;
  textMuted: string;
  textSubtle: string;
  heatmap: Record<0 | 1 | 2 | 3 | 4, string>;
}

const THEME_PALETTES: Record<ShareCardTheme, ThemePalette> = {
  oscuro: {
    outerBg: '#000000',
    grid: '#0e0e0e',
    frameBg: '#070707',
    frameBorder: '#1c1c1c',
    cardBg: '#0b0b0b',
    cardBorder: '#1c1c1c',
    rowBg: '#121212',
    accent: '#d8f23a',
    accentSoftBg: '#161a08',
    accentSoftBorder: '#313d0c',
    badgeText: '#000000',
    textPrimary: '#ffffff',
    textMuted: '#8a8a8a',
    textSubtle: '#555555',
    heatmap: {
      0: '#161616',
      1: '#35420c',
      2: '#647d14',
      3: '#9ec421',
      4: '#d8f23a',
    },
  },
  editorial: {
    outerBg: '#ece9e1',
    grid: '#e2ded4',
    frameBg: '#f9f7f2',
    frameBorder: '#d6d1c4',
    cardBg: '#ffffff',
    cardBorder: '#e2ddd0',
    rowBg: '#f2efe7',
    accent: '#2f6d1b',
    accentSoftBg: '#e7f1df',
    accentSoftBorder: '#b7d4a3',
    badgeText: '#ffffff',
    textPrimary: '#171717',
    textMuted: '#636058',
    textSubtle: '#918c81',
    heatmap: {
      0: '#eae6dc',
      1: '#cbe0ba',
      2: '#8dc16d',
      3: '#4f9631',
      4: '#2f6d1b',
    },
  },
  santuario: {
    outerBg: '#07141f',
    grid: '#0d2234',
    frameBg: '#0a1c2b',
    frameBorder: '#1b3d57',
    cardBg: '#0f273a',
    cardBorder: '#1e4663',
    rowBg: '#143148',
    accent: '#7df0d8',
    accentSoftBg: '#103445',
    accentSoftBorder: '#296c7f',
    badgeText: '#07141f',
    textPrimary: '#f2f9ff',
    textMuted: '#99bfd4',
    textSubtle: '#5c859e',
    heatmap: {
      0: '#142d41',
      1: '#1d4f63',
      2: '#2d7f8b',
      3: '#4fc0b4',
      4: '#7df0d8',
    },
  },
};

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawRoundedCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string
) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawTruncatedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(clipped + '…').width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  ctx.fillText(clipped + '…', x, y);
}

export function renderDisciplineCard(
  canvas: HTMLCanvasElement,
  data: DisciplineCardPayload
): void {
  const palette = THEME_PALETTES[data.theme ?? 'oscuro'];
  const isPortrait = data.orientation === 'portrait';
  const width = isPortrait ? 1080 : 1200;
  const height = isPortrait ? 1350 : 675;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Base background
  ctx.fillStyle = palette.outerBg;
  ctx.fillRect(0, 0, width, height);

  // Subtle architectural grid
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  for (let gx = 0; gx < width; gx += 48) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }
  for (let gy = 0; gy < height; gy += 48) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }

  // Outer card frame
  const pad = 42;
  drawRoundedCard(
    ctx,
    pad,
    pad,
    width - pad * 2,
    height - pad * 2,
    28,
    palette.frameBg,
    palette.frameBorder
  );

  const innerX = pad + 38;
  const innerW = width - (pad + 38) * 2;
  let cursorY = pad + 40;

  // Header: Brand lockup + Date & User
  drawRoundedCard(ctx, innerX, cursorY, 42, 42, 10, palette.accent);
  ctx.fillStyle = palette.badgeText;
  ctx.beginPath();
  ctx.moveTo(innerX + 24, cursorY + 9);
  ctx.lineTo(innerX + 13, cursorY + 23);
  ctx.lineTo(innerX + 21, cursorY + 23);
  ctx.lineTo(innerX + 18, cursorY + 34);
  ctx.lineTo(innerX + 29, cursorY + 20);
  ctx.lineTo(innerX + 21, cursorY + 20);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.textPrimary;
  ctx.font = '700 28px "Space Grotesk", sans-serif';
  ctx.fillText('RACHA', innerX + 56, cursorY + 27);

  drawRoundedCard(
    ctx,
    innerX + 162,
    cursorY + 6,
    186,
    28,
    7,
    palette.accentSoftBg,
    palette.accentSoftBorder
  );
  ctx.fillStyle = palette.accent;
  ctx.font = '700 12px "Space Grotesk", sans-serif';
  ctx.fillText('TARJETA DE DISCIPLINA', innerX + 174, cursorY + 24);

  // Date & User right-aligned
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.textPrimary;
  ctx.font = '600 16px "Space Grotesk", sans-serif';
  ctx.fillText(data.userName || 'Modo Local', innerX + innerW, cursorY + 18);
  ctx.fillStyle = palette.textMuted;
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.fillText(data.today, innerX + innerW, cursorY + 38);
  ctx.textAlign = 'left';

  cursorY += 66;

  // Optional milestone highlight banner
  if (data.milestoneHighlight?.trim()) {
    drawRoundedCard(
      ctx,
      innerX,
      cursorY,
      innerW,
      36,
      10,
      palette.accentSoftBg,
      palette.accentSoftBorder
    );
    ctx.fillStyle = palette.accent;
    ctx.font = '700 13px "Space Grotesk", sans-serif';
    drawTruncatedText(
      ctx,
      `HITO DESBLOQUEADO · ${data.milestoneHighlight.trim()}`,
      innerX + 16,
      cursorY + 22,
      innerW - 32
    );
    cursorY += 48;
  }

  // KPI Grid (4 across in landscape, 2x2 in portrait)
  const kpiGap = 16;
  const kpiCols = isPortrait ? 2 : 4;
  const kpiW = (innerW - kpiGap * (kpiCols - 1)) / kpiCols;
  const kpiH = data.milestoneHighlight?.trim() && !isPortrait ? 110 : 122;

  const unlockedMedalsText = data.globalStats.medals
    .map((m) =>
      m.unlocked && m.unlockedDate
        ? `${m.days}d (${m.unlockedDate.slice(5)})`
        : `${m.days}d ${m.unlocked ? '✓' : '·'}`
    )
    .join('  ');

  const kpis = [
    {
      label: 'RACHA MÁXIMA',
      value: `${data.globalStats.maxStreak} d`,
      sub: data.showHabitNames
        ? data.globalStats.maxStreakHabitName
        : `${data.globalStats.activeCount} rutinas activas`,
      accent: true,
    },
    {
      label: 'CONSISTENCIA 112D',
      value: `${data.globalStats.consistencyPct}%`,
      sub: 'Últimas 16 semanas',
      accent: false,
    },
    {
      label: 'CUMPLIMIENTO HOY',
      value: `${data.globalStats.todayCompletionPct}%`,
      sub: `${data.globalStats.todayCompletedCount}/${data.globalStats.activeCount} completados`,
      accent: false,
    },
    {
      label: 'MEDALLAS Y FECHAS',
      value: `${data.globalStats.medals.filter((m) => m.unlocked).length}/3`,
      sub: unlockedMedalsText,
      accent: true,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const col = idx % kpiCols;
    const row = Math.floor(idx / kpiCols);
    const kx = innerX + col * (kpiW + kpiGap);
    const ky = cursorY + row * (kpiH + kpiGap);

    drawRoundedCard(ctx, kx, ky, kpiW, kpiH, 16, palette.cardBg, palette.cardBorder);
    ctx.fillStyle = palette.textMuted;
    ctx.font = '600 11px "Space Grotesk", sans-serif';
    ctx.fillText(kpi.label, kx + 18, ky + 26);

    ctx.fillStyle = kpi.accent ? palette.accent : palette.textPrimary;
    ctx.font = '700 34px "Space Grotesk", sans-serif';
    ctx.fillText(kpi.value, kx + 18, ky + (kpiH > 115 ? 74 : 68));

    ctx.fillStyle = palette.textMuted;
    ctx.font = '500 12px "Space Grotesk", sans-serif';
    drawTruncatedText(ctx, kpi.sub, kx + 18, ky + (kpiH > 115 ? 100 : 92), kpiW - 36);
  });

  cursorY += (isPortrait ? 2 : 1) * kpiH + (isPortrait ? kpiGap : 0) + 18;

  // Middle Section: Heatmap (left or top) + Habits Summary (right or bottom)
  if (!isPortrait) {
    const leftW = 540;
    const rightW = innerW - leftW - 18;
    const boxH = data.milestoneHighlight?.trim() ? 236 : 264;

    drawRoundedCard(ctx, innerX, cursorY, leftW, boxH, 18, palette.cardBg, palette.cardBorder);
    ctx.fillStyle = palette.textPrimary;
    ctx.font = '700 14px "Space Grotesk", sans-serif';
    ctx.fillText('MAPA DE CONSISTENCIA (16 SEMANAS)', innerX + 22, cursorY + 30);
    ctx.fillStyle = palette.textMuted;
    ctx.font = '400 12px "Space Grotesk", sans-serif';
    ctx.fillText('112 días registrados en tiempo local', innerX + 22, cursorY + 49);

    const cellSize = boxH < 250 ? 20 : 22;
    const cellGap = boxH < 250 ? 6 : 7;
    const gridX = innerX + 26;
    const gridY = cursorY + 64;
    for (let w = 0; w < 16; w++) {
      for (let d = 0; d < 7; d++) {
        const dayData = data.globalStats.heatmapDays[w * 7 + d];
        const lvl = dayData ? dayData.level : 0;
        drawRoundedCard(
          ctx,
          gridX + w * (cellSize + cellGap),
          gridY + d * (cellSize + cellGap),
          cellSize,
          cellSize,
          4,
          palette.heatmap[lvl]
        );
      }
    }

    const rightX = innerX + leftW + 18;
    drawRoundedCard(ctx, rightX, cursorY, rightW, boxH, 18, palette.cardBg, palette.cardBorder);
    ctx.fillStyle = palette.textPrimary;
    ctx.font = '700 14px "Space Grotesk", sans-serif';
    ctx.fillText('RUTINAS Y RACHAS ACTIVAS', rightX + 22, cursorY + 30);

    const maxRows = boxH < 250 ? 4 : 5;
    const visibleHabits = data.habitSummaries.slice(0, maxRows);
    visibleHabits.forEach((h, i) => {
      const rowY = cursorY + 54 + i * 38;
      drawRoundedCard(ctx, rightX + 20, rowY, rightW - 40, 32, 8, palette.rowBg);
      ctx.fillStyle = palette.accent;
      ctx.font = '700 11px "Space Grotesk", sans-serif';
      ctx.fillText(h.category.toUpperCase(), rightX + 32, rowY + 20);

      ctx.fillStyle = palette.textPrimary;
      ctx.font = '500 13px "Space Grotesk", sans-serif';
      const title = data.showHabitNames ? h.name : `Hábito #${i + 1}`;
      drawTruncatedText(ctx, title, rightX + 112, rowY + 20, rightW - 220);

      ctx.textAlign = 'right';
      ctx.fillStyle = palette.accent;
      ctx.font = '700 13px "Space Grotesk", sans-serif';
      ctx.fillText(`${h.streak} d`, rightX + rightW - 32, rowY + 20);
      ctx.textAlign = 'left';
    });
  } else {
    const hmH = 304;
    drawRoundedCard(ctx, innerX, cursorY, innerW, hmH, 18, palette.cardBg, palette.cardBorder);
    ctx.fillStyle = palette.textPrimary;
    ctx.font = '700 15px "Space Grotesk", sans-serif';
    ctx.fillText('MAPA DE CONSISTENCIA (16 SEMANAS)', innerX + 24, cursorY + 34);

    const cellSize = 33;
    const cellGap = 11;
    const totalGridW = 16 * cellSize + 15 * cellGap;
    const gridX = innerX + (innerW - totalGridW) / 2;
    const gridY = cursorY + 56;
    for (let w = 0; w < 16; w++) {
      for (let d = 0; d < 7; d++) {
        const dayData = data.globalStats.heatmapDays[w * 7 + d];
        const lvl = dayData ? dayData.level : 0;
        drawRoundedCard(
          ctx,
          gridX + w * (cellSize + cellGap),
          gridY + d * (cellSize + cellGap),
          cellSize,
          cellSize,
          6,
          palette.heatmap[lvl]
        );
      }
    }

    cursorY += hmH + 18;

    const listH = data.milestoneHighlight?.trim() ? 390 : 420;
    drawRoundedCard(ctx, innerX, cursorY, innerW, listH, 18, palette.cardBg, palette.cardBorder);
    ctx.fillStyle = palette.textPrimary;
    ctx.font = '700 15px "Space Grotesk", sans-serif';
    ctx.fillText('RUTINAS Y RACHAS ACTIVAS', innerX + 24, cursorY + 36);

    const visibleHabits = data.habitSummaries.slice(0, 6);
    visibleHabits.forEach((h, i) => {
      const rowY = cursorY + 60 + i * 54;
      drawRoundedCard(ctx, innerX + 22, rowY, innerW - 44, 44, 12, palette.rowBg);
      ctx.fillStyle = palette.accent;
      ctx.font = '700 12px "Space Grotesk", sans-serif';
      ctx.fillText(h.category.toUpperCase(), innerX + 38, rowY + 27);

      ctx.fillStyle = palette.textPrimary;
      ctx.font = '500 16px "Space Grotesk", sans-serif';
      const title = data.showHabitNames ? h.name : `Hábito #${i + 1}`;
      drawTruncatedText(ctx, title, innerX + 135, rowY + 27, innerW - 290);

      ctx.textAlign = 'right';
      ctx.fillStyle = palette.accent;
      ctx.font = '700 16px "Space Grotesk", sans-serif';
      ctx.fillText(`${h.streak} d`, innerX + innerW - 38, rowY + 27);
      ctx.textAlign = 'left';
    });
  }

  // Footer Reminder Quote
  const noteText =
    data.note.trim() || 'La consistencia diaria supera a la intensidad ocasional.';
  ctx.fillStyle = palette.accent;
  ctx.font = '500 15px "Space Grotesk", sans-serif';
  drawTruncatedText(ctx, `“${noteText}”`, innerX, height - pad - 28, innerW - 180);

  ctx.textAlign = 'right';
  ctx.fillStyle = palette.textSubtle;
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillText('RACHA HABITS', innerX + innerW, height - pad - 28);
  ctx.textAlign = 'left';
}
