'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { format } from 'date-fns';
import Portal from './Portal';

interface NewAppointmentModalProps {
  isOpen: boolean;
  services?: {name: string, color: string}[];
  onClose: () => void;
  onSuccess: () => void;
}



export default function NewAppointmentModal({ isOpen, services, onClose, onSuccess }: NewAppointmentModalProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
  
  // Data
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  // Form State
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [newPatient, setNewPatient] = useState({ first_name: '', last_name: '', phone: '' });
  
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [serviceType, setServiceType] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [professionals, setProfessionals] = useState<any[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPatients();
    }
  }, [isOpen]);

  const fetchPatients = async () => {
    const { data } = await supabase.from('patients').select('id, first_name, last_name, document_id, phone');
    if (data) setPatients(data);
    
    // Fetch professionals
    const { data: profs } = await supabase.rpc('get_professionals');
    if (profs && profs.length > 0) {
      setProfessionals(profs);
      if (!professionalId) setProfessionalId(profs[0].id);
    }
  };

  const filteredPatients = patients.filter(p => 
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) || 
    (p.document_id && p.document_id.includes(search))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalPatientId = selectedPatientId;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user logged in");

      if (activeTab === 'new') {
        if (!newPatient.first_name || !newPatient.last_name) {
          alert('Nombre y apellido son obligatorios para el nuevo paciente.');
          setIsSubmitting(false);
          return;
        }
        // Insert new patient (precarga)
        const { data: insertedPatient, error: patientError } = await supabase
          .from('patients')
          .insert({
            user_id: user.id, // Assuming the creator is the current user
            first_name: newPatient.first_name,
            last_name: newPatient.last_name,
            phone: newPatient.phone,
            document_id: 'PRECARGA-' + Date.now().toString().slice(-4)
          })
          .select()
          .single();
          
        if (patientError) throw patientError;
        finalPatientId = insertedPatient.id;
      }

      if (!finalPatientId) {
        alert('Debe seleccionar un paciente.');
        setIsSubmitting(false);
        return;
      }

      // Insert appointment
      const { error: appError } = await supabase
        .from('appointments')
        .insert({
          user_id: user.id,
          patient_id: finalPatientId,
          professional_id: professionalId, // Actually professional_id is a UUID in schema, but we'll try to insert the string '1'. Supabase might fail if type is strictly UUID.
          date: date,
          start_time: `${startTime}:00`,
          end_time: `${endTime}:00`,
          service_type: serviceType,
          status: 'Scheduled'
        });

      if (appError) {
        const fallbackId = (await supabase.auth.getUser()).data.user?.id;
        const finalProfId = fallbackId || professionalId;
        console.warn("Retrying with fallback user ID", appError);
        
        const { error: retryError } = await supabase
          .from('appointments')
          .insert({
            user_id: fallbackId,
            professional_id: finalProfId,
            patient_id: finalPatientId,
            date: date,
            start_time: `${startTime}:00`,
            end_time: `${endTime}:00`,
            service_type: serviceType,
            status: 'Scheduled'
          });
        if (retryError) throw retryError;
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Hubo un error al agendar el turno. Revisa la consola.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 bg-surface/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-xl overflow-hidden border border-outline-variant flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest">
          <h2 className="text-xl font-display-sm text-on-surface">Agendar Nuevo Turno</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Tabs */}
          <div className="flex bg-surface-container p-1 rounded-xl mb-6">
            <button 
              type="button"
              onClick={() => setActiveTab('existing')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'existing' ? 'bg-surface shadow text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Paciente Existente
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('new')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'new' ? 'bg-surface shadow text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Nuevo Paciente (Precarga)
            </button>
          </div>

          <form id="appointment-form" onSubmit={handleSubmit} className="space-y-6">
            
            {activeTab === 'existing' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-on-surface-variant mb-1">Buscar Paciente</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-3 text-on-surface-variant text-[20px]">search</span>
                    <input 
                      type="text" 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Nombre, apellido o documento..." 
                      className="w-full bg-surface border border-outline-variant rounded-xl py-2 pl-10 pr-4 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto bg-surface-container-lowest border border-outline-variant rounded-xl divide-y divide-outline-variant">
                  {filteredPatients.length === 0 ? (
                    <div className="p-4 text-center text-sm text-on-surface-variant">No se encontraron pacientes.</div>
                  ) : (
                    filteredPatients.map(p => (
                      <label key={p.id} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-container-low transition-colors ${selectedPatientId === p.id ? 'bg-primary/5' : ''}`}>
                        <input 
                          type="radio" 
                          name="patient_id"
                          value={p.id}
                          checked={selectedPatientId === p.id}
                          onChange={(e) => setSelectedPatientId(e.target.value)}
                          className="text-primary focus:ring-primary"
                        />
                        <div>
                          <div className="text-sm font-bold text-on-surface">{p.first_name} {p.last_name}</div>
                          <div className="text-xs text-on-surface-variant">DNI: {p.document_id || 'N/A'} • Tel: {p.phone || 'N/A'}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'new' && (
              <div className="space-y-4 bg-surface p-4 rounded-xl border border-outline-variant">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-on-surface-variant mb-1">Nombre</label>
                    <input 
                      type="text" 
                      required
                      value={newPatient.first_name}
                      onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })}
                      className="w-full bg-surface border border-outline-variant rounded-xl py-2 px-3 text-sm text-on-surface focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-on-surface-variant mb-1">Apellido</label>
                    <input 
                      type="text" 
                      required
                      value={newPatient.last_name}
                      onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })}
                      className="w-full bg-surface border border-outline-variant rounded-xl py-2 px-3 text-sm text-on-surface focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-on-surface-variant mb-1">Teléfono</label>
                  <input 
                    type="tel" 
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                    className="w-full bg-surface border border-outline-variant rounded-xl py-2 px-3 text-sm text-on-surface focus:border-primary outline-none transition-all"
                  />
                </div>
                <p className="text-xs text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  Solo datos básicos. La historia clínica se completará después.
                </p>
              </div>
            )}

            <div className="h-px bg-outline-variant/50 w-full my-6"></div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-on-surface-variant mb-1">Día</label>
                <input 
                  type="date" 
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-xl py-2 px-3 text-sm text-on-surface focus:border-primary outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-on-surface-variant mb-1">Hora Inicio</label>
                <input 
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-xl py-2 px-3 text-sm text-on-surface focus:border-primary outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-on-surface-variant mb-1">Hora Fin</label>
                <input 
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-xl py-2 px-3 text-sm text-on-surface focus:border-primary outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-on-surface-variant mb-1">Profesional</label>
                <select 
                  value={professionalId}
                  onChange={(e) => setProfessionalId(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-xl py-2 px-3 text-sm text-on-surface focus:border-primary outline-none transition-all"
                >
                  {professionals.map(prof => (
                    <option key={prof.id} value={prof.id}>{prof.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-on-surface-variant mb-1">Práctica</label>
                <select 
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-xl py-2 px-3 text-sm text-on-surface focus:border-primary outline-none transition-all"
                >
                  <option value="">-- Opcional --</option>
                  {services?.map(srv => (
                    <option key={srv.name} value={srv.name}>{srv.name}</option>
                  ))}
                </select>
              </div>
            </div>

          </form>
        </div>
        
        <div className="p-4 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-lowest mt-auto">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="appointment-form"
            disabled={isSubmitting || (activeTab === 'existing' && !selectedPatientId)}
            className="px-6 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? 'Guardando...' : 'Agendar Turno'}
            {!isSubmitting && <span className="material-symbols-outlined text-[18px]">check</span>}
          </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
