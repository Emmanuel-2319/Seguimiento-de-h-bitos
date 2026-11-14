import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { CadenceType, HabitCategory } from '../types';
import { calculateHabitStats } from '../utils/streak';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  appliedActions?: string[];
}

type CoachAction =
  | {
      key: string;
      type: 'create';
      name: string;
      category: HabitCategory;
      cadence: CadenceType;
      targetValue: number;
      unit: string;
    }
  | {
      key: string;
      type: 'adjust_goal';
      name: string;
      monthlyGoal: number;
    };

const CHAT_STORAGE_PREFIX = 'racha_chat_history_v1_';

const INITIAL_GREETING: ChatMessage = {
  id: 'welcome',
  role: 'model',
  text: 'Hola, soy Coach Racha. Puedo analizar tus rachas activas, ayudarte a proteger tus días de gracia o proponerte hábitos nuevos con creación directa. ¿Qué revisamos hoy?',
};

const QUICK_PROMPTS = [
  'Analiza mis rachas actuales',
  '¿Cómo protejo mi racha hoy?',
  'Sugiere un hábito de estudio',
];

function loadChatHistory(userId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_PREFIX}${userId}`);
    if (!raw) return [INITIAL_GREETING];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(-30);
  } catch {
    // Ignore storage error
  }
  return [INITIAL_GREETING];
}

function parseCoachDirectives(rawText: string): {
  cleanText: string;
  actions: CoachAction[];
} {
  const actions: CoachAction[] = [];
  const validCategories: HabitCategory[] = ['salud', 'estudio', 'trabajo', 'personal'];
  const validCadences: CadenceType[] = ['diario', 'laborables', 'semanal'];

  const cleanText = rawText
    .replace(/\[\[CREAR_HABITO\|([^\]]+)\]\]/g, (_match, inner: string) => {
      const parts = inner.split('|').map((s) => s.trim());
      const name = parts[0] || 'Nuevo hábito';
      const cat = validCategories.includes(parts[1] as HabitCategory)
        ? (parts[1] as HabitCategory)
        : 'personal';
      const cad = validCadences.includes(parts[2] as CadenceType)
        ? (parts[2] as CadenceType)
        : 'diario';
      const targetValue = Math.max(1, Number(parts[3]) || 15);
      const unit = parts[4] || 'min';
      actions.push({
        key: `create::${name}`,
        type: 'create',
        name,
        category: cat,
        cadence: cad,
        targetValue,
        unit,
      });
      return '';
    })
    .replace(/\[\[AJUSTAR_META\|([^\]]+)\]\]/g, (_match, inner: string) => {
      const parts = inner.split('|').map((s) => s.trim());
      const name = parts[0] || '';
      const monthlyGoal = Math.max(1, Math.min(31, Number(parts[1]) || 20));
      if (name) {
        actions.push({
          key: `goal::${name}::${monthlyGoal}`,
          type: 'adjust_goal',
          name,
          monthlyGoal,
        });
      }
      return '';
    })
    .trim();

  return { cleanText, actions };
}

function buildLocalCoachReply(
  prompt: string,
  context: {
    userName: string;
    today: string;
    todayCompletionPct: number;
    consistencyPct: number;
    maxStreak: number;
    habits: Array<{
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
): string {
  const lower = prompt.toLowerCase();
  const pending = context.habits.filter((h) => h.todayStatus !== 'hecho');
  const top = [...context.habits].sort((a, b) => b.currentStreak - a.currentStreak)[0];
  const lagging = [...context.habits].sort(
    (a, b) =>
      a.monthlyCompleted / Math.max(1, a.monthlyGoal) -
      b.monthlyCompleted / Math.max(1, b.monthlyGoal)
  )[0];

  if (lower.includes('estudio') || lower.includes('crear') || lower.includes('nuevo') || lower.includes('sugiere')) {
    return [
      `Para reforzar tu bloque de estudio sin saturarte, empieza con una micro-sesión diaria fija de 20 minutos tras tu rutina principal:`,
      `• Consistencia actual: ${context.consistencyPct}% (${context.habits.length} hábitos activos).`,
      `• Regla de oro: 20 min cumplidos valen más que 2 horas esporádicas.`,
      `[[CREAR_HABITO|Bloque de Estudio Enfocado|estudio|diario|20|min]]`,
    ].join('\n');
  }

  if (lower.includes('protejo') || lower.includes('hoy') || lower.includes('gracia')) {
    if (pending.length === 0) {
      return `¡Excelente, ${context.userName}! Ya completaste el 100% de tus hábitos hoy (${context.today}). Tu racha máxima de ${context.maxStreak}d está totalmente a salvo.`;
    }
    const graceProtected = pending.filter((h) => h.graceUsedToday);
    return [
      `Hoy (${context.today}) te quedan ${pending.length} hábito(s) por cerrar:`,
      ...pending.slice(0, 3).map((h) => `• ${h.name} (racha ${h.currentStreak}d, gracia ${h.graceDays}d)`),
      graceProtected.length > 0
        ? `Atención: ${graceProtected[0].name} está usando día de gracia hoy. Complétalo antes de medianoche para no consumirla.`
        : `Prioriza completar primero el hábito con mayor racha (${top?.name ?? 'tu rutina principal'}).`,
    ].join('\n');
  }

  const lines = [
    `Resumen en tiempo real (${context.today}):`,
    `• Cumplimiento de hoy: ${context.todayCompletionPct}% · Consistencia 112d: ${context.consistencyPct}%`,
    top
      ? `• Racha líder: «${top.name}» con ${top.currentStreak} días consecutivos.`
      : `• Aún no tienes hábitos activos registrados.`,
  ];

  if (lagging && lagging.monthlyGoal > 4 && lagging.monthlyCompleted < lagging.monthlyGoal * 0.5) {
    const suggested = Math.max(8, Math.round(lagging.monthlyGoal * 0.75));
    lines.push(
      `• «${lagging.name}» va al ${Math.round((lagging.monthlyCompleted / lagging.monthlyGoal) * 100)}% de su meta mensual (${lagging.monthlyCompleted}/${lagging.monthlyGoal}). Puedes ajustar la meta a ${suggested} días para ganar impulso:`
    );
    lines.push(`[[AJUSTAR_META|${lagging.name}|${suggested}]]`);
  }

  return lines.join('\n');
}

export const HabitChatbot: React.FC = () => {
  const {
    user,
    today,
    entities,
    activities,
    globalStats,
    createHabit,
    updateHabit,
    showToast,
  } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadChatHistory(user.id)
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(loadChatHistory(user.id));
  }, [user.id]);

  useEffect(() => {
    try {
      localStorage.setItem(
        `${CHAT_STORAGE_PREFIX}${user.id}`,
        JSON.stringify(messages.slice(-30))
      );
    } catch {
      // Ignore storage error
    }
  }, [messages, user.id]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, isLoading]);

  const habitContext = useMemo(() => {
    return {
      userName: user.name,
      timezone: user.timezone,
      today,
      todayCompletionPct: globalStats.todayCompletionPct,
      consistencyPct: globalStats.consistencyPct,
      maxStreak: globalStats.maxStreak,
      habits: entities.map((entity) => {
        const stats = calculateHabitStats(entity, activities, today);
        return {
          name: entity.name,
          category: entity.category,
          currentStreak: stats.currentStreak,
          bestStreak: stats.bestStreak,
          graceDays: entity.graceDays,
          graceUsedToday: stats.graceUsedToday,
          todayStatus: stats.todayStatus,
          monthlyCompleted: stats.monthlyCompleted,
          monthlyGoal: entity.monthlyGoal,
          unit: entity.unit,
        };
      }),
    };
  }, [user.name, user.timezone, today, globalStats, entities, activities]);

  const handleApplyAction = (msgId: string, action: CoachAction) => {
    if (action.type === 'create') {
      createHabit({
        name: action.name,
        category: action.category,
        habitType: 'construir',
        cadence: action.cadence,
        startDate: today,
        targetValue: action.targetValue,
        unit: action.unit,
        monthlyGoal: action.cadence === 'semanal' ? 4 : 20,
        graceDays: 1,
      });
    } else {
      const target = entities.find(
        (e) => e.name.toLowerCase() === action.name.toLowerCase()
      );
      if (!target) {
        showToast(`No se encontró el hábito «${action.name}»`);
        return;
      }
      updateHabit(target.id, { monthlyGoal: action.monthlyGoal });
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              appliedActions: [...(m.appliedActions ?? []), action.key],
            }
          : m
      )
    );
  };

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMessage: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);

    try {
      const apiMessages = nextHistory
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          habitContext,
        }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        if (res.status === 503 || res.status >= 500) {
          const fallbackReply = buildLocalCoachReply(trimmed, habitContext);
          setMessages((prev) => [
            ...prev,
            {
              id: `m_${Date.now()}`,
              role: 'model',
              text: fallbackReply,
            },
          ]);
          return;
        }
        throw new Error(data.error || 'No se pudo obtener respuesta del asistente.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'model',
          text: data.reply!,
        },
      ]);
    } catch {
      // Offline / connection error fallback using real local metrics
      const fallbackReply = buildLocalCoachReply(trimmed, habitContext);
      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'model',
          text: fallbackReply,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleReset = () => {
    setMessages([INITIAL_GREETING]);
    setError(null);
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir asistente Coach Racha"
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-2 bg-[#d8f23a] hover:bg-[#c8e22a] text-black font-semibold text-xs px-4 py-3 rounded-2xl shadow-2xl border border-[#e7f878] transition-transform hover:scale-[1.02] cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 stroke-[2.25]" />
          <span className="whitespace-nowrap">Coach Racha</span>
        </button>
      )}

      {/* Multi-turn Chat Drawer */}
      {isOpen && (
        <aside
          aria-label="Asistente de hábitos Coach Racha"
          className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-6 sm:right-6 z-50 sm:w-[400px] h-[72vh] max-h-[560px] bg-[#0b0b0b] border border-[#242424] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-[#1c1c1c] bg-[#0f0f0f] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#d8f23a] text-black flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-white truncate">Coach Racha</h2>
                <p className="text-[11px] text-[#8a8a8a] truncate">
                  Asistente personal de consistencia
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                title="Reiniciar conversación"
                aria-label="Reiniciar conversación"
                className="p-1.5 rounded-lg text-[#8a8a8a] hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Cerrar asistente"
                aria-label="Cerrar asistente"
                className="p-1.5 rounded-lg text-[#8a8a8a] hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Message Thread */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#080808]"
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const parsed = isUser
                ? { cleanText: msg.text, actions: [] }
                : parseCoachDirectives(msg.text);

              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap space-y-2 ${
                      isUser
                        ? 'bg-[#d8f23a] text-black font-medium rounded-br-sm'
                        : 'bg-[#141414] border border-[#222222] text-[#ececec] rounded-bl-sm'
                    }`}
                  >
                    <div>{parsed.cleanText}</div>

                    {parsed.actions.length > 0 && (
                      <div className="pt-1.5 space-y-1.5 border-t border-[#262626]">
                        {parsed.actions.map((action) => {
                          const applied = msg.appliedActions?.includes(action.key);
                          return (
                            <button
                              key={action.key}
                              type="button"
                              disabled={applied}
                              onClick={() => handleApplyAction(msg.id, action)}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                                applied
                                  ? 'bg-[#1a2208] border border-[#36470e] text-[#d8f23a]'
                                  : 'bg-[#d8f23a] hover:bg-[#c8e22a] text-black'
                              }`}
                            >
                              <span className="inline-flex items-center gap-1.5 truncate">
                                {applied ? (
                                  <Check className="w-3.5 h-3.5 shrink-0" />
                                ) : action.type === 'create' ? (
                                  <Plus className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span className="truncate">
                                  {applied
                                    ? 'Aplicado'
                                    : action.type === 'create'
                                    ? `Crear «${action.name}» (${action.targetValue} ${action.unit})`
                                    : `Ajustar meta de «${action.name}» a ${action.monthlyGoal}d`}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#141414] border border-[#222222] text-[#8a8a8a] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d8f23a]" />
                  <span>Analizando tus hábitos...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl px-3 py-2">
                {error}
              </div>
            )}
          </div>

          {/* Quick Suggestion Prompts */}
          {messages.length <= 2 && !isLoading && (
            <div className="px-3 py-2 border-t border-[#181818] bg-[#0b0b0b] flex flex-wrap gap-1.5 shrink-0">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="text-[11px] bg-[#141414] hover:bg-[#1c1c1c] border border-[#242424] hover:border-[#d8f23a]/60 text-[#d4d4d4] hover:text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-[#1c1c1c] bg-[#0b0b0b] flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregúntale a Coach Racha..."
              disabled={isLoading}
              className="flex-1 min-w-0 bg-[#141414] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3 py-2.5 outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Enviar mensaje"
              className="w-9 h-9 rounded-xl bg-[#d8f23a] hover:bg-[#c8e22a] disabled:opacity-40 text-black flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
};
