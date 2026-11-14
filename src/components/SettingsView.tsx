import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Check,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Globe,
  ImageDown,
  KeyRound,
  Lock,
  RotateCcw,
  Save,
  Smartphone,
  Trash2,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { COMMON_TIMEZONES } from '../utils/date';
import { InstallButton } from './InstallButton';

export const SettingsView: React.FC = () => {
  const {
    user,
    today,
    entities,
    activities,
    globalStats,
    isAuthenticated,
    updateTimezone,
    updateWeekStart,
    updateUserName,
    updateUserPassword,
    lastExternalBackupAt,
    exportJson,
    exportCsv,
    copyBackupJson,
    importJson,
    resetDemo,
    clearWorkspace,
    deleteAccount,
    effectiveSyncCode,
    syncStatus,
    lastCloudSyncAt,
    autoSyncEnabled,
    setAutoSyncEnabled,
    linkSyncCode,
    syncUpload,
    syncDownload,
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
  const [copiedSyncCode, setCopiedSyncCode] = useState(false);
  const [copiedBackupJson, setCopiedBackupJson] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState(user.name);
  const [linkCodeInput, setLinkCodeInput] = useState('');

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);

  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNameInput(user.name);
  }, [user.id, user.name]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    updateUserName(nameInput);
  };

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

  const handleCopySyncCode = async () => {
    try {
      await navigator.clipboard.writeText(effectiveSyncCode);
      setCopiedSyncCode(true);
      showToast('Código de sincronización copiado');
      window.setTimeout(() => setCopiedSyncCode(false), 2000);
    } catch {
      showToast('Copia tu código manualmente: ' + effectiveSyncCode);
    }
  };

  const handleCopyBackupJson = async () => {
    try {
      await copyBackupJson();
      setCopiedBackupJson(true);
      window.setTimeout(() => setCopiedBackupJson(false), 2000);
    } catch {
      showToast('No se pudo copiar el respaldo JSON al portapapeles');
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    try {
      updateUserPassword(currentPwd, newPwd);
      setCurrentPwd('');
      setNewPwd('');
    } catch (err) {
      setPwdError(
        err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.'
      );
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

  const activeWeekStart = user.weekStart ?? 'lunes';

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Ajustes</h1>
        <p className="text-xs text-[#8a8a8a] mt-0.5">
          Configura tu zona horaria, sincronización multi-dispositivo, notificaciones y copias de seguridad.
        </p>
      </div>

      {/* Perfil de usuario */}
      <section className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#161a08] border border-[#2d360d] flex items-center justify-center text-[#d8f23a] shrink-0">
            <UserIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Perfil y nombre visible</h2>
            <p className="text-xs text-[#8a8a8a] mt-0.5">
              Personaliza el nombre que aparece en la barra superior y en tu Tarjeta de Disciplina PNG.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveName} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            required
            maxLength={40}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            aria-label="Nombre de perfil"
            placeholder="Tu nombre..."
            className="flex-1 bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
          />
          <button
            type="submit"
            disabled={!nameInput.trim() || nameInput.trim() === user.name}
            className="inline-flex items-center justify-center gap-1.5 bg-[#d8f23a] hover:bg-[#c8e22a] disabled:opacity-40 text-black text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar nombre</span>
          </button>
        </form>
      </section>

      {/* Instalar Aplicación (PWA) */}
      <section className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#161a08] border border-[#2d360d] flex items-center justify-center text-[#d8f23a] shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Instalar Racha en tu dispositivo</h2>
            <p className="text-xs text-[#8a8a8a] mt-0.5">
              Descarga Racha en tu celular o computador para abrirla como app independiente y usarla sin conexión.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <InstallButton variant="settings" />
        </div>
      </section>

      {/* Zona Horaria & Inicio de Semana */}
      <section className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#161a08] border border-[#2d360d] flex items-center justify-center text-[#d8f23a] shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Zona horaria y calendario</h2>
            <p className="text-xs text-[#8a8a8a] mt-0.5">
              Todas las marcas se guardan como fecha local estricta (YYYY-MM-DD). Fecha actual
              calculada: <span className="font-mono text-[#d8f23a]">{today}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div>
            <span className="block text-xs font-medium text-[#8a8a8a] mb-2">
              La semana empieza en
            </span>
            <div className="grid grid-cols-2 gap-1.5 bg-[#121212] border border-[#242424] rounded-xl p-1">
              <button
                type="button"
                onClick={() => updateWeekStart('lunes')}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeWeekStart === 'lunes'
                    ? 'bg-[#d8f23a] text-black'
                    : 'text-[#8a8a8a] hover:text-white'
                }`}
              >
                Lunes
              </button>
              <button
                type="button"
                onClick={() => updateWeekStart('domingo')}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeWeekStart === 'domingo'
                    ? 'bg-[#d8f23a] text-black'
                    : 'text-[#8a8a8a] hover:text-white'
                }`}
              >
                Domingo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Sincronización en la nube (Multi-dispositivo) */}
      <section className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#161a08] border border-[#2d360d] flex items-center justify-center text-[#d8f23a] shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Sincronización en la nube (Multi-dispositivo)
              </h2>
              <p className="text-xs text-[#8a8a8a] mt-0.5">
                Guarda tus hábitos en el servidor usando tu código personal y recupéralos desde cualquier navegador o celular.
              </p>
            </div>
          </div>

          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap self-start ${
              syncStatus === 'synced'
                ? 'bg-[#161a08] border-[#34420e] text-[#d8f23a]'
                : syncStatus === 'error'
                ? 'bg-[#2a1212] border-[#522020] text-red-400'
                : 'bg-[#141414] border-[#262626] text-[#8a8a8a]'
            }`}
          >
            {syncStatus === 'syncing'
              ? 'Sincronizando...'
              : syncStatus === 'synced'
              ? 'Nube al día'
              : syncStatus === 'error'
              ? 'Error de red'
              : 'Sincronización manual'}
          </span>
        </div>

        <div className="bg-[#121212] border border-[#242424] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#8a8a8a]">
              Tu código de sincronización activo
            </span>
            <p className="font-mono text-base font-bold text-[#d8f23a] tracking-widest mt-0.5">
              {effectiveSyncCode}
            </p>
            {lastCloudSyncAt && (
              <p className="text-[11px] text-[#737373] mt-0.5 tabular-nums">
                Último respaldo remoto: {new Date(lastCloudSyncAt).toLocaleString('es-ES')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopySyncCode}
              className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2c2c2c] hover:border-[#d8f23a] text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              {copiedSyncCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#d8f23a]" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#8a8a8a]" />
                  <span>Copiar</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={syncStatus === 'syncing'}
              onClick={() => void syncUpload(false)}
              className="inline-flex items-center gap-1.5 bg-[#d8f23a] hover:bg-[#c8e22a] disabled:opacity-50 text-black text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>Subir a nube</span>
            </button>

            <button
              type="button"
              disabled={syncStatus === 'syncing'}
              onClick={() => void syncDownload()}
              className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2c2c2c] hover:border-[#d8f23a] disabled:opacity-50 text-white text-xs font-medium px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <CloudDownload className="w-3.5 h-3.5 text-[#d8f23a]" />
              <span>Descargar</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={linkCodeInput}
              onChange={(e) => setLinkCodeInput(e.target.value.toUpperCase())}
              placeholder="Vincular código de otro dispositivo (ej. ABCD-EFGH-JKLM)"
              aria-label="Código de otro dispositivo para vincular"
              className="flex-1 bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white font-mono text-xs rounded-xl px-3.5 py-2 outline-none"
            />
            <button
              type="button"
              disabled={linkCodeInput.replace(/[^A-Za-z0-9]/g, '').length < 8}
              onClick={() => {
                void syncDownload(linkCodeInput).then(() => {
                  linkSyncCode(linkCodeInput);
                  setLinkCodeInput('');
                });
              }}
              className="bg-[#141414] border border-[#262626] hover:border-[#d8f23a] disabled:opacity-40 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              Vincular y traer
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
              autoSyncEnabled
                ? 'bg-[#161a08] border-[#34420e] text-[#d8f23a]'
                : 'bg-[#121212] border-[#242424] text-[#8a8a8a] hover:text-white'
            }`}
          >
            Auto-sync: {autoSyncEnabled ? 'Activado' : 'Desactivado'}
          </button>
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
                Recibe un aviso mediante Service Worker cuando queden hábitos pendientes hoy (
                <span className="text-white font-semibold tabular-nums">
                  {pendingTodayCount} pendientes ahora
                </span>
                ). Se dispara al llegar la hora con la app abierta o al volver a abrir la PWA.
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

      {/* Cuenta, Contraseña y Clave de Recuperación */}
      <section className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#161a08] border border-[#2d360d] flex items-center justify-center text-[#d8f23a] shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Cuenta, contraseña y recuperación</h2>
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
          <>
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

            <form
              onSubmit={handlePasswordSubmit}
              className="bg-[#121212] border border-[#242424] rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Lock className="w-3.5 h-3.5 text-[#d8f23a]" />
                <span>Cambiar contraseña</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="password"
                  required
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Contraseña actual"
                  className="bg-[#0b0b0b] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3 py-2 outline-none"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Nueva contraseña (mín. 6)"
                  className="bg-[#0b0b0b] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3 py-2 outline-none"
                />
                <button
                  type="submit"
                  className="bg-[#1a1a1a] border border-[#2c2c2c] hover:border-[#d8f23a] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Actualizar contraseña
                </button>
              </div>
              {pwdError && <p className="text-xs text-red-400">{pwdError}</p>}
            </form>
          </>
        )}
      </section>

      {/* Respaldo Externo y Exportación JSON / CSV */}
      <section className="bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#161a08] border border-[#2d360d] flex items-center justify-center text-[#d8f23a] shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Respaldo externo y exportación (JSON / CSV)
              </h2>
              <p className="text-xs text-[#8a8a8a] mt-0.5 tabular-nums">
                Exporta tus {entities.length} hábitos, {activities.length} registros diarios, racha máxima ({globalStats.maxStreak}d) y consistencia ({globalStats.consistencyPct}%).
              </p>
            </div>
          </div>

          {lastExternalBackupAt && (
            <span className="text-[11px] text-[#8a8a8a] bg-[#141414] border border-[#242424] px-2.5 py-1 rounded-lg tabular-nums self-start whitespace-nowrap">
              Último respaldo: {new Date(lastExternalBackupAt).toLocaleString('es-ES')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Bloque JSON */}
          <div className="bg-[#121212] border border-[#242424] rounded-xl p-4 space-y-3">
            <div>
              <span className="text-xs font-bold text-white">Respaldo completo en JSON</span>
              <p className="text-[11px] text-[#8a8a8a] mt-0.5">
                Incluye hábitos, registros, notas, progreso de rachas, medallas y Forja de Racha listo para reimportar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportJson}
                className="inline-flex items-center gap-1.5 bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar JSON</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCopyBackupJson()}
                className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2c2c2c] hover:border-[#d8f23a] text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                {copiedBackupJson ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#d8f23a]" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#8a8a8a]" />
                    <span>Copiar JSON</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bloque CSV */}
          <div className="bg-[#121212] border border-[#242424] rounded-xl p-4 space-y-3">
            <div>
              <span className="text-xs font-bold text-white">Hojas de cálculo (CSV UTF-8)</span>
              <p className="text-[11px] text-[#8a8a8a] mt-0.5">
                Compatible con Excel y Google Sheets: descarga el historial diario o un resumen de progreso por hábito.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportCsv('actividades')}
                className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2c2c2c] hover:border-[#d8f23a] text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#d8f23a]" />
                <span>CSV Diario</span>
              </button>

              <button
                type="button"
                onClick={() => exportCsv('resumen')}
                className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2c2c2c] hover:border-[#d8f23a] text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#d8f23a]" />
                <span>CSV Resumen</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
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
        </div>

        {/* Destructive & Reset Actions */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-[#181818]">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => {
                setConfirmReset(true);
                setConfirmClear(false);
                setConfirmDeleteAccount(false);
              }}
              className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] hover:border-[#d8f23a]/60 text-[#8a8a8a] hover:text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar ejemplo</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetDemo();
                  setConfirmReset(false);
                }}
                className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Confirmar ejemplo
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="bg-[#141414] border border-[#262626] text-xs text-[#8a8a8a] hover:text-white px-3 py-2 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => {
                setConfirmClear(true);
                setConfirmReset(false);
                setConfirmDeleteAccount(false);
              }}
              className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] hover:border-red-500/60 text-[#8a8a8a] hover:text-red-300 text-xs font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vaciar espacio (0 hábitos)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  clearWorkspace();
                  setConfirmClear(false);
                }}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Sí, vaciar todo
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="bg-[#141414] border border-[#262626] text-xs text-[#8a8a8a] hover:text-white px-3 py-2 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}

          {isAuthenticated &&
            (!confirmDeleteAccount ? (
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteAccount(true);
                  setConfirmClear(false);
                  setConfirmReset(false);
                }}
                className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] hover:border-red-500 text-red-400 text-xs font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar cuenta</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    deleteAccount();
                    setConfirmDeleteAccount(false);
                  }}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Confirmar eliminación
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAccount(false)}
                  className="bg-[#141414] border border-[#262626] text-xs text-[#8a8a8a] hover:text-white px-3 py-2 rounded-xl cursor-pointer"
                >
                  No
                </button>
              </div>
            ))}
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
