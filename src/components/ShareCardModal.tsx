import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Eye, EyeOff, ImageDown, X } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { calculateHabitStats } from '../utils/streak';
import { type CardOrientation, renderDisciplineCard } from '../utils/shareCard';

export const ShareCardModal: React.FC = () => {
  const {
    isShareModalOpen,
    closeShareModal,
    user,
    today,
    entities,
    activities,
    globalStats,
    showToast,
  } = useStore();

  const [orientation, setOrientation] = useState<CardOrientation>('landscape');
  const [showHabitNames, setShowHabitNames] = useState(true);
  const [note, setNote] = useState(
    'La consistencia diaria supera a la intensidad ocasional.'
  );
  const [copiedImg, setCopiedImg] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const habitSummaries = useMemo(() => {
    return entities
      .map((entity) => {
        const stats = calculateHabitStats(entity, activities, today);
        return {
          name: entity.name,
          category: entity.category,
          streak: stats.currentStreak,
          monthlyCompleted: stats.monthlyCompleted,
          monthlyGoal: entity.monthlyGoal,
        };
      })
      .sort((a, b) => b.streak - a.streak);
  }, [entities, activities, today]);

  useEffect(() => {
    if (!isShareModalOpen || !canvasRef.current) return;
    renderDisciplineCard(canvasRef.current, {
      userName: user.name,
      today,
      globalStats,
      habitSummaries,
      note,
      showHabitNames,
      orientation,
    });
  }, [
    isShareModalOpen,
    user.name,
    today,
    globalStats,
    habitSummaries,
    note,
    showHabitNames,
    orientation,
  ]);

  if (!isShareModalOpen) return null;

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `racha-disciplina-${today}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Tarjeta PNG descargada');
  };

  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (!blob || typeof ClipboardItem === 'undefined') {
        handleDownloadPng();
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopiedImg(true);
      showToast('Imagen copiada al portapapeles');
      window.setTimeout(() => setCopiedImg(false), 2000);
    } catch {
      handleDownloadPng();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-card-title"
    >
      <div className="w-full max-w-3xl bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 my-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#1c1c1c]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#161a08] border border-[#34420e] flex items-center justify-center text-[#d8f23a]">
              <ImageDown className="w-4 h-4" />
            </div>
            <div>
              <h2 id="share-card-title" className="text-base font-bold text-white">
                Tarjeta de Disciplina (PNG)
              </h2>
              <p className="text-xs text-[#8a8a8a]">
                Genera y descarga una imagen resumen con tus estadísticas actuales.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeShareModal}
            aria-label="Cerrar generador de tarjeta"
            className="p-2 rounded-xl text-[#8a8a8a] hover:text-white hover:bg-[#161616] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Customization Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#121212] border border-[#222222] rounded-xl p-1 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                orientation === 'landscape'
                  ? 'bg-[#d8f23a] text-black'
                  : 'text-[#8a8a8a] hover:text-white'
              }`}
            >
              Horizontal 16:9
            </button>
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                orientation === 'portrait'
                  ? 'bg-[#d8f23a] text-black'
                  : 'text-[#8a8a8a] hover:text-white'
              }`}
            >
              Vertical 4:5
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowHabitNames((v) => !v)}
            className="bg-[#121212] border border-[#222222] hover:border-[#d8f23a] rounded-xl px-3.5 py-2 text-xs font-medium text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {showHabitNames ? (
              <>
                <Eye className="w-3.5 h-3.5 text-[#d8f23a]" />
                <span>Nombres visibles</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-[#8a8a8a]" />
                <span>Modo privado</span>
              </>
            )}
          </button>

          <input
            type="text"
            value={note}
            maxLength={72}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Frase recordatorio..."
            aria-label="Frase recordatorio en la tarjeta"
            className="bg-[#121212] border border-[#222222] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2 outline-none"
          />
        </div>

        {/* Live Canvas Preview */}
        <div className="bg-[#050505] border border-[#1c1c1c] rounded-2xl p-3 flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            className={`rounded-xl shadow-lg max-w-full h-auto ${
              orientation === 'portrait' ? 'max-h-[420px]' : 'max-h-[380px]'
            }`}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#1c1c1c]">
          <button
            type="button"
            onClick={handleCopyImage}
            className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] hover:border-white text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            {copiedImg ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#d8f23a]" />
                <span>Copiada</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#8a8a8a]" />
                <span>Copiar imagen</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadPng}
            className="inline-flex items-center gap-2 bg-[#d8f23a] hover:bg-[#c8e22a] text-black text-xs font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Descargar PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
};
