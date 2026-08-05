'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Portal from '@/components/Portal';
import AlertDialog from '@/components/AlertDialog';
import TemplateModal from '@/components/documents/TemplateModal';
import GenerateDocumentModal from '@/components/documents/GenerateDocumentModal';
import PrintPreviewModal from '@/components/documents/PrintPreviewModal';

interface PatientDocument {
  id: string;
  title: string;
  type: string;
  content: string;
  signature_url?: string;
  created_at: string;
  patients: { first_name: string; last_name: string };
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [docToPrint, setDocToPrint] = useState<PatientDocument | null>(null);
  const [docToEdit, setDocToEdit] = useState<PatientDocument | null>(null);
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'alert' as 'alert' | 'confirm', onConfirm: () => {}, confirmText: 'Aceptar' });

  const supabase = createClient();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const showAlert = (message: string, type: 'alert' | 'confirm' = 'alert', onConfirm = () => setAlertDialog(prev => ({...prev, isOpen: false}))) => {
    setAlertDialog({ isOpen: true, title: 'Atención', message, type, onConfirm, confirmText: 'Aceptar' });
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(search.toLowerCase()) || 
                          `${doc.patients?.first_name} ${doc.patients?.last_name}`.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || doc.type === filterType;
    return matchesSearch && matchesType;
  });

  const getCounts = () => {
    return {
      all: documents.length,
      certificate: documents.filter(d => d.type === 'certificate').length,
      consent: documents.filter(d => d.type === 'consent').length,
      prescription: documents.filter(d => d.type === 'prescription').length
    };
  };

  const handleWhatsApp = (doc: PatientDocument) => {
    const text = encodeURIComponent(`Hola ${doc.patients?.first_name},\n\nTe envío tu documento: ${doc.title}\n\n${doc.content}\n\nSaludos.`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleDelete = (id: string) => {
    showAlert('¿Seguro que querés eliminar este documento?', 'confirm', async () => {
      setAlertDialog(prev => ({ ...prev, isOpen: false }));
      try {
        const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          loadDocuments();
        } else {
          showAlert('Error al eliminar');
        }
      } catch (e) {
        showAlert('Error de red');
      }
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docToEdit) return;
    try {
      const res = await fetch('/api/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docToEdit.id, content: docToEdit.content })
      });
      if (res.ok) {
        setDocToEdit(null);
        loadDocuments();
      } else {
        showAlert('Error al guardar cambios');
      }
    } catch (e) {
      showAlert('Error de red');
    }
  };

  const counts = getCounts();

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest overflow-hidden">
      <div className="p-8 sm:px-12 md:pr-28 border-b border-outline-variant/30 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-on-surface">Documentos</h1>
            <p className="text-on-surface-variant text-sm mt-1">
              {counts.all} documentos - certificados, consentimientos y recetas
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsTemplateModalOpen(true)}
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors border border-outline-variant/30 shadow-sm"
            >
              Plantillas
            </button>
            <button 
              onClick={() => setIsGenerateModalOpen(true)}
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#3B82F6] hover:bg-blue-600 text-white transition-colors flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Nuevo documento
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-2 flex-wrap">
          <button 
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-colors border ${filterType === 'all' ? 'bg-surface-container-high border-outline-variant text-on-surface' : 'bg-transparent border-outline-variant/50 text-on-surface-variant hover:bg-surface-container'}`}
          >
            Todos <span className="bg-surface-container px-2 py-0.5 rounded-full text-xs">{counts.all}</span>
          </button>
          <button 
            onClick={() => setFilterType('certificate')}
            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-colors border ${filterType === 'certificate' ? 'bg-surface-container-high border-outline-variant text-on-surface' : 'bg-transparent border-outline-variant/50 text-on-surface-variant hover:bg-surface-container'}`}
          >
            Certificados <span className="bg-surface-container px-2 py-0.5 rounded-full text-xs">{counts.certificate}</span>
          </button>
          <button 
            onClick={() => setFilterType('consent')}
            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-colors border ${filterType === 'consent' ? 'bg-surface-container-high border-outline-variant text-on-surface' : 'bg-transparent border-outline-variant/50 text-on-surface-variant hover:bg-surface-container'}`}
          >
            Consentimientos <span className="bg-surface-container px-2 py-0.5 rounded-full text-xs">{counts.consent}</span>
          </button>
          <button 
            onClick={() => setFilterType('prescription')}
            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-colors border ${filterType === 'prescription' ? 'bg-surface-container-high border-outline-variant text-on-surface' : 'bg-transparent border-outline-variant/50 text-on-surface-variant hover:bg-surface-container'}`}
          >
            Recetas <span className="bg-surface-container px-2 py-0.5 rounded-full text-xs">{counts.prescription}</span>
          </button>
        </div>

        <div className="relative mt-2">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50">search</span>
          <input 
            type="text" 
            placeholder="Buscar por título o paciente..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-[400px] bg-surface-container-lowest border border-outline-variant/50 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors text-on-surface placeholder:text-on-surface-variant/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 sm:px-12 md:pr-28">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredDocs.length > 0 ? (
          <div className="flex flex-col gap-3">
            {filteredDocs.map(doc => (
              <div key={doc.id} className="bg-surface border border-outline-variant/30 rounded-2xl p-5 hover:border-outline-variant transition-colors flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-on-surface text-lg">{doc.title}</h3>
                  <p className="text-on-surface-variant text-sm mt-1">
                    Paciente: <span className="font-semibold text-primary">{doc.patients?.first_name} {doc.patients?.last_name}</span> • 
                    Fecha: {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDocToPrint(doc)} className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors" title="Ver / Imprimir">
                    <span className="material-symbols-outlined text-[20px]">print</span>
                  </button>
                  <button onClick={() => setDocToEdit(doc)} className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors" title="Editar">
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                  <button onClick={() => handleDelete(doc.id)} className="w-10 h-10 rounded-full hover:bg-error/10 flex items-center justify-center text-error transition-colors" title="Eliminar">
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                  <button onClick={() => handleWhatsApp(doc)} className="w-10 h-10 rounded-full hover:bg-[#25D366]/10 flex items-center justify-center text-[#25D366] transition-colors" title="Enviar por WhatsApp">
                    <span className="material-symbols-outlined text-[20px]">chat</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-surface border border-outline-variant/30 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <p className="text-on-surface-variant">Todavía no creaste documentos. Generá el primero desde "Nuevo documento".</p>
          </div>
        )}
      </div>

      {isTemplateModalOpen && (
        <TemplateModal 
          onClose={() => setIsTemplateModalOpen(false)} 
          showAlert={showAlert} 
        />
      )}

      {isGenerateModalOpen && (
        <GenerateDocumentModal 
          onClose={() => setIsGenerateModalOpen(false)} 
          onSuccess={() => {
            setIsGenerateModalOpen(false);
            showAlert('¡Documento generado con éxito!');
            loadDocuments();
          }}
          showAlert={showAlert} 
        />
      )}

      {docToPrint && (
        <PrintPreviewModal 
          document={docToPrint} 
          onClose={() => setDocToPrint(null)} 
        />
      )}

      {docToEdit && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface rounded-3xl w-[90vw] sm:w-[600px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest shrink-0">
                <h3 className="text-xl font-bold text-on-surface">Editar Documento</h3>
                <button onClick={() => setDocToEdit(null)} className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <form onSubmit={handleSaveEdit} className="p-6 flex flex-col gap-4 overflow-y-auto">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-2">Contenido</label>
                  <textarea 
                    value={docToEdit.content} 
                    onChange={e => setDocToEdit({...docToEdit, content: e.target.value})} 
                    rows={12}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary resize-y" 
                    required
                  ></textarea>
                </div>
                <div className="flex justify-end pt-4 border-t border-outline-variant/30 mt-2">
                  <button type="submit" className="px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-on-primary hover:bg-primary/90 transition-colors">
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {alertDialog.isOpen && (
        <AlertDialog 
          isOpen={alertDialog.isOpen}
          title={alertDialog.title} 
          message={alertDialog.message} 
          onCancel={() => setAlertDialog(prev => ({...prev, isOpen: false}))} 
          type={alertDialog.type}
          onConfirm={alertDialog.onConfirm}
          confirmText={alertDialog.confirmText}
        />
      )}
    </div>
  );
}
