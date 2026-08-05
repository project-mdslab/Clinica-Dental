import { useState, useEffect } from 'react';
import Portal from '@/components/Portal';

interface PrintPreviewModalProps {
  document: {
    title: string;
    content: string;
    signature_url?: string;
    created_at: string;
    professional_id?: string;
    patients: { first_name: string; last_name: string; dni?: string };
  };
  onClose: () => void;
}

export default function PrintPreviewModal({ document, onClose }: PrintPreviewModalProps) {
  const [professionalMeta, setProfessionalMeta] = useState<any>(null);

  useEffect(() => {
    // Fetch professional metadata from team API to get logo and address
    fetch('/api/team')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          // If the document has a professional_id, match it. If not, just use the first professional (or logged in user) as fallback for the clinic details
          const prof = document.professional_id 
            ? data.find(p => p.id === document.professional_id) 
            : data[0];
            
          if (prof) {
            setProfessionalMeta(prof);
          }
        }
      })
      .catch(console.error);
  }, [document.professional_id]);

  const handlePrint = () => {
    window.print();
  };

  // Helper to render basic markdown bold (**text**)
  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const Header = () => (
    <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-8">
      <div>
        {professionalMeta?.clinic_logo_url ? (
          <img src={professionalMeta.clinic_logo_url} alt="Logo Clínica" className="h-20 object-contain" />
        ) : (
          <div className="text-2xl font-black uppercase text-black">
            Clínica Dental
          </div>
        )}
      </div>
      <div className="text-right text-xs text-black/70 font-semibold max-w-[250px]">
        {professionalMeta?.clinic_address && (
          <p>{professionalMeta.clinic_address}</p>
        )}
        <p>Fecha: {new Date(document.created_at).toLocaleDateString()}</p>
      </div>
    </div>
  );

  const Watermark = () => {
    if (!professionalMeta?.clinic_address) return null;
    return (
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-[0.03] z-0">
        <h1 className="text-6xl font-black text-black transform -rotate-45 whitespace-nowrap">
          {professionalMeta.clinic_address}
        </h1>
      </div>
    );
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in print:bg-white print:p-0 print:block">
        
        {/* Modal UI (Hidden when printing) */}
        <div className="bg-surface rounded-3xl w-[90vw] sm:w-[800px] h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 print:hidden">
          <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest shrink-0">
            <h3 className="text-xl font-bold text-on-surface">
              Vista Previa de Impresión
            </h3>
            <div className="flex gap-2">
              <button onClick={handlePrint} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">print</span>
                Imprimir
              </button>
              <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          <div className="overflow-y-auto p-12 bg-surface-container-lowest flex-1 flex justify-center relative">
            {/* The Document Preview */}
            <div className="bg-white text-black p-12 w-full max-w-[700px] min-h-[900px] shadow-lg flex flex-col whitespace-pre-wrap relative overflow-hidden">
              <Watermark />
              
              <div className="relative z-10 flex flex-col h-full">
                <Header />
                
                <h1 className="text-2xl font-bold uppercase text-center mb-8">{document.title}</h1>
                
                <div className="flex-1 text-base leading-relaxed text-justify">
                  {renderContent(document.content)}
                </div>

                {document.signature_url && (
                <div className="mt-12 flex justify-end">
                  <div className="text-center">
                    <img src={document.signature_url} alt="Firma del paciente" className="h-20 object-contain border-b border-black mb-2" />
                    <p className="text-sm font-bold">Firma del paciente</p>
                    <p className="text-xs">Aclaración: {document.patients.first_name} {document.patients.last_name}</p>
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Printable Content (Only visible when printing) */}
        <div className="hidden print:flex flex-col bg-white text-black p-12 w-full max-w-full min-h-screen whitespace-pre-wrap relative overflow-hidden">
          <Watermark />
          
          <div className="relative z-10 flex flex-col h-full">
            <Header />
            
            <h1 className="text-2xl font-bold uppercase text-center mb-8">{document.title}</h1>
            
            <div className="flex-1 text-base leading-relaxed text-justify">
              {renderContent(document.content)}
            </div>

            {document.signature_url && (
            <div className="mt-20 flex justify-end">
              <div className="text-center">
                <img src={document.signature_url} alt="Firma del paciente" className="h-20 object-contain border-b border-black mb-2 mx-auto" />
                <p className="text-sm font-bold">Firma del paciente</p>
                <p className="text-xs">Aclaración: {document.patients.first_name} {document.patients.last_name}</p>
              </div>
            </div>
          )}
          </div>
        </div>
        
      </div>
    </Portal>
  );
}
