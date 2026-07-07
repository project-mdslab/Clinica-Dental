'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Odontogram, { OdontogramState } from '@/components/Odontogram';
import PatientHistory from '@/components/PatientHistory';
import PatientBudgets from '@/components/PatientBudgets';
import PatientBilling from '@/components/PatientBilling';
import AlertDialog from '@/components/AlertDialog';

export default function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const supabase = createClient();
  
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [insuranceName, setInsuranceName] = useState<string | null>(null);
  const [insurances, setInsurances] = useState<any[]>([]);
  
  const [odontogramState, setOdontogramState] = useState<OdontogramState>({});
  const [activeTab, setActiveTab] = useState<'odontogram' | 'history' | 'general' | 'medical' | 'budgets' | 'billing'>('history');
  const [autoOpenBillForNote, setAutoOpenBillForNote] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [savingData, setSavingData] = useState(false);
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'alert' as 'alert' | 'confirm', onConfirm: () => {}, confirmText: 'Aceptar' });

  const showAlert = (message: string, title?: string) => {
    setAlertDialog({ isOpen: true, title: title || 'Atención', message, type: 'alert', onConfirm: () => setAlertDialog(prev => ({ ...prev, isOpen: false })), confirmText: 'Aceptar' });
  };

  useEffect(() => {
    fetchPatient();
    fetchInsurances();
  }, [id]);

  const fetchInsurances = async () => {
    const { data } = await supabase.from('insurances').select('id, name').order('name');
    if (data) setInsurances(data);
  };

  const fetchPatient = async () => {
    try {


      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      
      setPatient(data);
      if (data.insurance_id) {
        const { data: insData } = await supabase.from('insurances').select('name').eq('id', data.insurance_id).single();
        if (insData) setInsuranceName(insData.name);
      } else {
        setInsuranceName('Particular');
      }
      if (data.odontogram_state) {
        setOdontogramState(data.odontogram_state);
      }
    } catch (err: any) {
      console.error("Error fetching patient:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOdontogram = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update({ odontogram_state: odontogramState })
        .eq('id', id);
        
      if (error) throw error;
      showAlert("Odontograma guardado correctamente");
    } catch (err: any) {
      console.error("Error saving odontogram:", err);
      showAlert("Error al guardar el odontograma.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = () => {
    setEditForm({ ...patient });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveData = async () => {
    if (id === '1') {
      showAlert("No se puede editar el paciente de prueba.");
      setIsEditing(false);
      return;
    }
    setSavingData(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update(editForm)
        .eq('id', id);
        
      if (error) throw error;
      
      setPatient({ ...patient, ...editForm });
      if ('insurance_id' in editForm) {
        if (!editForm.insurance_id) {
          setInsuranceName('Particular');
        } else {
          const matched = insurances.find(i => i.id === editForm.insurance_id);
          if (matched) setInsuranceName(matched.name);
        }
      }
      setIsEditing(false);
    } catch (err: any) {
      console.error("Error saving data:", err);
      showAlert("Error al guardar los datos.");
    } finally {
      setSavingData(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold">Paciente no encontrado</h2>
        <Link href="/patients" className="text-primary hover:underline mt-4 inline-block">Volver a Pacientes</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/patients" className="w-10 h-10 bg-surface-container rounded-xl flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-3xl font-black text-on-surface tracking-tight">
              {patient.first_name} {patient.last_name}
            </h1>
            <p className="text-sm text-on-surface-variant font-medium mt-1">
              DNI: {patient.document_id || 'N/A'} • {patient.phone || 'Sin teléfono'}
            </p>
            <div className="mt-2 flex items-center">
              {insuranceName ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-base font-bold bg-emerald-100 border border-emerald-200 text-emerald-800">
                  <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                  Obra Social: {insuranceName}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-base font-bold bg-blue-100 border border-blue-200 text-blue-800">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  Paciente Particular
                </span>
              )}
            </div>
          </div>
        </div>
        
        {activeTab === 'odontogram' ? (
          <button 
            onClick={handleSaveOdontogram}
            disabled={saving}
            className="bg-primary text-on-primary px-6 py-3 rounded-2xl font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="material-symbols-outlined text-[20px]">save</span>
            )}
            Guardar Odontograma
          </button>
        ) : (
          <div className="hidden sm:block w-[200px]"></div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/30 mb-8 overflow-x-auto">
        <button 
          onClick={() => { setActiveTab('history'); setIsEditing(false); }}
          className={`px-6 py-3 font-bold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'history' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container/50'}`}
        >
          Historial
        </button>
        <button 
          onClick={() => setActiveTab('odontogram')}
          className={`px-6 py-3 font-bold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'odontogram' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container/50'}`}
        >
          Odontograma
        </button>
        <button 
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 font-bold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'general' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container/50'}`}
        >
          Información General
        </button>
        <button 
          onClick={() => { setActiveTab('medical'); setIsEditing(false); }}
          className={`px-6 py-3 font-bold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'medical' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container/50'}`}
        >
          Anamnesis
        </button>
        <button 
          onClick={() => { setActiveTab('billing'); setIsEditing(false); }}
          className={`px-6 py-3 font-bold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'billing' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container/50'}`}
        >
          Facturación
        </button>
        <button 
          onClick={() => { setActiveTab('budgets'); setIsEditing(false); }}
          className={`px-6 py-3 font-bold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'budgets' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container/50'}`}
        >
          Presupuestos
        </button>
      </div>

      {/* Helper para renderizar campos editables */}
      {(() => {
        const EditableField = ({ label, field, type = 'text', isTextArea = false, isSelect = false, options = [] }: { label: string, field: string, type?: string, isTextArea?: boolean, isSelect?: boolean, options?: {value: string, label: string}[] }) => {
          if (isEditing) {
            if (isSelect) {
              return (
                <div className="flex flex-col gap-0.5 px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{label}</span>
                  <select 
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1.5 text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    value={editForm[field] || ''}
                    onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value === '' ? null : e.target.value })}
                  >
                    {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              );
            }
            if (isTextArea) {
              return (
                <div className="flex flex-col gap-0.5 p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 md:col-span-2">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{label}</span>
                  <textarea 
                    className="w-full bg-surface-container border border-outline-variant rounded-xl p-2 text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none min-h-[80px] resize-y"
                    value={editForm[field] || ''}
                    onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                  />
                </div>
              );
            }
            return (
              <div className="flex flex-col gap-0.5 p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{label}</span>
                <input 
                  type={type}
                  className="w-full bg-surface-container border border-outline-variant rounded-xl p-2 text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={editForm[field] || ''}
                  onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                />
              </div>
            );
          }

          // View Mode
          const val = patient[field];
          let displayVal = val || '-';
          if (val && field === 'birth_date') displayVal = new Date(val).toLocaleDateString();
          if (field === 'insurance_id') {
            displayVal = val ? insurances.find(i => i.id === val)?.name || '-' : 'Particular';
          }

          return (
            <div className={`flex flex-col gap-0.5 p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 ${isTextArea ? 'md:col-span-2' : ''}`}>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{label}</span>
              <span className={`text-sm font-semibold text-on-surface ${isTextArea ? 'whitespace-pre-wrap' : ''} ${field === 'first_name' || field === 'last_name' || field === 'insurance_id' ? 'capitalize' : ''}`}>{displayVal}</span>
            </div>
          );
        };

        return (
          <>
            {/* Tab Content */}
      {activeTab === 'odontogram' && (
        <div className="max-w-7xl bg-surface rounded-[2rem] shadow-sm border border-outline-variant/20 p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-on-surface">Odontograma Interactivo</h2>
            <p className="text-sm text-on-surface-variant mt-1">Selecciona una herramienta de la paleta y haz clic en las caras del diente o en el diente completo para marcar extracciones y coronas.</p>
          </div>
          <Odontogram 
            initialState={odontogramState} 
            onStateChange={setOdontogramState} 
          />
        </div>
      )}

      {activeTab === 'general' && (
        <div className="max-w-5xl bg-surface rounded-[2rem] shadow-sm border border-outline-variant/20 p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-on-surface">Información General</h2>
              <p className="text-sm text-on-surface-variant mt-1">Datos personales y de contacto del paciente.</p>
            </div>
            
            {!isEditing ? (
              <button onClick={handleEditClick} className="flex items-center gap-2 bg-surface-container border border-outline-variant/30 px-4 py-2 rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-[18px]">edit</span> Editar Datos
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={handleCancelEdit} disabled={savingData} className="px-4 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={handleSaveData} disabled={savingData} className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50">
                  {savingData ? <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[18px]">save</span>}
                  Guardar
                </button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField label="Nombre" field="first_name" />
            <EditableField label="Apellido" field="last_name" />
            <EditableField label="Documento (DNI/Pasaporte)" field="document_id" />
            <EditableField label="Teléfono" field="phone" />
            <EditableField label="Correo Electrónico" field="email" type="email" />
            <EditableField label="Fecha de Nacimiento" field="birth_date" type="date" />
            <EditableField label="Grupo Sanguíneo" field="blood_type" />
            <EditableField label="Obra Social" field="insurance_id" isSelect options={[{value: '', label: 'Particular'}, ...insurances.map(i => ({value: i.id, label: i.name}))]} />
            <EditableField label="Número de Afiliado (Obra Social)" field="affiliate_number" />
            <div className="hidden md:block"></div>
            <EditableField label="Dirección" field="address" isTextArea />
            <EditableField label="Ocupación" field="occupation" isTextArea />
          </div>
        </div>
      )}

      {activeTab === 'medical' && (
        <div className="max-w-5xl bg-surface rounded-[2rem] shadow-sm border border-outline-variant/20 p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-on-surface">Historial Médico</h2>
              <p className="text-sm text-on-surface-variant mt-1">Antecedentes de salud e historia clínica odontológica.</p>
            </div>

            {!isEditing ? (
              <button onClick={handleEditClick} className="flex items-center gap-2 bg-surface-container border border-outline-variant/30 px-4 py-2 rounded-xl text-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-[18px]">edit</span> Editar Historial
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={handleCancelEdit} disabled={savingData} className="px-4 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={handleSaveData} disabled={savingData} className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50">
                  {savingData ? <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[18px]">save</span>}
                  Guardar
                </button>
              </div>
            )}
          </div>
          
          <h3 className="text-lg font-bold text-on-surface mb-4 mt-8 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">health_and_safety</span>
            Antecedentes de Salud
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField label="Alergias" field="allergies" isTextArea />
            <EditableField label="Medicación Habitual y Tratamientos" field="medical_treatments" isTextArea />
            <EditableField label="Enfermedades Sistémicas" field="systemic_diseases" isTextArea />
            <EditableField label="Infecciones y Otras" field="infectious_diseases" isTextArea />
            <EditableField label="Condiciones Específicas" field="specific_conditions" isTextArea />
            <EditableField label="Quirúrgicos / Hemorragias" field="surgeries" isTextArea />
            <EditableField label="Hábitos y Estado" field="habits" isTextArea />
          </div>

          <h3 className="text-lg font-bold text-on-surface mb-4 mt-12 flex items-center gap-2">
            <span className="material-symbols-outlined text-dentistry">dentistry</span>
            Historia Clínica Odontológica
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField label="Motivo Principal de Consulta" field="main_complaint" isTextArea />
            <EditableField label="Evaluación del Dolor" field="pain_history" isTextArea />
            <EditableField label="Traumatismos Previos" field="dental_trauma" isTextArea />
            <EditableField label="Dificultades Funcionales" field="functional_difficulties" isTextArea />
            <EditableField label="Plan de Tratamiento y Observaciones" field="treatment_plan" isTextArea />
          </div>
        </div>
      )}
          </>
        );
      })()}

      {/* HISTORIAL / EVOLUCION TAB */}
      {activeTab === 'history' && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <PatientHistory 
            patient={patient} 
            onOpenTicket={(noteId) => {
              setAutoOpenBillForNote(noteId);
              setActiveTab('billing');
            }}
          />
        </div>
      )}

      {/* PRESUPUESTOS TAB */}
      {activeTab === 'budgets' && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <PatientBudgets patient={patient} />
        </div>
      )}

      {/* FACTURACIÓN TAB */}
      {activeTab === 'billing' && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <PatientBilling 
            patient={patient} 
            autoOpenNoteId={autoOpenBillForNote}
            onAutoOpenClear={() => setAutoOpenBillForNote(null)}
          />
        </div>
      )}

      <AlertDialog 
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
        onConfirm={alertDialog.onConfirm}
        onCancel={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
        confirmText={alertDialog.confirmText}
      />
    </div>
  );
}
