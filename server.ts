import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const SYNC_STORE_FILE = path.join(__dirname, '.racha-sync-store.json');

interface ChatHistoryMessage {
  role: 'user' | 'model';
  text: string;
}

interface HabitContextPayload {
  userName?: string;
  timezone?: string;
  today?: string;
  todayCompletionPct?: number;
  consistencyPct?: number;
  maxStreak?: number;
  habits?: Array<{
    name: string;
    category: string;
    currentStreak: number;
    bestStreak: number;
    graceDays: number;
    graceUsedToday: boolean;
    todayStatus: string;
    monthlyCompleted: number;
    monthlyGoal: number;
    unit: string;
  }>;
}

function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemInstruction(habitContext?: HabitContextPayload): string {
  const basePrompt = [
    'Eres "Coach Racha", el asistente personal de hábitos y consistencia integrado en la aplicación Racha.',
    'Hablas siempre en español de España (tuteo), con un tono cercano, claro, práctico y directo.',
    'Tus objetivos son:',
    '1. Analizar las rachas activas, días de gracia (graceDays), metas mensuales y consistencia global del usuario.',
    '2. Dar recomendaciones accionables y realistas para evitar romper rachas y alcanzar los hitos de medallas (7, 30 y 100 días).',
    '3. Responder de forma concisa y bien estructurada (párrafos cortos o listas breves, sin rodeos).',
    '4. Basarte exclusivamente en los datos reales del contexto cuando menciones métricas del usuario.',
    '5. Si el usuario pide crear un hábito nuevo o ajustar la meta mensual de uno existente, puedes añadir al final de tu respuesta una única línea con el formato exacto:',
    '   [[CREAR_HABITO|Nombre corto|salud|diario|20|min]] (categorías válidas: salud, estudio, trabajo, personal; cadencias: diario, laborables, semanal)',
    '   o [[AJUSTAR_META|Nombre exacto del hábito|24]]',
  ].join('\n');

  if (!habitContext) return basePrompt;

  const habitsSummary = (habitContext.habits ?? [])
    .map(
      (h) =>
        `- ${h.name} (${h.category}): racha actual ${h.currentStreak}d (mejor ${h.bestStreak}d), gracia ${h.graceDays}d${h.graceUsedToday ? ' [gracia activa hoy]' : ''}, hoy: ${h.todayStatus}, mes: ${h.monthlyCompleted}/${h.monthlyGoal} ${h.unit}`
    )
    .join('\n');

  return [
    basePrompt,
    '',
    'CONTEXTO ACTUAL DEL USUARIO:',
    `- Usuario: ${habitContext.userName ?? 'Usuario'}`,
    `- Fecha local (${habitContext.timezone ?? 'UTC'}): ${habitContext.today ?? 'hoy'}`,
    `- Cumplimiento de hoy: ${habitContext.todayCompletionPct ?? 0}%`,
    `- Consistencia global (112 días): ${habitContext.consistencyPct ?? 0}%`,
    `- Racha máxima activa: ${habitContext.maxStreak ?? 0} días`,
    '- Hábitos registrados:',
    habitsSummary || 'Sin hábitos registrados todavía.',
  ].join('\n');
}

interface SyncedWorkspaceRecord {
  syncCode: string;
  updatedAt: string;
  payload: unknown;
}

async function readSyncStore(): Promise<Record<string, SyncedWorkspaceRecord>> {
  try {
    const raw = await fs.readFile(SYNC_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, SyncedWorkspaceRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeSyncStore(store: Record<string, SyncedWorkspaceRecord>): Promise<void> {
  await fs.writeFile(SYNC_STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function normalizeSyncCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/sync/:syncCode', async (req, res) => {
    try {
      const code = normalizeSyncCode(req.params.syncCode || '');
      if (code.length < 8) {
        return res.status(400).json({ error: 'Código de sincronización inválido.' });
      }
      const store = await readSyncStore();
      const record = store[code];
      if (!record) {
        return res.status(404).json({ error: 'No existe respaldo en la nube para ese código.' });
      }
      return res.json(record);
    } catch {
      return res.status(500).json({ error: 'Error al leer el respaldo en la nube.' });
    }
  });

  app.put('/api/sync/:syncCode', async (req, res) => {
    try {
      const code = normalizeSyncCode(req.params.syncCode || '');
      if (code.length < 8) {
        return res.status(400).json({ error: 'Código de sincronización inválido.' });
      }
      const payload = req.body?.payload;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Payload de sincronización inválido.' });
      }
      const store = await readSyncStore();
      const updatedAt = new Date().toISOString();
      store[code] = { syncCode: code, updatedAt, payload };
      await writeSyncStore(store);
      return res.json({ ok: true, syncCode: code, updatedAt });
    } catch {
      return res.status(500).json({ error: 'Error al guardar el respaldo en la nube.' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const ai = createAiClient();
      if (!ai) {
        return res.status(503).json({
          error:
            'El servicio de Gemini no tiene configurada la clave GEMINI_API_KEY en el entorno del servidor.',
        });
      }

      const body = req.body as {
        messages?: ChatHistoryMessage[];
        habitContext?: HabitContextPayload;
      };

      const incomingMessages = Array.isArray(body?.messages) ? body.messages : [];
      if (incomingMessages.length === 0) {
        return res.status(400).json({ error: 'Debes enviar al menos un mensaje.' });
      }

      const lastMessage = incomingMessages[incomingMessages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user' || !lastMessage.text?.trim()) {
        return res.status(400).json({ error: 'El último mensaje debe ser del usuario.' });
      }

      const priorHistory = incomingMessages.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const chat = ai.chats.create({
        model: 'gemini-4-hydrogen',
        config: {
          systemInstruction: buildSystemInstruction(body.habitContext),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
        history: priorHistory,
      });

      const response = await chat.sendMessage({
        message: lastMessage.text.trim(),
      });

      const replyText = (response.text ?? '').trim();
      if (!replyText) {
        return res.status(502).json({
          error: 'El asistente no devolvió contenido. Inténtalo de nuevo.',
        });
      }

      return res.json({ reply: replyText });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error inesperado al consultar el asistente.';
      const status =
        message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
          ? 429
          : message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : 500;
      return res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Racha server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
