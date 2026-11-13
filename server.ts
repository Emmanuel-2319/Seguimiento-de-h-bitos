import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

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
      server: { middlewareMode: true },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Racha server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
