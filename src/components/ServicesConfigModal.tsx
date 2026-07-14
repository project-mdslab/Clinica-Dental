'use client';
import { useState } from 'react';
import Portal from './Portal';
import { createClient } from '@/utils/supabase/client';

interface Service {
  id?: string;
  name: string;
  color: string;
}

interface ServicesConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: Service[];
}

const PRESET_COLORS = [
  'bg-primary', 'bg-[#EF4444]', 'bg-[#F59E0B]', 'bg-[#10B981]', 
  'bg-[#3B82F6]', 'bg-[#8B5CF6]', 'bg-[#EC4899]', 'bg-[#14B8A6]', 
  'bg-[#F43F5E]', 'bg-[#84CC16]', 'bg-[#64748B]', 'bg-[#A855F7]'
];

export default function ServicesConfigModal({ isOpen, onClose, services }: ServicesConfigModalProps) {
  const supabase = createClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsLoading(true);
    const { error } = await supabase.from('calendar_services').insert({ name: newName.trim(), color: newColor });
    if (!error) {
      setNewName('');
      setNewColor(PRESET_COLORS[0]);
    } else {
      alert("Error al crear prestación: " + error.message);
    }
    setIsLoading(false);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setIsLoading(true);
    const { error } = await supabase.from('calendar_services').update({ name: editName.trim(), color: editColor }).eq('id', id);
    if (!error) {
      setEditingId(null);
    } else {
      alert("Error al guardar: " + error.message);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta prestación?")) {
      setIsLoading(true);
      await supabase.from('calendar_services').delete().eq('id', id);
      setIsLoading(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}></div>
        
        <div 
          className="bg-surface rounded-[2rem] shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col"
          style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh' }}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest">
            <h2 className="font-title-lg text-xl font-bold text-on-surface">Configurar Prestaciones</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            
            {/* Formulario Crear Nuevo */}
            <div className="bg-surface-container-lowest border border-outline-variant/50 p-4 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">add_circle</span>
                Crear Nueva Prestación
              </h3>
              <form onSubmit={handleCreate} className="flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="Nombre de la prestación (ej. Blanqueamiento)" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                  disabled={isLoading}
                />
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant mb-2 block">Elige un color identificador:</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewColor(color)}
                        className={`w-7 h-7 rounded-full ${color} flex items-center justify-center transition-transform hover:scale-110 ${newColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''}`}
                      >
                        {newColor === color && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading || !newName.trim()} 
                  className="mt-2 bg-primary text-white py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Agregar Prestación
                </button>
              </form>
            </div>

            {/* Lista de Existentes */}
            <div>
              <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">list</span>
                Prestaciones Actuales
              </h3>
              
              <div className="space-y-3">
                {services.length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-4 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                    No hay prestaciones cargadas.
                  </p>
                ) : (
                  services.map((srv) => (
                    <div key={srv.id || srv.name} className="flex flex-col bg-surface-container-lowest border border-outline-variant/50 rounded-xl overflow-hidden shadow-sm transition-all hover:border-outline-variant">
                      
                      {/* Modo Vista */}
                      {editingId !== srv.id && (
                        <div className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full ${srv.color} shadow-sm`}></div>
                            <span className="font-semibold text-sm text-on-surface">{srv.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                if(srv.id) {
                                  setEditingId(srv.id);
                                  setEditName(srv.name);
                                  setEditColor(srv.color);
                                }
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high text-primary transition-colors"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button 
                              onClick={() => srv.id && handleDelete(srv.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-error/10 text-error transition-colors"
                              title="Eliminar"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Modo Edición */}
                      {editingId === srv.id && (
                        <div className="p-4 bg-surface-container-low flex flex-col gap-3 animate-in fade-in">
                          <input 
                            type="text" 
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors font-semibold"
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => setEditColor(color)}
                                className={`w-6 h-6 rounded-full ${color} flex items-center justify-center transition-transform hover:scale-110 ${editColor === color ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                              >
                                {editColor === color && <span className="material-symbols-outlined text-white text-[12px]">check</span>}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-1">
                            <button 
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={() => srv.id && handleSaveEdit(srv.id)}
                              disabled={isLoading || !editName.trim()}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                              Guardar Cambios
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
