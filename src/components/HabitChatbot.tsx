import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, MessageSquare, RotateCcw, Send, X } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { calculateHabitStats } from '../utils/streak';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const INITIAL_GREETING: ChatMessage = {
  id: 'welcome',
  role: 'model',
  text: 'Hola, soy Coach Racha. Puedo analizar tus rachas activas, ayudarte a gestionar tus días de gracia o proponerte un plan realista para mejorar tu consistencia. ¿Qué revisamos hoy?',
};

const QUICK_PROMPTS = [
  'Analiza mis rachas actuales',
  '¿Cómo protejo mi racha hoy?',
  'Plan para subir mi consistencia',
];

export const HabitChatbot: React.FC = () => {
  const { user, today, entities, activities, globalStats } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

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
      // Exclude static client greeting from API history if it's the very first message
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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error de conexión con el asistente.'
      );
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
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 bg-[#d8f23a] hover:bg-[#c8e22a] text-black font-semibold text-xs px-4 py-3 rounded-2xl shadow-2xl border border-[#e7f878] transition-transform hover:scale-[1.02] cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 stroke-[2.25]" />
          <span className="whitespace-nowrap">Coach Racha</span>
        </button>
      )}

      {/* Multi-turn Chat Drawer */}
      {isOpen && (
        <aside
          aria-label="Asistente de hábitos Coach Racha"
          className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-6 sm:right-6 z-50 sm:w-[390px] h-[72vh] max-h-[540px] bg-[#0b0b0b] border border-[#242424] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
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
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-[#d8f23a] text-black font-medium rounded-br-sm'
                        : 'bg-[#141414] border border-[#222222] text-[#ececec] rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
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
