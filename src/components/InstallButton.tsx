import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Laptop,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
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

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        showToast('Racha se ha instalado en tu dispositivo');
        return;
      }
      if (outcome === 'dismissed') {
        return;
      }
    }
    setGuideOpen(true);
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
          title={
            isInstallable
              ? 'Descargar e instalar Racha en tu dispositivo'
              : 'Instalar Racha como aplicación en tu dispositivo'
          }
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isInstallable
              ? 'bg-[#d8f23a] hover:bg-[#c8e22a] text-black'
              : 'bg-[#141907] border border-[#34420e] hover:border-[#d8f23a] text-[#d8f23a]'
          }`}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Instalar App</span>
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
          <span>Navegador no compatible con instalación PWA directa</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          className="inline-flex items-center gap-2 bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
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
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';

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
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="pwa-install-title"
                className="text-base font-bold text-white tracking-tight"
              >
                Instala Racha en tu dispositivo
              </h2>
              <p className="text-xs text-[#8a8a8a] mt-0.5">
                Úsala como aplicación independiente y sin conexión.
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
          <div className="bg-[#141907] border border-[#34420e] rounded-xl p-3.5 space-y-2.5">
            <p className="text-xs text-[#d8f23a] leading-relaxed">
              Los navegadores bloquean la descarga directa de PWA dentro de vistas previas incrustadas. Abre Racha en una pestaña directa para activar la instalación en un clic:
            </p>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir en pestaña nueva</span>
            </a>
          </div>
        )}

        <div className="space-y-3">
          <div
            className={`rounded-xl border p-3.5 space-y-1.5 ${
              isIOS
                ? 'bg-[#141907]/70 border-[#34420e]'
                : 'bg-[#121212] border-[#222222]'
            }`}
          >
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

          <div
            className={`rounded-xl border p-3.5 space-y-1.5 ${
              isAndroid
                ? 'bg-[#141907]/70 border-[#34420e]'
                : 'bg-[#121212] border-[#222222]'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Smartphone className="w-3.5 h-3.5 text-[#d8f23a]" />
              <span>Android (Chrome / Edge)</span>
            </div>
            <p className="text-xs text-[#8a8a8a] leading-relaxed">
              1. Abre el menú <span className="text-white font-medium">⋮</span> arriba a la derecha.
              <br />
              2. Selecciona <span className="text-white font-medium">Instalar aplicación</span>.
            </p>
          </div>

          <div
            className={`rounded-xl border p-3.5 space-y-1.5 ${
              !isIOS && !isAndroid
                ? 'bg-[#141907]/70 border-[#34420e]'
                : 'bg-[#121212] border-[#222222]'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Laptop className="w-3.5 h-3.5 text-[#d8f23a]" />
              <span>Computador (Chrome / Edge)</span>
            </div>
            <p className="text-xs text-[#8a8a8a] leading-relaxed">
              Haz clic en el icono de <span className="text-white font-medium">Instalar</span> en la barra de direcciones o en <span className="text-white font-medium">Menú ⋮ → Instalar Racha</span>.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
