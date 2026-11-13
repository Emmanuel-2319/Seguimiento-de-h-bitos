import React from 'react';
import { AuthModal } from './components/AuthModal';
import { CalendarView } from './components/CalendarView';
import { Dashboard } from './components/Dashboard';
import { DisciplineGame } from './components/DisciplineGame';
import { HabitChatbot } from './components/HabitChatbot';
import { HabitDetailModal } from './components/HabitDetailModal';
import { HabitModal } from './components/HabitModal';
import { Navbar } from './components/Navbar';
import { SettingsView } from './components/SettingsView';
import { ShareCardModal } from './components/ShareCardModal';
import { StoreProvider, useStore } from './hooks/useStore';

const RachaShell: React.FC = () => {
  const { activeView, setActiveView, toastMessage } = useStore();

  if (activeView === 'minijuego') {
    return <DisciplineGame onExit={() => setActiveView('tablero')} />;
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20">
        {activeView === 'tablero' && <Dashboard />}
        {activeView === 'calendario' && <CalendarView />}
        {activeView === 'ajustes' && <SettingsView />}
      </main>

      <HabitModal />
      <HabitDetailModal />
      <AuthModal />
      <ShareCardModal />
      <HabitChatbot />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 sm:bottom-20 right-4 sm:right-6 z-50 bg-[#141907] border border-[#d8f23a] text-[#d8f23a] text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl"
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
