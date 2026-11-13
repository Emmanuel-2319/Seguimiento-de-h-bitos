import React from 'react';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  Gamepad2,
  LayoutGrid,
  LogOut,
  Settings,
  User as UserIcon,
  Zap,
} from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { ActiveView } from '../types';

export const Navbar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    isAuthenticated,
    user,
    syncLabel,
    exportJson,
    exportCsv,
    openAuthModal,
    logoutAccount,
  } = useStore();

  const navItems: Array<{ id: ActiveView; label: string; icon: React.ReactNode }> = [
    { id: 'tablero', label: 'Tablero', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { id: 'calendario', label: 'Calendario mensual', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'minijuego', label: 'Minijuego', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
    { id: 'ajustes', label: 'Ajustes', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#1c1c1c] bg-black/95 backdrop-blur-sm">
      <div className="max-w-[1380px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 overflow-x-auto">
        {/* Brand */}
        <button
          type="button"
          onClick={() => setActiveView('tablero')}
          className="flex items-center gap-2.5 shrink-0 group cursor-pointer focus:outline-none"
        >
          <span className="w-7 h-7 rounded-lg bg-[#d8f23a] flex items-center justify-center text-black transition-transform group-hover:scale-105">
            <Zap className="w-4 h-4 fill-black stroke-black" />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-white whitespace-nowrap">
            RACHA
          </span>
          <span className="bg-[#1b2207] border border-[#313d0c] text-[#d8f23a] text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded whitespace-nowrap">
            HABITS
          </span>
        </button>

        {/* Primary Nav */}
        <nav
          aria-label="Navegación principal"
          className="flex items-center gap-1 bg-[#0b0b0b] border border-[#1c1c1c] rounded-xl p-1 shrink-0"
        >
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#d8f23a] text-black font-semibold'
                    : 'text-[#8a8a8a] hover:text-white hover:bg-[#141414]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions: Sync + Exports + Auth */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden xl:flex items-center gap-2 bg-[#0b0b0b] border border-[#1c1c1c] rounded-xl px-3 py-1.5 text-[11px] text-[#8a8a8a] whitespace-nowrap shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8f23a]" aria-hidden="true" />
            <span className="font-mono tracking-tight">
              {isAuthenticated ? 'D1 SYNC' : 'LOCAL / D1 READY'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Sync: {syncLabel}</span>
          </div>

          <button
            type="button"
            onClick={exportJson}
            title="Exportar copia completa en JSON"
            className="flex items-center gap-1.5 bg-[#0b0b0b] border border-[#1c1c1c] hover:border-[#333333] text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#8a8a8a]" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={exportCsv}
            title="Exportar historial de actividades en CSV"
            className="flex items-center gap-1.5 bg-[#0b0b0b] border border-[#1c1c1c] hover:border-[#333333] text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#8a8a8a]" />
            <span>CSV</span>
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveView('ajustes')}
                className="flex items-center gap-2 bg-[#141907] border border-[#34420e] hover:border-[#d8f23a] text-[#d8f23a] text-xs font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span className="max-w-[110px] truncate">{user.name}</span>
              </button>
              <button
                type="button"
                onClick={logoutAccount}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="flex items-center justify-center bg-[#0b0b0b] border border-[#1c1c1c] hover:border-[#333333] text-[#8a8a8a] hover:text-white p-2 rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="flex items-center gap-1.5 bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Iniciar sesión</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
