'use client';
import { useState, useEffect } from 'react';
import Portal from '@/components/Portal';

interface Template {
  id: string;
  title: string;
  type: string;
  content: string;
}

interface TemplateModalProps {
  onClose: () => void;
  showAlert: (msg: string) => void;
}

export default function TemplateModal({ onClose, showAlert }: TemplateModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [type, setType] = useState('certificate');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/document-templates');
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleEdit = (t?: Template) => {
    if (t) {
      setEditingTemplate(t);
      setTitle(t.title);
      setType(t.type);
      setContent(t.content);
    } else {
      setEditingTemplate(null);
      setTitle('');
      setType('certificate');
      setContent('');
    }
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que querés eliminar esta plantilla?')) return;
    try {
      const res = await fetch(`/api/document-templates?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadTemplates();
        showAlert('Plantilla eliminada');
      }
    } catch (e) {}
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return showAlert('Completá los campos obligatorios');
    setIsSaving(true);
    try {
      const method = editingTemplate ? 'PUT' : 'POST';
      const payload = { id: editingTemplate?.id, title, type, content };
      const res = await fetch('/api/document-templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        showAlert('Plantilla guardada con éxito');
        setView('list');
        loadTemplates();
      } else {
        const data = await res.json();
        showAlert(data.error || 'Error al guardar');
      }
    } catch (e) {
      showAlert('Error de red');
    }
    setIsSaving(false);
  };

  const insertVariable = (variable: string) => {
    setContent(prev => prev + ` {{${variable}}}`);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
        <div className="bg-surface rounded-3xl w-[90vw] sm:w-[600px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
          <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest shrink-0">
            <h3 className="text-xl font-bold text-on-surface">
              {view === 'list' ? 'Plantillas de Documentos' : (editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla')}
            </h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="overflow-y-auto p-6">
            {view === 'list' ? (
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => handleEdit()}
                  className="w-full py-3 border-2 border-dashed border-primary text-primary rounded-xl font-bold hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">add</span>
                  Crear nueva plantilla
                </button>

                {isLoading ? (
                  <p className="text-center py-4 text-on-surface-variant">Cargando...</p>
                ) : templates.length === 0 ? (
                  <p className="text-center py-4 text-on-surface-variant">No hay plantillas creadas.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {templates.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-4 border border-outline-variant/50 rounded-xl bg-surface-container-lowest">
                        <div>
                          <p className="font-bold text-on-surface">{t.title}</p>
                          <p className="text-xs text-on-surface-variant capitalize">{t.type === 'certificate' ? 'Certificado' : t.type === 'consent' ? 'Consentimiento' : 'Receta'}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleEdit(t)} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                          <button onClick={() => handleDelete(t.id)} className="w-8 h-8 rounded-full hover:bg-error/10 flex items-center justify-center text-error"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Título de la plantilla</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Ej. Certificado de Reposo" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Tipo de documento</label>
                  <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary">
                    <option value="certificate">Certificado</option>
                    <option value="consent">Consentimiento</option>
                    <option value="prescription">Receta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Contenido (puedes usar variables mágicas)</label>
                  
                  <div className="flex flex-wrap gap-2 mb-2 p-2 bg-surface-container-low rounded-lg border border-outline-variant/30">
                    <span className="text-xs text-on-surface-variant w-full font-semibold">Variables (clic para insertar):</span>
                    {['nombre_paciente', 'dni_paciente', 'fecha', 'firma_profesional'].map(v => (
                      <button key={v} type="button" onClick={() => insertVariable(v)} className="px-2 py-1 bg-surface-container-high hover:bg-primary/10 hover:text-primary rounded text-xs transition-colors">
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>

                  <textarea 
                    value={content} 
                    onChange={e => setContent(e.target.value)} 
                    required 
                    rows={8}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary resize-y" 
                    placeholder="Certifico que el paciente {{nombre_paciente}}..."
                  ></textarea>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-outline-variant/30 mt-2">
                  <button type="button" onClick={() => setView('list')} className="text-sm font-bold text-on-surface-variant hover:text-on-surface">Volver</button>
                  <button type="submit" disabled={isSaving} className="px-6 py-2 rounded-xl font-bold text-sm bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50">
                    {isSaving ? 'Guardando...' : 'Guardar Plantilla'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
