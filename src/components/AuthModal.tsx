import React, { useState } from 'react';
import { Check, Copy, KeyRound, ShieldCheck, X } from 'lucide-react';
import { useStore } from '../hooks/useStore';

type AuthTab = 'login' | 'register' | 'recover';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    registerAccount,
    loginAccount,
    recoverAccountWithKey,
    showToast,
  } = useStore();

  const [tab, setTab] = useState<AuthTab>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Critical post-registration recovery key confirmation screen
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isAuthModalOpen) return null;

  const resetAndClose = () => {
    setError(null);
    setGeneratedRecoveryKey(null);
    setPassword('');
    setRecoveryInput('');
    closeAuthModal();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      loginAccount(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión.');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    try {
      const { recoveryKey } = registerAccount({ name, email, password });
      setGeneratedRecoveryKey(recoveryKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cuenta.');
    }
  };

  const handleRecover = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      recoverAccountWithKey(recoveryInput);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clave inválida.');
    }
  };

  const handleCopy = async () => {
    if (!generatedRecoveryKey) return;
    try {
      await navigator.clipboard.writeText(generatedRecoveryKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Copia la clave manualmente: ' + generatedRecoveryKey);
    }
  };

  const handleConfirmSavedKey = () => {
    setGeneratedRecoveryKey(null);
    closeAuthModal();
    showToast('Cuenta activada · Sesión JWT guardada');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 shadow-2xl">
        {/* Critical Screen: 12-Character Recovery Key After Registration */}
        {generatedRecoveryKey ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#161a08] border border-[#34420e] flex items-center justify-center text-[#d8f23a] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 id="auth-modal-title" className="text-base font-bold text-white">
                  Guarda esta clave para recuperar tu cuenta
                </h2>
                <p className="text-xs text-[#8a8a8a] mt-0.5">
                  Es tu llave única de 12 caracteres. No la compartas y guárdala en un lugar seguro.
                </p>
              </div>
            </div>

            <div className="bg-[#121212] border border-[#2d360d] rounded-2xl p-5 text-center space-y-3">
              <span className="text-[11px] uppercase tracking-wider text-[#8a8a8a]">
                Clave de recuperación D1
              </span>
              <div className="font-mono text-2xl font-bold tracking-[0.2em] text-[#d8f23a] select-all">
                {generatedRecoveryKey}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2c2c2c] hover:border-[#d8f23a] text-white text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#d8f23a]" />
                    <span>Copiada al portapapeles</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#8a8a8a]" />
                    <span>Copiar clave</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleConfirmSavedKey}
              className="w-full bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-sm font-bold py-3 rounded-xl transition-colors cursor-pointer"
            >
              Ya la guardé, entrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between pb-4 border-b border-[#1c1c1c]">
              <div>
                <h2 id="auth-modal-title" className="text-base font-bold text-white">
                  Acceso a Racha
                </h2>
                <p className="text-[11px] text-[#8a8a8a]">
                  Autenticación JWT simulada sobre almacenamiento local D1
                </p>
              </div>
              <button
                type="button"
                onClick={resetAndClose}
                aria-label="Cerrar autenticación"
                className="p-1.5 rounded-lg text-[#8a8a8a] hover:text-white hover:bg-[#161616] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-[#121212] border border-[#1f1f1f] rounded-xl p-1 mt-4">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError(null);
                }}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  tab === 'login'
                    ? 'bg-[#d8f23a] text-black font-semibold'
                    : 'text-[#8a8a8a] hover:text-white'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError(null);
                }}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  tab === 'register'
                    ? 'bg-[#d8f23a] text-black font-semibold'
                    : 'text-[#8a8a8a] hover:text-white'
                }`}
              >
                Registrarse
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('recover');
                  setError(null);
                }}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  tab === 'recover'
                    ? 'bg-[#d8f23a] text-black font-semibold'
                    : 'text-[#8a8a8a] hover:text-white'
                }`}
              >
                Clave 12c
              </button>
            </div>

            {error && (
              <div className="mt-4 text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}

            {tab === 'login' && (
              <form onSubmit={handleLogin} className="mt-4 space-y-3.5">
                <div>
                  <label htmlFor="login-email" className="block text-xs text-[#8a8a8a] mb-1">
                    Correo electrónico
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.es"
                    className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="login-pass" className="block text-xs text-[#8a8a8a] mb-1">
                    Contraseña
                  </label>
                  <input
                    id="login-pass"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Iniciar sesión
                </button>
              </form>
            )}

            {tab === 'register' && (
              <form onSubmit={handleRegister} className="mt-4 space-y-3.5">
                <div>
                  <label htmlFor="reg-name" className="block text-xs text-[#8a8a8a] mb-1">
                    Nombre
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex"
                    className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="reg-email" className="block text-xs text-[#8a8a8a] mb-1">
                    Correo electrónico
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@correo.es"
                    className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="reg-pass" className="block text-xs text-[#8a8a8a] mb-1">
                    Contraseña
                  </label>
                  <input
                    id="reg-pass"
                    type="password"
                    required
                    minLength={4}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Crear cuenta y generar clave
                </button>
              </form>
            )}

            {tab === 'recover' && (
              <form onSubmit={handleRecover} className="mt-4 space-y-3.5">
                <div>
                  <label htmlFor="rec-key" className="block text-xs text-[#8a8a8a] mb-1">
                    Clave de recuperación (12 caracteres)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#8a8a8a] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="rec-key"
                      type="text"
                      required
                      value={recoveryInput}
                      onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
                      placeholder="ABCD-EFGH-JKLM"
                      className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white font-mono text-xs uppercase tracking-widest rounded-xl pl-10 pr-3.5 py-2.5 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Recuperar cuenta
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
