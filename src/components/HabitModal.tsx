import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { CadenceType, HabitCategory } from '../types';

export const HabitModal: React.FC = () => {
  const {
    isHabitModalOpen,
    editingEntity,
    closeHabitModal,
    today,
    createHabit,
    updateHabit,
  } = useStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<HabitCategory>('salud');
  const [cadence, setCadence] = useState<CadenceType>('diario');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [targetValue, setTargetValue] = useState(20);
  const [unit, setUnit] = useState('min');
  const [monthlyGoal, setMonthlyGoal] = useState(20);
  const [graceDays, setGraceDays] = useState(1);

  useEffect(() => {
    if (!isHabitModalOpen) return;
    if (editingEntity) {
      setName(editingEntity.name);
      setCategory(editingEntity.category);
      setCadence(editingEntity.cadence);
      setStartDate(editingEntity.startDate);
      setEndDate(editingEntity.endDate ?? '');
      setTargetValue(editingEntity.targetValue);
      setUnit(editingEntity.unit);
      setMonthlyGoal(editingEntity.monthlyGoal);
      setGraceDays(editingEntity.graceDays);
    } else {
      setName('');
      setCategory('salud');
      setCadence('diario');
      setStartDate(today);
      setEndDate('');
      setTargetValue(20);
      setUnit('min');
      setMonthlyGoal(20);
      setGraceDays(1);
    }
  }, [isHabitModalOpen, editingEntity, today]);

  if (!isHabitModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingEntity) {
      updateHabit(editingEntity.id, {
        name: name.trim(),
        category,
        cadence,
        startDate,
        endDate: endDate || undefined,
        targetValue: Math.max(1, Number(targetValue) || 1),
        unit: unit.trim() || 'veces',
        monthlyGoal: Math.max(1, Number(monthlyGoal) || 1),
        graceDays: Math.max(0, Math.min(7, Number(graceDays) || 0)),
      });
    } else {
      createHabit({
        name: name.trim(),
        category,
        cadence,
        startDate,
        endDate: endDate || undefined,
        targetValue: Math.max(1, Number(targetValue) || 1),
        unit: unit.trim() || 'veces',
        monthlyGoal: Math.max(1, Number(monthlyGoal) || 1),
        graceDays: Math.max(0, Math.min(7, Number(graceDays) || 0)),
      });
    }
    closeHabitModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="habit-modal-title"
    >
      <div className="w-full max-w-lg bg-[#0b0b0b] border border-[#1c1c1c] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#1c1c1c]">
          <h2 id="habit-modal-title" className="text-base font-bold text-white">
            {editingEntity ? 'Editar Hábito' : 'Nuevo Hábito'}
          </h2>
          <button
            type="button"
            onClick={closeHabitModal}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-lg text-[#8a8a8a] hover:text-white hover:bg-[#161616] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="habit-name" className="block text-xs font-medium text-[#8a8a8a] mb-1.5">
              Nombre del hábito
            </label>
            <input
              id="habit-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Lectura Técnica / Meditación"
              className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="habit-category" className="block text-xs font-medium text-[#8a8a8a] mb-1.5">
                Categoría
              </label>
              <select
                id="habit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as HabitCategory)}
                className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
              >
                <option value="salud">Salud</option>
                <option value="estudio">Estudio</option>
                <option value="trabajo">Trabajo</option>
                <option value="personal">Personal</option>
              </select>
            </div>

            <div>
              <label htmlFor="habit-cadence" className="block text-xs font-medium text-[#8a8a8a] mb-1.5">
                Cadencia
              </label>
              <select
                id="habit-cadence"
                value={cadence}
                onChange={(e) => setCadence(e.target.value as CadenceType)}
                className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
              >
                <option value="diario">Diario</option>
                <option value="laborables">Lunes a Viernes</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="habit-target" className="block text-xs font-medium text-[#8a8a8a] mb-1.5">
                Valor diario
              </label>
              <input
                id="habit-target"
                type="number"
                min={1}
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
                className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="habit-unit" className="block text-xs font-medium text-[#8a8a8a] mb-1.5">
                Unidad
              </label>
              <input
                id="habit-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="min, páginas..."
                className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
              />
            </div>

            <div>
              <label htmlFor="habit-monthly" className="block text-xs font-medium text-[#8a8a8a] mb-1.5">
                Meta mensual
              </label>
              <input
                id="habit-monthly"
                type="number"
                min={1}
                max={31}
                value={monthlyGoal}
                onChange={(e) => setMonthlyGoal(Number(e.target.value))}
                className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="habit-start" className="block text-xs font-medium text-[#8a8a8a] mb-1.5">
                Fecha inicio
              </label>
              <input
                id="habit-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3 py-2.5 outline-none tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="habit-end" className="block text-xs font-medium text-[#8a8a8a] mb-1.5">
                Fecha límite (opc.)
              </label>
              <input
                id="habit-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3 py-2.5 outline-none tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="habit-grace" className="block text-xs font-medium text-[#8a8a8a] mb-1.5">
                Días de gracia
              </label>
              <input
                id="habit-grace"
                type="number"
                min={0}
                max={7}
                value={graceDays}
                onChange={(e) => setGraceDays(Number(e.target.value))}
                className="w-full bg-[#121212] border border-[#242424] focus:border-[#d8f23a] text-white text-xs rounded-xl px-3.5 py-2.5 outline-none tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1c1c1c]">
            <button
              type="button"
              onClick={closeHabitModal}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#8a8a8a] hover:text-white bg-[#141414] border border-[#242424] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold text-black bg-[#d8f23a] hover:bg-[#c8e22a] transition-colors cursor-pointer"
            >
              {editingEntity ? 'Guardar cambios' : 'Crear Hábito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
