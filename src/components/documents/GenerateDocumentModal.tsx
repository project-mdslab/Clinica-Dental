'use client';
import { useState, useEffect, useRef } from 'react';
import Portal from '@/components/Portal';
import { createClient } from '@/utils/supabase/client';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  dni?: string;
}

interface Template {
  id: string;
  title: string;
  type: string;
  content: string;
}

interface GenerateDocumentModalProps {
  onClose: () => void;
  onSuccess: () => void;
  showAlert: (msg: string) => void;
}

export default function GenerateDocumentModal({ onClose, onSuccess, showAlert }: GenerateDocumentModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form selections
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  // Step management
  const [step, setStep] = useState<1 | 2>(1);
  const [finalContent, setFinalContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Signature
  const signatureRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Professional metadata
  const [professionalMeta, setProfessionalMeta] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    
    // Fetch professional metadata
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.user_metadata) {
        setProfessionalMeta(data.user.user_metadata);
      }
    });

    Promise.all([
      supabase.from('patients').select('id, first_name, last_name, document_id').order('first_name'),
      fetch('/api/document-templates').then(r => r.json())
    ]).then(([patientsRes, tData]) => {
      if (patientsRes.data) {
        setPatients(patientsRes.data.map(p => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          dni: p.document_id
        })));
      }
      setTemplates(tData);
      setIsLoading(false);
    }).catch(() => {
      showAlert('Error al cargar datos');
      setIsLoading(false);
    });
  }, []);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const handleNextStep = () => {
    if (!selectedPatientId || !selectedTemplateId) {
      return showAlert('Seleccioná un paciente y una plantilla');
    }

    // Replace variables
    if (selectedTemplate && selectedPatient) {
      let content = selectedTemplate.content;
      content = content.replace(/\{\{nombre_paciente\}\}/g, `${selectedPatient.first_name} ${selectedPatient.last_name}`);
      content = content.replace(/\{\{dni_paciente\}\}/g, selectedPatient.dni || '_____________');
      content = content.replace(/\{\{fecha\}\}/g, new Date().toLocaleDateString());
      
      // Professional variables
      let profName = '';
      if (professionalMeta) {
        if (professionalMeta.first_name) {
          profName = `${professionalMeta.first_name} ${professionalMeta.last_name || ''}`.trim();
        } else if (professionalMeta.full_name) {
          profName = professionalMeta.full_name;
        } else if (professionalMeta.name) {
          profName = professionalMeta.name;
        }
      }
      
      const profMatricula = professionalMeta?.matricula || '';
      const profAddress = professionalMeta?.clinic_address || '';
      
      // Generate bold signature with markdown `**text**`
      const firmaText = profName ? `**${profName}**${profMatricula ? `\nMatrícula: ${profMatricula}` : ''}` : '';
      
      content = content.replace(/\{\{firma_profesional\}\}/g, firmaText);
      content = content.replace(/\{\{matricula\}\}/g, profMatricula);
      content = content.replace(/\{\{direccion\}\}/g, profAddress);
      
      setFinalContent(content);
    }
    
    setStep(2);
  };

  // Signature Pad Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    setHasSignature(true);
    
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = async () => {
    if (!finalContent.trim()) return showAlert('El documento no puede estar vacío');
    
    setIsSaving(true);
    
    let signature_url = null;
    if (selectedTemplate?.type === 'consent' && hasSignature && signatureRef.current) {
      signature_url = signatureRef.current.toDataURL('image/png');
    }

    try {
      const payload = {
        patient_id: selectedPatientId,
        template_id: selectedTemplateId,
        title: selectedTemplate?.title || 'Documento',
        type: selectedTemplate?.type || 'certificate',
        content: finalContent,
        signature_url
      };

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        showAlert(data.error || 'Error al generar documento');
      }
    } catch (e) {
      showAlert('Error de red');
    }
    setIsSaving(false);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
        <div className="bg-surface rounded-3xl w-[90vw] sm:w-[600px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
          <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest shrink-0">
            <h3 className="text-xl font-bold text-on-surface">
              Nuevo Documento
            </h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : step === 1 ? (
              <div className="flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-2">1. Seleccionar Paciente</label>
                  <select 
                    value={selectedPatientId} 
                    onChange={e => setSelectedPatientId(e.target.value)} 
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Seleccioná un paciente --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface mb-2">2. Seleccionar Plantilla</label>
                  <select 
                    value={selectedTemplateId} 
                    onChange={e => setSelectedTemplateId(e.target.value)} 
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Seleccioná una plantilla --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.title} ({t.type})</option>
                    ))}
                  </select>
                  {templates.length === 0 && (
                    <p className="text-xs text-error mt-2">No hay plantillas creadas. Primero crea una desde el botón "Plantillas".</p>
                  )}
                </div>

                <div className="flex justify-end pt-4 mt-2 border-t border-outline-variant/30">
                  <button 
                    onClick={handleNextStep}
                    disabled={!selectedPatientId || !selectedTemplateId}
                    className="px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Siguiente paso
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1 flex justify-between items-center">
                    <span>Revisar y editar documento</span>
                    <span className="text-xs font-normal text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                      Paciente: {selectedPatient?.first_name}
                    </span>
                  </label>
                  <textarea 
                    value={finalContent} 
                    onChange={e => setFinalContent(e.target.value)} 
                    rows={8}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary resize-y" 
                  ></textarea>
                </div>

                {selectedTemplate?.type === 'consent' && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-bold text-on-surface">Firma del paciente (Opcional)</label>
                      {hasSignature && (
                        <button onClick={clearSignature} className="text-xs text-error font-bold hover:underline">Borrar firma</button>
                      )}
                    </div>
                    <div className="border border-outline-variant rounded-xl overflow-hidden bg-white touch-none">
                      <canvas 
                        ref={signatureRef}
                        width={500} 
                        height={150}
                        className="w-full h-[150px] cursor-crosshair touch-none"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                    </div>
                    <p className="text-[11px] text-on-surface-variant text-center mt-1">El paciente puede firmar con el mouse o con el dedo en pantallas táctiles.</p>
                  </div>
                )}

                <div className="flex justify-between items-center pt-4 border-t border-outline-variant/30 mt-2">
                  <button onClick={() => setStep(1)} className="text-sm font-bold text-on-surface-variant hover:text-on-surface">Volver</button>
                  <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                    {isSaving ? 'Guardando...' : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">check</span>
                        Generar Documento
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
