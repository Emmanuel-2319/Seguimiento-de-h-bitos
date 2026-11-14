import React, { Suspense, lazy } from 'react';
import { AuthModal } from './components/AuthModal';
import { CalendarView } from './components/CalendarView';
import { Dashboard } from './components/Dashboard';
import { HabitChatbot } from './components/HabitChatbot';
import { HabitDetailModal } from './components/HabitDetailModal';
import { HabitModal } from './components/HabitModal';
import { Navbar } from './components/Navbar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SettingsView } from './components/SettingsView';
import { ShareCardModal } from './components/ShareCardModal';
import { StoreProvider, useStore } from './hooks/useStore';

const DisciplineGame = lazy(() =>
  import('./components/DisciplineGame').then((m) => ({ default: m.DisciplineGame }))
);

const RachaShell: React.FC = () => {
  const { activeView, setActiveView, toastMessage } = useStore();

  if (activeView === 'minijuego') {
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 z-50 bg-[#050811] text-white flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-[#d8f23a] border-t-transparent animate-spin" />
            <p className="text-xs font-medium text-[#8a94a6]">
              Cargando Santuario 3D...
            </p>
          </div>
        }
      >
        <DisciplineGame onExit={() => setActiveView('tablero')} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28 md:pb-20">
        {activeView === 'tablero' && <Dashboard />}
        {activeView === 'calendario' && <CalendarView />}
        {activeView === 'ajustes' && <SettingsView />}
      </main>

      <HabitModal />
      <HabitDetailModal />
      <AuthModal />
      <ShareCardModal />
      <HabitChatbot />
      <OfflineIndicator />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-32 md:bottom-20 right-4 sm:right-6 z-50 bg-[#141907] border border-[#d8f23a] text-[#d8f23a] text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <RachaShell />
    </StoreProvider>
  );
}
