import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Laptop,
  Loader2,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { buildDirectInstallUrl, usePWAInstall } from '../hooks/usePWAInstall';
import { useStore } from '../hooks/useStore';

interface InstallButtonProps {
  variant?: 'navbar' | 'settings';
}

export const InstallButton: React.FC<InstallButtonProps> = ({
  variant = 'navbar',
}) => {
  const {
    isInstallable,
    isPWACompatible,
    isInstalled,
    isIOS,
    isAndroid,
    isInIframe,
    install,
  } = usePWAInstall();
  const { showToast } = useStore();
  const [guideOpen, setGuideOpen] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  const handleInstallClick = async () => {
    if (isPrompting) return;

    // On iOS Safari there is no native beforeinstallprompt API; show exact iOS steps
    if (isIOS && !isInstallable) {
      setGuideOpen(true);
      return;
    }

    // Inside an iframe, browsers block beforeinstallprompt; offer direct tab launch
    if (isInIframe && !isInstallable) {
      setGuideOpen(true);
      return;
    }

    setIsPrompting(true);
    try {
      const outcome = await install();
      if (outcome === 'accepted') {
        showToast('¡Listo! Racha se añadió a tu pantalla de inicio');
        return;
      }
      if (outcome === 'dismissed') {
        return;
      }
      setGuideOpen(true);
    } finally {
      setIsPrompting(false);
    }
  };

  if (variant === 'navbar') {
    if (isInstalled || !isPWACompatible) {
      return null;
    }

    return (
      <>
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          disabled={isPrompting}
          title={
            isInstallable
              ? 'Instalar Racha ahora en tu dispositivo'
              : 'Instalar Racha en la pantalla de inicio'
          }
          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-70 ${
            isInstallable
              ? 'bg-[#d8f23a] hover:bg-[#c8e22a] text-black'
              : 'bg-[#141907] border border-[#34420e] hover:border-[#d8f23a] text-[#d8f23a]'
          }`}
        >
          {isPrompting ? (
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="sm:hidden">Instalar</span>
          <span className="hidden sm:inline">Instalar App</span>
        </button>

        {guideOpen && (
          <InstallGuideModal
            isIOS={isIOS}
            isAndroid={isAndroid}
            isInIframe={isInIframe}
            onClose={() => setGuideOpen(false)}
          />
        )}
      </>
    );
  }

  // Settings variant
  return (
    <>
      {isInstalled ? (
        <div className="inline-flex items-center gap-2 bg-[#141907] border border-[#34420e] text-[#d8f23a] text-xs font-semibold px-4 py-2.5 rounded-xl whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>App instalada en este dispositivo</span>
        </div>
      ) : !isPWACompatible ? (
        <div className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] text-[#8a8a8a] text-xs font-medium px-4 py-2.5 rounded-xl">
          <span>Usa Chrome, Edge o Safari para instalar Racha</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          disabled={isPrompting}
          className="inline-flex items-center gap-2 bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer disabled:opacity-70"
        >
          {isPrompting ? (
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>Instalar App</span>
        </button>
      )}

      {guideOpen && (
        <InstallGuideModal
          isIOS={isIOS}
          isAndroid={isAndroid}
          isInIframe={isInIframe}
          onClose={() => setGuideOpen(false)}
        />
      )}
    </>
  );
};

export const InstallPromptBanner: React.FC = () => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isInIframe,
    installRequestedFromQuery,
    dismissInstallPromptBanner,
    install,
  } = usePWAInstall();
  const { showToast } = useStore();
  const [showGuideSheet, setShowGuideSheet] = useState(false);
  const [waitingForPrompt, setWaitingForPrompt] = useState(true);
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    if (!installRequestedFromQuery || isInstallable || isIOS || isInstalled) {
      setWaitingForPrompt(false);
      return;
    }
    setWaitingForPrompt(true);
    const timer = window.setTimeout(() => {
      setWaitingForPrompt(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [installRequestedFromQuery, isInstallable, isIOS, isInstalled]);

  if (isInstalled || isInIframe || !installRequestedFromQuery) {
    return null;
  }

  const handleConfirmInstall = async () => {
    if (isPrompting) return;
    if (isIOS && !isInstallable) {
      setShowGuideSheet(true);
      return;
    }
    setIsPrompting(true);
    try {
      const outcome = await install();
      if (outcome === 'accepted') {
        showToast('¡Listo! Racha se añadió a tu pantalla de inicio');
      } else if (outcome === 'dismissed') {
        dismissInstallPromptBanner();
      } else {
        setShowGuideSheet(true);
      }
    } finally {
      setIsPrompting(false);
    }
  };

  return (
    <>
      <div className="fixed top-16 sm:top-20 inset-x-4 sm:left-auto sm:right-6 sm:w-[400px] z-40 bg-[#0b0b0b] border border-[#d8f23a] rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#d8f23a] text-black flex items-center justify-center shrink-0">
            {waitingForPrompt && !isInstallable ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">
              {isInstallable
                ? 'Racha lista para instalar'
                : waitingForPrompt
                ? 'Preparando instalador nativo...'
                : 'Instalar Racha en este dispositivo'}
            </p>
            <p className="text-[11px] text-[#8a8a8a] truncate">
              {isIOS
                ? 'Añádela a tu pantalla de inicio en iOS'
                : isInstallable
                ? 'Pulsa para añadir el acceso directo nativo'
                : waitingForPrompt
                ? 'Un segundo mientras el navegador verifica la app'
                : 'Pulsa para instalar o ver el botón del navegador'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={isPrompting || (waitingForPrompt && !isInstallable)}
            onClick={() => void handleConfirmInstall()}
            className="bg-[#d8f23a] hover:bg-[#c8e22a] disabled:opacity-60 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            {isPrompting
              ? 'Abriendo...'
              : isInstallable || isIOS
              ? 'Instalar'
              : waitingForPrompt
              ? 'Esperando...'
              : 'Instalar'}
          </button>
          <button
            type="button"
            onClick={dismissInstallPromptBanner}
            aria-label="Descartar aviso de instalación"
            className="p-1.5 rounded-lg text-[#8a8a8a] hover:text-white hover:bg-[#161616] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showGuideSheet && (
        <InstallGuideModal
          isIOS={isIOS}
          isAndroid={isAndroid}
          isInIframe={false}
          onClose={() => {
            setShowGuideSheet(false);
            dismissInstallPromptBanner();
          }}
        />
      )}
    </>
  );
};

interface InstallGuideModalProps {
  isIOS: boolean;
  isAndroid: boolean;
  isInIframe: boolean;
  onClose: () => void;
}

const InstallGuideModal: React.FC<InstallGuideModalProps> = ({
  isIOS,
  isAndroid,
  isInIframe,
  onClose,
}) => {
  const directInstallUrl = buildDirectInstallUrl();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d8f23a] text-black flex items-center justify-center shrink-0">
              {isAndroid || isIOS ? (
                <Smartphone className="w-5 h-5" />
              ) : (
                <Laptop className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2
                id="pwa-install-title"
                className="text-base font-bold text-white tracking-tight"
              >
                Instala Racha en tu dispositivo
              </h2>
              <p className="text-xs text-[#8a8a8a] mt-0.5">
                Acceso directo en tu pantalla de inicio y uso sin conexión.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar instrucciones de instalación"
            className="p-1.5 rounded-lg text-[#8a8a8a] hover:text-white hover:bg-[#161616] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isInIframe && (
          <div className="bg-[#141907] border border-[#34420e] rounded-xl p-4 space-y-3">
            <p className="text-xs text-[#d8f23a] leading-relaxed">
              Estás viendo Racha dentro de una vista previa incrustada. Por seguridad, Chrome y Android solo permiten instalar en un clic cuando la web está abierta directamente en su propia pestaña:
            </p>
            <a
              href={directInstallUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Abrir Racha para instalar en 1 clic</span>
            </a>
          </div>
        )}

        <div className="space-y-3">
          {isIOS && (
            <div className="rounded-xl border p-3.5 space-y-1.5 bg-[#141907]/70 border-[#34420e]">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Share className="w-3.5 h-3.5 text-[#d8f23a]" />
                <span>iPhone o iPad (Safari)</span>
              </div>
              <p className="text-xs text-[#8a8a8a] leading-relaxed">
                1. Pulsa el icono <span className="text-white font-medium">Compartir</span> en la barra de Safari.
                <br />
                2. Elige <span className="text-white font-medium">Añadir a pantalla de inicio</span>.
              </p>
            </div>
          )}

          {isAndroid && (
            <div className="rounded-xl border p-3.5 space-y-1.5 bg-[#141907]/70 border-[#34420e]">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Smartphone className="w-3.5 h-3.5 text-[#d8f23a]" />
                <span>Android (Chrome / Edge)</span>
              </div>
              <p className="text-xs text-[#8a8a8a] leading-relaxed">
                1. Abre el menú <span className="text-white font-medium">⋮</span> arriba a la derecha.
                <br />
                2. Toca <span className="text-white font-medium">Instalar aplicación</span> o <span className="text-white font-medium">Añadir a pantalla de inicio</span>.
              </p>
            </div>
          )}

          {!isIOS && !isAndroid && (
            <div className="rounded-xl border p-3.5 space-y-1.5 bg-[#141907]/70 border-[#34420e]">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Laptop className="w-3.5 h-3.5 text-[#d8f23a]" />
                <span>PC (Chrome / Edge)</span>
              </div>
              <p className="text-xs text-[#8a8a8a] leading-relaxed">
                Haz clic en el icono de <span className="text-white font-medium">Instalar</span> en la barra de direcciones (arriba a la derecha) o en <span className="text-white font-medium">Menú ⋮ → Instalar Racha</span>.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#161616] hover:bg-[#222222] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
