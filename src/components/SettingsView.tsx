import React, { useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Check,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Globe,
  ImageDown,
  KeyRound,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { COMMON_TIMEZONES } from '../utils/date';

export const SettingsView: React.FC = () => {
  const {
    user,
    today,
    isAuthenticated,
    updateTimezone,
    exportJson,
    exportCsv,
    importJson,
    resetDemo,
    openAuthModal,
    openShareModal,
    showToast,
    notificationPrefs,
    notificationPermission,
    pendingTodayCount,
    enableNotifications,
    disableNotifications,
    updateReminderTime,
    sendTestNotification,
  } = useStore();

  const [copiedKey, setCopiedKey] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(user.recoveryKey);
      setCopiedKey(true);
      showToast('Clave de recuperación copiada al portapapeles');
      window.setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      showToast('Copia la clave manualmente: ' + user.recoveryKey);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importJson(String(reader.result || ''));
      } catch (err) {
        setImportError(
          err instanceof Error ? err.message : 'No se pudo importar el archivo JSON.'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Ajustes</h1>
        <p className="text-xs text-[#8a8a8a] mt-0.5">
          Configura tu zona horaria, respaldo D1 local y credenciales de recuperación.
        </p>
      </div>

      {/* Zona Horaria (LocalDate YYYY-MM-DD) */}
      <section className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#161a08] border border-[#2d360d] flex items-center justify-center text-[#d8f23a] shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Zona horaria y fecha local</h2>
            <p className="text-xs text-[#8a8a8a] mt-0.5">
              Todas las marcas se guardan como fecha local estricta (YYYY-MM-DD). Fecha actual
              calculada: <span className="font-mono text-[#d8f23a]">{today}</span>
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="timezone-select"
            className="block text-xs font-medium text-[#8a8a8a] mb-2"
          >
            Zona horaria activa
          </label>
          <select
            id="timezone-select"
            value={user.timezone}
            onChange={(e) => updateTimezone(e.target.value)}
            className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
          >
            {!COMMON_TIMEZONES.some((tz) => tz.value === user.timezone) && (
              <option value={user.timezone}>{user.timezone}</option>
            )}
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Recordatorios diarios con API de Notificaciones del navegador */}
      <section className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#161a08] border border-[#2d360d] flex items-center justify-center text-[#d8f23a] shrink-0">
              {notificationPrefs.enabled && notificationPermission === 'granted' ? (
                <Bell className="w-4 h-4" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Recordatorios diarios (Notificaciones locales)
              </h2>
              <p className="text-xs text-[#8a8a8a] mt-0.5">
                Recibe un aviso en tu navegador cuando queden hábitos pendientes por completar hoy (
                <span className="text-white font-semibold tabular-nums">
                  {pendingTodayCount} pendientes ahora
                </span>
                ).
              </p>
            </div>
          </div>

          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap self-start ${
              notificationPermission === 'granted'
                ? 'bg-[#161a08] border-[#34420e] text-[#d8f23a]'
                : notificationPermission === 'denied' ||
                  notificationPermission === 'unsupported'
                ? 'bg-[#2a1212] border-[#522020] text-red-400'
                : 'bg-[#141414] border-[#262626] text-[#8a8a8a]'
            }`}
          >
            Permiso:{' '}
            {notificationPermission === 'granted'
              ? 'Concedido'
              : notificationPermission === 'denied'
              ? 'Bloqueado'
              : notificationPermission === 'unsupported'
              ? 'No compatible'
              : 'Sin solicitar'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label
              htmlFor="reminder-time"
              className="block text-xs font-medium text-[#8a8a8a] mb-1.5"
            >
              Hora del aviso diario ({user.timezone})
            </label>
            <input
              id="reminder-time"
              type="time"
              value={notificationPrefs.reminderTime}
              onChange={(e) => updateReminderTime(e.target.value)}
              className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none tabular-nums"
            />
          </div>

          <div className="flex items-end gap-2">
            {notificationPrefs.enabled && notificationPermission === 'granted' ? (
              <button
                type="button"
                onClick={disableNotifications}
                className="flex-1 bg-[#141414] border border-[#2a2a2a] hover:border-red-400/60 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Desactivar avisos
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void enableNotifications()}
                className="flex-1 bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Activar avisos
              </button>
            )}

            <button
              type="button"
              onClick={() => void sendTestNotification()}
              className="bg-[#141414] border border-[#262626] hover:border-[#d8f23a] text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              Probar ahora
            </button>
          </div>
        </div>
      </section>

      {/* Cuenta y Clave de Recuperación */}
      <section className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#161a08] border border-[#2d360d] flex items-center justify-center text-[#d8f23a] shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Cuenta y clave de recuperación</h2>
              <p className="text-xs text-[#8a8a8a] mt-0.5">
                {isAuthenticated
                  ? `Sesión JWT activa como ${user.name} (${user.email}).`
                  : 'Trabajando en espacio local. Inicia sesión o crea una cuenta para obtener tu clave única de 12 caracteres.'}
              </p>
            </div>
          </div>

          {!isAuthenticated && (
            <button
              type="button"
              onClick={openAuthModal}
              className="bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Crear cuenta / Entrar
            </button>
          )}
        </div>

        {isAuthenticated && (
          <div className="bg-[#121212] border border-[#242424] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#8a8a8a]">
                Clave de recuperación (12 caracteres)
              </span>
              <p className="font-mono text-base font-bold text-[#d8f23a] tracking-widest mt-0.5">
                {user.recoveryKey}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyKey}
              className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2c2c2c] hover:border-[#d8f23a] text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              {copiedKey ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#d8f23a]" />
                  <span>Copiada</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#8a8a8a]" />
                  <span>Copiar clave</span>
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {/* Persistencia Mock D1: Exportar / Importar / Restablecer */}
      <section className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#161a08] border border-[#2d360d] flex items-center justify-center text-[#d8f23a] shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Copia de seguridad y datos (D1 Local)</h2>
            <p className="text-xs text-[#8a8a8a] mt-0.5">
              Exporta o restaura tus tablas locales (`users`, `entities`, `activities`).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={exportJson}
            className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] hover:border-[#d8f23a] text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#d8f23a]" />
            <span>Exportar JSON</span>
          </button>

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] hover:border-[#d8f23a] text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#d8f23a]" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={openShareModal}
            className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] hover:border-[#d8f23a] text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <ImageDown className="w-3.5 h-3.5 text-[#d8f23a]" />
            <span>Tarjeta PNG</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] hover:border-white text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#8a8a8a]" />
            <span>Importar JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={resetDemo}
            className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] hover:border-[#ef4444]/60 text-[#8a8a8a] hover:text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar ejemplo</span>
          </button>
        </div>

        {importError && (
          <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl px-3 py-2">
            {importError}
          </p>
        )}
      </section>
    </div>
  );
};
