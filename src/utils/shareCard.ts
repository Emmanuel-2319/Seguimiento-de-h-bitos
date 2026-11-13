import type { GlobalStats, LocalDate } from '../types';

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
}

const HEATMAP_FILLS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: '#161616',
  1: '#35420c',
  2: '#647d14',
  3: '#9ec421',
  4: '#d8f23a',
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
  const isPortrait = data.orientation === 'portrait';
  const width = isPortrait ? 1080 : 1200;
  const height = isPortrait ? 1350 : 675;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Base background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  // Subtle architectural grid
  ctx.strokeStyle = '#0e0e0e';
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
  drawRoundedCard(ctx, pad, pad, width - pad * 2, height - pad * 2, 28, '#070707', '#1c1c1c');

  const innerX = pad + 38;
  const innerW = width - (pad + 38) * 2;
  let cursorY = pad + 44;

  // Header: Brand lockup + Date & User
  drawRoundedCard(ctx, innerX, cursorY, 42, 42, 10, '#d8f23a');
  // Lightning bolt inside badge
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(innerX + 24, cursorY + 9);
  ctx.lineTo(innerX + 13, cursorY + 23);
  ctx.lineTo(innerX + 21, cursorY + 23);
  ctx.lineTo(innerX + 18, cursorY + 34);
  ctx.lineTo(innerX + 29, cursorY + 20);
  ctx.lineTo(innerX + 21, cursorY + 20);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 28px "Space Grotesk", sans-serif';
  ctx.fillText('RACHA', innerX + 56, cursorY + 27);

  drawRoundedCard(ctx, innerX + 162, cursorY + 6, 178, 28, 7, '#161a08', '#313d0c');
  ctx.fillStyle = '#d8f23a';
  ctx.font = '700 12px "Space Grotesk", sans-serif';
  ctx.fillText('TARJETA DE DISCIPLINA', innerX + 174, cursorY + 24);

  // Date & User right-aligned
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 16px "Space Grotesk", sans-serif';
  ctx.fillText(data.userName || 'Modo Local', innerX + innerW, cursorY + 18);
  ctx.fillStyle = '#8a8a8a';
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.fillText(data.today, innerX + innerW, cursorY + 38);
  ctx.textAlign = 'left';

  cursorY += 72;

  // KPI Grid (4 across in landscape, 2x2 in portrait)
  const kpiGap = 16;
  const kpiCols = isPortrait ? 2 : 4;
  const kpiW = (innerW - kpiGap * (kpiCols - 1)) / kpiCols;
  const kpiH = 122;

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
      label: 'MEDALLAS',
      value: `${data.globalStats.medals.filter((m) => m.unlocked).length}/3`,
      sub: data.globalStats.medals
        .map((m) => `${m.days}d ${m.unlocked ? '✓' : '·'}`)
        .join('  '),
      accent: true,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const col = idx % kpiCols;
    const row = Math.floor(idx / kpiCols);
    const kx = innerX + col * (kpiW + kpiGap);
    const ky = cursorY + row * (kpiH + kpiGap);

    drawRoundedCard(ctx, kx, ky, kpiW, kpiH, 16, '#0b0b0b', '#1c1c1c');
    ctx.fillStyle = '#8a8a8a';
    ctx.font = '600 11px "Space Grotesk", sans-serif';
    ctx.fillText(kpi.label, kx + 18, ky + 28);

    ctx.fillStyle = kpi.accent ? '#d8f23a' : '#ffffff';
    ctx.font = '700 36px "Space Grotesk", sans-serif';
    ctx.fillText(kpi.value, kx + 18, ky + 76);

    ctx.fillStyle = '#8a8a8a';
    ctx.font = '500 13px "Space Grotesk", sans-serif';
    drawTruncatedText(ctx, kpi.sub, kx + 18, ky + 102, kpiW - 36);
  });

  cursorY += (isPortrait ? 2 : 1) * kpiH + (isPortrait ? kpiGap : 0) + 22;

  // Middle Section: Heatmap (left or top) + Habits Summary (right or bottom)
  if (!isPortrait) {
    const leftW = 540;
    const rightW = innerW - leftW - 18;
    const boxH = 264;

    // Heatmap Box
    drawRoundedCard(ctx, innerX, cursorY, leftW, boxH, 18, '#0b0b0b', '#1c1c1c');
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px "Space Grotesk", sans-serif';
    ctx.fillText('MAPA DE CONSISTENCIA (16 SEMANAS)', innerX + 22, cursorY + 32);
    ctx.fillStyle = '#8a8a8a';
    ctx.font = '400 12px "Space Grotesk", sans-serif';
    ctx.fillText('112 días registrados en tiempo local', innerX + 22, cursorY + 52);

    const cellSize = 22;
    const cellGap = 7;
    const gridX = innerX + 26;
    const gridY = cursorY + 70;
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
          HEATMAP_FILLS[lvl]
        );
      }
    }

    // Habits Box
    const rightX = innerX + leftW + 18;
    drawRoundedCard(ctx, rightX, cursorY, rightW, boxH, 18, '#0b0b0b', '#1c1c1c');
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px "Space Grotesk", sans-serif';
    ctx.fillText('RUTINAS Y RACHAS ACTIVAS', rightX + 22, cursorY + 32);

    const visibleHabits = data.habitSummaries.slice(0, 5);
    visibleHabits.forEach((h, i) => {
      const rowY = cursorY + 58 + i * 38;
      drawRoundedCard(ctx, rightX + 20, rowY, rightW - 40, 32, 8, '#121212');
      ctx.fillStyle = '#d8f23a';
      ctx.font = '700 11px "Space Grotesk", sans-serif';
      ctx.fillText(h.category.toUpperCase(), rightX + 32, rowY + 20);

      ctx.fillStyle = '#ffffff';
      ctx.font = '500 13px "Space Grotesk", sans-serif';
      const title = data.showHabitNames ? h.name : `Hábito #${i + 1}`;
      drawTruncatedText(ctx, title, rightX + 112, rowY + 20, rightW - 220);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#d8f23a';
      ctx.font = '700 13px "Space Grotesk", sans-serif';
      ctx.fillText(`${h.streak} d`, rightX + rightW - 32, rowY + 20);
      ctx.textAlign = 'left';
    });

    cursorY += boxH + 22;
  } else {
    // Portrait Layout
    const hmH = 310;
    drawRoundedCard(ctx, innerX, cursorY, innerW, hmH, 18, '#0b0b0b', '#1c1c1c');
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 15px "Space Grotesk", sans-serif';
    ctx.fillText('MAPA DE CONSISTENCIA (16 SEMANAS)', innerX + 24, cursorY + 34);

    const cellSize = 34;
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
          HEATMAP_FILLS[lvl]
        );
      }
    }

    cursorY += hmH + 20;

    const listH = 420;
    drawRoundedCard(ctx, innerX, cursorY, innerW, listH, 18, '#0b0b0b', '#1c1c1c');
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 15px "Space Grotesk", sans-serif';
    ctx.fillText('RUTINAS Y RACHAS ACTIVAS', innerX + 24, cursorY + 36);

    const visibleHabits = data.habitSummaries.slice(0, 6);
    visibleHabits.forEach((h, i) => {
      const rowY = cursorY + 62 + i * 56;
      drawRoundedCard(ctx, innerX + 22, rowY, innerW - 44, 46, 12, '#121212');
      ctx.fillStyle = '#d8f23a';
      ctx.font = '700 12px "Space Grotesk", sans-serif';
      ctx.fillText(h.category.toUpperCase(), innerX + 38, rowY + 28);

      ctx.fillStyle = '#ffffff';
      ctx.font = '500 16px "Space Grotesk", sans-serif';
      const title = data.showHabitNames ? h.name : `Hábito #${i + 1}`;
      drawTruncatedText(ctx, title, innerX + 135, rowY + 28, innerW - 290);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#d8f23a';
      ctx.font = '700 16px "Space Grotesk", sans-serif';
      ctx.fillText(`${h.streak} d`, innerX + innerW - 38, rowY + 28);
      ctx.textAlign = 'left';
    });

    cursorY += listH + 24;
  }

  // Footer Reminder Quote
  const noteText =
    data.note.trim() || 'La consistencia diaria supera a la intensidad ocasional.';
  ctx.fillStyle = '#d8f23a';
  ctx.font = '500 15px "Space Grotesk", sans-serif';
  drawTruncatedText(ctx, `“${noteText}”`, innerX, height - pad - 28, innerW - 180);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#555555';
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillText('RACHA HABITS', innerX + innerW, height - pad - 28);
  ctx.textAlign = 'left';
}
