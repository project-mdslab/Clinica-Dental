'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import AlertDialog from './AlertDialog';

interface ClinicalNote {
  id: string;
  user_id: string;
  patient_id: string;
  tooth_id: string | null;
  description: string;
  date: string;
  created_at: string;
}

export default function PatientHistory({ patient, onOpenTicket }: { patient: any, onOpenTicket?: (noteId: string) => void }) {
  const patientId = patient?.id;
  const supabase = createClient();
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState({ description: '', tooth_id: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [availableColegioTreatments, setAvailableColegioTreatments] = useState<any[]>([]);
  const [availableInsuranceTreatments, setAvailableInsuranceTreatments] = useState<any[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [insuranceName, setInsuranceName] = useState('Obra Social');
  const [selectedTreatmentsForBilling, setSelectedTreatmentsForBilling] = useState<any[]>([]);
  const [customPractice, setCustomPractice] = useState({ description: '', value: 0 });
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'alert' as 'alert' | 'confirm', onConfirm: () => {}, confirmText: 'Aceptar' });

  const showAlert = (message: string, title?: string) => {
    setAlertDialog({ isOpen: true, title: title || 'Atención', message, type: 'alert', onConfirm: () => setAlertDialog(prev => ({ ...prev, isOpen: false })), confirmText: 'Aceptar' });
  };

  useEffect(() => {
    if (patientId) {
      fetchNotes();
      fetchTreatments();
    }
  }, [patientId]);

  const fetchTreatments = async () => {
    const { data: colegioTreatments } = await supabase.from('treatments').select('*').order('code');
    setAvailableColegioTreatments(colegioTreatments || []);

    if (patient?.insurance_id) {
      const { data: insInfo } = await supabase.from('insurances').select('name').eq('id', patient.insurance_id).single();
      if (insInfo) setInsuranceName(insInfo.name);

      const { data: insTreatments } = await supabase
        .from('insurance_treatments')
        .select('*')
        .eq('insurance_id', patient.insurance_id)
        .order('code');
        
      setAvailableInsuranceTreatments(insTreatments || []);
    } else {
      setAvailableInsuranceTreatments([]);
    }
  };

  const fetchNotes = async () => {
    setLoading(true);
    try {
      if (patientId === '1') {
        setNotes([
          { id: '1', user_id: 'x', patient_id: '1', tooth_id: '46', description: 'Restauración oclusal con resina.', date: '2023-10-15', created_at: '' },
          { id: '2', user_id: 'x', patient_id: '1', tooth_id: null, description: 'Limpieza general y profilaxis.', date: '2023-11-20', created_at: '' }
        ]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('clinical_notes')
        .select('*')
        .eq('patient_id', patientId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalTreatments = [...selectedTreatmentsForBilling];
    if (customPractice.description && customPractice.value > 0) {
      finalTreatments.push({
        type: 'libre',
        name: customPractice.description,
        code: '',
        charged_amount: customPractice.value,
        is_copay: false
      });
    }

    if (!newNote.description && finalTreatments.length === 0) {
      showAlert('Debes seleccionar al menos una práctica, cargar una libre, o escribir una evolución.');
      return;
    }
    let generatedPrefix = "";
    if (finalTreatments.length > 0) {
      generatedPrefix = finalTreatments.map(t => 
        `• ${t.type === 'colegio' ? 'Colegio' : (t.type === 'libre' ? 'Práctica Libre' : 'O. Social')}: ${t.code ? t.code + ' - ' : ''}${t.name}`
      ).join('\n');
    }

    let finalDescription = "";
    if (generatedPrefix && newNote.description) {
      finalDescription = `${generatedPrefix}\n\nDetalle: ${newNote.description}`;
    } else if (generatedPrefix) {
      finalDescription = generatedPrefix;
    } else if (newNote.description) {
      finalDescription = newNote.description;
    } else {
      finalDescription = 'Registro de prácticas (Sin detalles)';
    }
    if (patientId === '1') {
      showAlert("No se puede editar el paciente de prueba.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No estás autenticado');

      if (editingNoteId) {
        const { error } = await supabase
          .from('clinical_notes')
          .update({
            description: finalDescription,
            tooth_id: newNote.tooth_id || null,
            date: newNote.date
          })
          .eq('id', editingNoteId);

        if (error) throw error;

        // If new treatments were added during edit, add them to the bill
        if (finalTreatments.length > 0) {
          const { data: existingBill } = await supabase.from('bills').select('*').eq('clinical_note_id', editingNoteId).single();
          
          if (existingBill) {
            const itemsToInsert = finalTreatments.map(t => ({
              bill_id: existingBill.id,
              description: t.is_copay ? `Copago/Diferencia - ${t.code ? t.code + ' - ' : ''}${t.name}` : (t.code ? `${t.code} - ${t.name}` : t.name),
              value: t.charged_amount
            }));
            await supabase.from('bill_items').insert(itemsToInsert);
            
            const addedAmount = finalTreatments.reduce((acc, t) => acc + Number(t.charged_amount), 0);
            await supabase.from('bills').update({ total_amount: Number(existingBill.total_amount) + addedAmount }).eq('id', existingBill.id);
          } else {
            const totalAmount = finalTreatments.reduce((acc, t) => acc + Number(t.charged_amount), 0);
            const { data: newBill, error: billError } = await supabase
              .from('bills')
              .insert([{ patient_id: patientId, clinical_note_id: editingNoteId, total_amount: totalAmount, created_at: new Date(newNote.date).toISOString() }])
              .select()
              .single();

            if (!billError && newBill) {
              const itemsToInsert = finalTreatments.map(t => ({
                bill_id: newBill.id,
                description: t.is_copay ? `Copago/Diferencia - ${t.code ? t.code + ' - ' : ''}${t.name}` : (t.code ? `${t.code} - ${t.name}` : t.name),
                value: t.charged_amount
              }));
              await supabase.from('bill_items').insert(itemsToInsert);
            }
          }
        }
      } else {
        const { data: newNoteData, error } = await supabase
          .from('clinical_notes')
          .insert([{
            patient_id: patientId,
            user_id: user.id,
            description: finalDescription,
            tooth_id: newNote.tooth_id || null,
            date: newNote.date
          }])
          .select()
          .single();

        if (error) throw error;

        // Automatically create a Bill if treatments were selected for this note
        if (finalTreatments.length > 0) {
          const totalAmount = finalTreatments.reduce((acc, t) => acc + Number(t.charged_amount), 0);
          
          const { data: newBill, error: billError } = await supabase
            .from('bills')
            .insert([{ patient_id: patientId, clinical_note_id: newNoteData.id, total_amount: totalAmount, created_at: new Date(newNote.date).toISOString() }])
            .select()
            .single();

          if (!billError && newBill) {
            const itemsToInsert = finalTreatments.map(t => ({
              bill_id: newBill.id,
              description: t.is_copay ? `Copago/Diferencia - ${t.code ? t.code + ' - ' : ''}${t.name}` : (t.code ? `${t.code} - ${t.name}` : t.name),
              value: t.charged_amount
            }));
            await supabase.from('bill_items').insert(itemsToInsert);
          }
        }
      }
      
      setNewNote({ description: '', tooth_id: '', date: format(new Date(), 'yyyy-MM-dd') });
      setSelectedTreatmentsForBilling([]);
      setCustomPractice({ description: '', value: 0 });
      setEditingNoteId(null);
      fetchNotes();
    } catch (err: any) {
      console.error('Error saving note:', err);
      showAlert('Error al guardar la nota: ' + (err.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (note: ClinicalNote) => {
    setNewNote({
      description: note.description,
      tooth_id: note.tooth_id || '',
      date: note.date
    });
    setEditingNoteId(note.id);
  };

  const handleCancelEdit = () => {
    setNewNote({ description: '', tooth_id: '', date: format(new Date(), 'yyyy-MM-dd') });
    setEditingNoteId(null);
    setCustomPractice({ description: '', value: 0 });
    setSelectedTreatmentsForBilling([]);
  };

  const handleDeleteNote = (id: string) => {
    if (patientId === '1') {
      showAlert("No se puede editar el paciente de prueba.");
      return;
    }
    
    setAlertDialog({
      isOpen: true,
      title: 'Eliminar Evolución',
      message: '¿Estás seguro de eliminar este registro del historial?',
      type: 'confirm',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        setAlertDialog(prev => ({ ...prev, isOpen: false }));
        try {
          const { error } = await supabase.from('clinical_notes').delete().eq('id', id);
          if (error) throw error;
          fetchNotes();
          if (editingNoteId === id) handleCancelEdit();
        } catch (err: any) {
          showAlert('Error al eliminar: ' + err.message);
        }
      }
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario Nueva Evolución */}
      <div className="lg:col-span-1 order-2 lg:order-2 bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 shadow-sm self-start sticky top-8">
        <h3 className="text-xl font-black text-on-surface mb-4">
          {editingNoteId ? 'Editar Práctica Odontológica' : 'Práctica Odontológica'}
        </h3>
        <form onSubmit={handleAddNote} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Fecha</label>
            <input 
              type="date"
              className="w-full bg-surface-container border border-outline-variant rounded-xl p-3 text-sm focus:border-primary outline-none"
              value={newNote.date}
              onChange={e => setNewNote({...newNote, date: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Pieza (Opcional)</label>
            <input 
              type="text"
              placeholder="Ej. 46, 21, Todas..."
              className="w-full bg-surface-container border border-outline-variant rounded-xl p-3 text-sm focus:border-primary outline-none"
              value={newNote.tooth_id}
              onChange={e => setNewNote({...newNote, tooth_id: e.target.value})}
            />
          </div>
          <div>
            <div className="mb-2">
              <label className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2 block">Nomenclador Colegio</label>
              <select 
                className="w-full bg-blue-50/50 border border-blue-200 rounded-xl p-3 text-sm focus:border-blue-500 outline-none text-blue-900"
                value=""
                onChange={(e) => {
                  const t = availableColegioTreatments.find(x => x.id === e.target.value);
                  if (t) {
                    setSelectedTreatmentsForBilling(prev => [...prev, { 
                      ...t, 
                      type: 'colegio',
                      charged_amount: Number(t.colegio_price || 0),
                      is_copay: false
                    }]);
                    e.target.value = ""; // Reset select
                  }
                }}
              >
                <option value="">-- Práctica del Colegio --</option>
                {availableColegioTreatments.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.code ? t.code+' - ' : ''}{t.name} (Colegio de Odontólogos: ${Number(t.colegio_price||0).toLocaleString('es-AR')})
                  </option>
                ))}
              </select>
            </div>

            {patient?.insurance_id && (
              <div className="mb-2">
                <label className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 block">Nomenclador {insuranceName}</label>
                <select 
                  className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none text-emerald-900"
                  value=""
                  onChange={(e) => {
                    const t = availableInsuranceTreatments.find(x => x.id === e.target.value);
                    if (t) {
                      const colegioMatch = availableColegioTreatments.find(c => c.code === t.code);
                      const base_colegio_price = colegioMatch ? Number(colegioMatch.colegio_price) : Number(t.price);
                      const insurance_coverage = Number(t.price);
                      const diff = Math.max(0, base_colegio_price - insurance_coverage);

                      setSelectedTreatmentsForBilling(prev => [...prev, { 
                        ...t, 
                        type: 'insurance',
                        base_colegio_price,
                        insurance_coverage,
                        charged_amount: diff,
                        is_copay: true
                      }]);
                      e.target.value = ""; // Reset select
                    }
                  }}
                >
                  <option value="">-- Práctica de la Obra Social --</option>
                  {availableInsuranceTreatments.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.code ? t.code+' - ' : ''}{t.name} ({insuranceName}: ${Number(t.price||0).toLocaleString('es-AR')})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedTreatmentsForBilling.length > 0 && (
              <div className="mb-4 space-y-3">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Prácticas Seleccionadas a Cobrar</label>
                <div className="flex flex-col gap-3">
                  {selectedTreatmentsForBilling.map((t, idx) => (
                    <div key={idx} className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/50 flex flex-col gap-3 animate-in fade-in zoom-in-95">
                      <div className="flex items-center justify-between">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium ${t.type === 'insurance' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                           <span className="material-symbols-outlined text-[16px]">{t.type === 'insurance' ? 'account_balance_wallet' : 'verified'}</span>
                           {t.code ? `${t.code} - ` : ''}{t.name}
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setSelectedTreatmentsForBilling(prev => prev.filter((_, i) => i !== idx))} 
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                      
                      {t.is_copay ? (
                        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-surface rounded-lg p-3 border border-outline-variant/30">
                          <div className="flex-1 flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-on-surface-variant">Valor Colegio</span>
                            <span className="text-sm font-medium">${t.base_colegio_price?.toLocaleString('es-AR')}</span>
                          </div>
                          <div className="flex-1 flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-on-surface-variant">Cobertura O. Social</span>
                            <span className="text-sm font-medium text-emerald-600">-${t.insurance_coverage?.toLocaleString('es-AR')}</span>
                          </div>
                          <div className="flex-1 flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-primary">Diferencia a Cobrar ($)</span>
                            <input 
                              type="number"
                              className="w-full bg-surface-container-lowest border-b-2 border-primary focus:outline-none py-1 text-base font-bold text-primary"
                              value={t.charged_amount}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setSelectedTreatmentsForBilling(prev => prev.map((item, i) => i === idx ? { ...item, charged_amount: val } : item));
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-surface rounded-lg p-3 border border-outline-variant/30">
                          <div className="flex-1 flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-primary">Monto a Cobrar ($)</span>
                            <input 
                              type="number"
                              className="w-full bg-surface-container-lowest border-b-2 border-primary focus:outline-none py-1 text-base font-bold text-primary"
                              value={t.charged_amount}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setSelectedTreatmentsForBilling(prev => prev.map((item, i) => i === idx ? { ...item, charged_amount: val } : item));
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Práctica no nomenclada */}
            <div className="flex gap-4 items-end flex-wrap bg-orange-50/50 p-4 rounded-xl border border-orange-200 mb-2">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-1 block">Práctica no nomenclada (Nombre)</label>
                <input 
                  type="text"
                  placeholder="Descripción de la práctica libre..."
                  className="w-full bg-white border border-orange-200 rounded-xl p-3 text-sm focus:border-orange-500 outline-none text-orange-900"
                  value={customPractice.description}
                  onChange={e => setCustomPractice({ ...customPractice, description: e.target.value })}
                />
              </div>
              <div className="w-[150px]">
                <label className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-1 block">Precio ($)</label>
                <input 
                  type="number"
                  min="0"
                  className="w-full bg-white border border-orange-200 rounded-xl p-3 text-sm focus:border-orange-500 outline-none text-orange-900"
                  value={customPractice.value === 0 && !customPractice.description ? '' : customPractice.value}
                  onChange={e => setCustomPractice({ ...customPractice, value: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">Descripción / Evolución (Opcional)</label>
              <textarea 
                placeholder="Detalle de lo realizado en la sesión..."
                className="w-full bg-surface-container border border-outline-variant rounded-xl p-3 text-sm focus:border-primary outline-none min-h-[120px] resize-y"
                value={newNote.description}
                onChange={e => setNewNote({...newNote, description: e.target.value})}
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button 
                type="submit"
                disabled={saving}
                className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 transition-all flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span className="material-symbols-outlined text-[20px]">{editingNoteId ? 'save' : 'add'}</span>
                )}
                {editingNoteId ? 'Guardar Cambios' : 'Registrar'}
              </button>
              
              {editingNoteId && (
                <button 
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-surface-container-high text-on-surface py-3 px-4 rounded-xl font-bold hover:bg-outline-variant/30 transition-all"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Timeline */}
      <div className="lg:col-span-2 order-1 lg:order-1">
        <h3 className="text-xl font-black text-on-surface mb-6">Línea de Tiempo</h3>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant/50 bg-surface-container/30 rounded-3xl border border-outline-variant/50">
            <span className="material-symbols-outlined text-5xl mb-4">history</span>
            <p className="font-medium">No hay registros de evolución para este paciente.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-primary/20 ml-4 md:ml-6 space-y-8 pb-8">
            {notes.map((note) => {
              const isAbsence = note.description?.includes('AUSENTE al turno programado');
              const isAttendance = note.description?.includes('asistió al turno programado');
              
              return (
              <div key={note.id} className="relative pl-8 md:pl-10">
                {/* Timeline Dot */}
                <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full ring-4 ring-surface-container-lowest shadow-sm flex items-center justify-center ${isAbsence ? 'bg-error' : isAttendance ? 'bg-[#10B981]' : 'bg-primary'}`}>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                
                {/* Content Card */}
                <div 
                  onClick={() => onOpenTicket?.(note.id)}
                  className={`bg-surface-container-lowest border ${isAbsence ? 'border-error/30 bg-error/5' : isAttendance ? 'border-[#10B981]/30 bg-[#10B981]/5' : 'border-outline-variant'} shadow-sm rounded-2xl p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg text-sm">
                        {format(parseISO(note.date), "d 'de' MMMM, yyyy", { locale: es })}
                      </span>
                      {note.tooth_id && (
                        <span className="flex items-center gap-1 text-xs font-bold bg-surface-container-high px-2 py-1 rounded-md text-on-surface-variant">
                          <span className="material-symbols-outlined text-[14px]">dentistry</span>
                          Pieza {note.tooth_id}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEditClick(note); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                        title="Eliminar"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-on-surface flex flex-col gap-1.5 mt-2">
                    {note.description?.split('\n').map((line: string, i: number) => {
                      if (line.startsWith('• Colegio:')) {
                        return <span key={i} className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg text-sm font-medium self-start shadow-sm"><span className="material-symbols-outlined text-[16px]">verified</span>{line.replace('• Colegio: ', 'Colegio: ')}</span>;
                      } else if (line.startsWith('• O. Social:')) {
                        return <span key={i} className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-sm font-medium self-start shadow-sm"><span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>{line.replace('• O. Social: ', 'Obra Social: ')}</span>;
                      } else if (line.trim() === '') {
                        return null;
                      } else if (line.includes('AUSENTE al turno programado')) {
                        return <span key={i} className="inline-flex items-center gap-1.5 bg-error/10 text-error border border-error/20 px-3 py-1.5 rounded-lg text-sm font-bold self-start mt-1"><span className="material-symbols-outlined text-[18px]">cancel</span>{line}</span>;
                      } else if (line.includes('asistió al turno programado')) {
                        return <span key={i} className="inline-flex items-center gap-1.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 px-3 py-1.5 rounded-lg text-sm font-bold self-start mt-1"><span className="material-symbols-outlined text-[18px]">check_circle</span>{line}</span>;
                      }
                      return <p key={i} className={i === 0 ? '' : 'mt-1 whitespace-pre-wrap'}>{line}</p>;
                    })}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
      
      <AlertDialog 
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
        onConfirm={alertDialog.onConfirm}
        onCancel={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
        confirmText={alertDialog.confirmText}
      />
    </>
  );
}
