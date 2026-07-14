'use client'
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import AlertDialog from '@/components/AlertDialog';

export default function PatientsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [patients, setPatients] = useState<any[]>([]);
  const [insurances, setInsurances] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'insurance' | 'recent'>('recent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'alert' as 'alert' | 'confirm', onConfirm: () => {}, confirmText: 'Aceptar' });

  // Reset to first page on search or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortField, sortOrder]);

  const showAlert = (message: string, title?: string) => {
    setAlertDialog({ isOpen: true, title: title || 'Atención', message, type: 'alert', onConfirm: () => setAlertDialog(prev => ({ ...prev, isOpen: false })), confirmText: 'Aceptar' });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    document_id: '',
    phone: '',
    email: '',
    birth_date: '',
    blood_type: '',
    allergies: '',
    // Nuevos campos
    affiliate_number: '',
    address: '',
    occupation: '',
    medical_treatments: '',
    systemic_diseases: '',
    infectious_diseases: '',
    specific_conditions: '',
    surgeries: '',
    habits: '',
    main_complaint: '',
    pain_history: '',
    dental_trauma: '',
    functional_difficulties: '',
    treatment_plan: '',
    insurance_id: ''
  });

  const fetchPatients = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, document_id, phone, email, created_at, insurance_id')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase Error:', error);
        throw new Error(error.message || 'Error desconocido de Supabase');
      }

      if (!data || data.length === 0) {
        setPatients([]);
      } else {
        const filteredData = data.filter((p: any) => 
          !(p.first_name === 'GUARDIA' && p.last_name === 'INTERNA') &&
          !(p.first_name === 'GUARDIA INTERNA')
        );
        setPatients(filteredData);
      }
    } catch (err: any) {
      console.error('Error fetching patients (Detailed):', err.message, err.details);
      showAlert(`Error de base de datos: ${err.message || JSON.stringify(err)}`);
      
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInsurances = async () => {
    const { data } = await supabase.from('insurances').select('id, name').order('name');
    if (data) setInsurances(data);
  };

  useEffect(() => {
    fetchPatients();
    fetchInsurances();
  }, []);

  const filteredPatients = patients.filter(p => {
    const term = search.toLowerCase();
    return (
      p.first_name.toLowerCase().includes(term) ||
      p.last_name.toLowerCase().includes(term) ||
      (p.document_id && p.document_id.includes(term))
    );
  }).sort((a, b) => {
    if (sortField === 'name') {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
      if (nameA < nameB) return sortOrder === 'asc' ? -1 : 1;
      if (nameA > nameB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    }
    if (sortField === 'insurance') {
      const hasInsA = !!a.insurance_id;
      const hasInsB = !!b.insurance_id;
      if (hasInsA && !hasInsB) return sortOrder === 'asc' ? -1 : 1;
      if (!hasInsA && hasInsB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    }
    if (sortField === 'recent') {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }
    return 0;
  });

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  const paginatedPatients = filteredPatients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (field: 'name' | 'insurance' | 'recent') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: 'name' | 'insurance' | 'recent') => {
    if (sortField !== field) return <span className="material-symbols-outlined text-[16px] text-on-surface-variant/30">unfold_more</span>;
    return <span className="material-symbols-outlined text-[16px] text-primary">{sortOrder === 'asc' ? 'expand_less' : 'expand_more'}</span>;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Asumimos que el usuario actual es el "user_id" (creador)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showAlert("Debes estar logueado");
      return;
    }

    const { data, error } = await supabase
      .from('patients')
      .insert([
        { 
          ...formData,
          user_id: user.id
        }
      ])
      .select();

    if (error) {
      console.error("Error creating patient:", error);
      showAlert("Error al crear paciente: " + error.message);
    } else {
      setIsSlideOverOpen(false);
      setFormData({
        first_name: '', last_name: '', document_id: '', phone: '', email: '', birth_date: '', blood_type: '', allergies: '',
        affiliate_number: '', address: '', occupation: '', medical_treatments: '', systemic_diseases: '', infectious_diseases: '',
        specific_conditions: '', surgeries: '', habits: '', main_complaint: '', pain_history: '', dental_trauma: '', functional_difficulties: '', treatment_plan: '', insurance_id: ''
      });
      fetchPatients();
    }
  };

  // Stats calculations
  const totalPatients = patients.length;
  const patientsWithInsurance = patients.filter(p => p.insurance_id).length;
  const patientsParticular = totalPatients - patientsWithInsurance;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const newPatientsThisMonth = patients.filter(p => {
    if(!p.created_at) return false;
    const d = new Date(p.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  return (
    <div className="flex flex-col h-auto min-h-full w-full bg-surface">
      
      {/* Header & Search */}
      <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight">Pacientes</h1>
          <p className="text-on-surface-variant mt-1">Gestión del directorio de pacientes y sus historias clínicas.</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">search</span>
            <input 
              type="text" 
              placeholder="Buscar por nombre o DNI..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-2xl py-3 pl-12 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={() => setIsSlideOverOpen(true)}
            className="w-full md:w-auto bg-primary text-on-primary px-6 py-3 rounded-2xl font-bold text-sm shadow-md hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            Nuevo Paciente
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-6 md:px-8 pb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Pacientes */}
        <div className="bg-bina-crema rounded-3xl p-6 text-bina-taupe shadow-sm border border-bina-taupe/10 relative overflow-hidden group hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-default">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-6xl">groups</span>
          </div>
          <p className="text-bina-taupe/80 text-sm font-bold uppercase tracking-wider mb-1 group-hover:opacity-100 transition-opacity">Total Pacientes</p>
          <h2 className="text-4xl font-black">{totalPatients}</h2>
        </div>

        {/* Con Obra Social */}
        <div className="bg-bina-taupe/10 rounded-3xl p-6 text-bina-taupe shadow-sm border border-bina-taupe/10 relative overflow-hidden group hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-default">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-6xl">account_balance_wallet</span>
          </div>
          <p className="text-bina-taupe/80 text-sm font-bold uppercase tracking-wider mb-1 group-hover:opacity-100 transition-opacity">Con Obra Social</p>
          <h2 className="text-4xl font-black">{patientsWithInsurance}</h2>
        </div>

        {/* Particulares */}
        <div className="bg-bina-madera/15 rounded-3xl p-6 text-bina-taupe shadow-sm border border-bina-madera/20 relative overflow-hidden group hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-default">
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition-transform text-bina-madera">
            <span className="material-symbols-outlined text-6xl">person</span>
          </div>
          <p className="text-bina-taupe/80 text-sm font-bold uppercase tracking-wider mb-1 group-hover:opacity-100 transition-opacity">Particulares</p>
          <h2 className="text-4xl font-black">{patientsParticular}</h2>
        </div>

      </div>

      {/* Main Content (Data Grid) */}
      <div className="flex-1 px-6 md:px-8 pb-8 overflow-visible md:overflow-hidden flex flex-col">
        <div className="w-full flex-1 bg-surface-container-lowest rounded-3xl border border-outline-variant shadow-sm overflow-hidden flex flex-col relative">
          
          <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-surface-container-lowest sticky top-0 z-10 border-b border-outline-variant/50">
                <tr>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-primary transition-colors">
                      Nombre {getSortIcon('name')}
                    </button>
                  </th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    <button onClick={() => handleSort('insurance')} className="flex items-center gap-1 hover:text-primary transition-colors">
                      Obra Social {getSortIcon('insurance')}
                    </button>
                  </th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-on-surface-variant">DNI</th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Teléfono</th>
                  <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-right">
                    <button onClick={() => handleSort('recent')} className="flex items-center gap-1 justify-end ml-auto hover:text-primary transition-colors">
                      Última Visita {getSortIcon('recent')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-on-surface-variant/50">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <span className="material-symbols-outlined text-4xl animate-spin">refresh</span>
                        <p>Cargando pacientes...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-on-surface-variant/50">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <span className="material-symbols-outlined text-5xl">group_off</span>
                        <p>No se encontraron pacientes.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedPatients.map(patient => (
                    <tr 
                      key={patient.id} 
                      onClick={() => router.push(`/patients/${patient.id}`)} 
                      className="hover:bg-surface-container-low transition-colors group cursor-pointer border-b border-outline-variant/30 last:border-0"
                    >
                      {/* Name & Alerts */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-on-surface text-sm">{patient.first_name} {patient.last_name}</p>
                          {(patient.allergies || patient.systemic_diseases || patient.infectious_diseases || patient.medical_treatments) && (
                            <span 
                              title="Alerta Médica (Alergias, Enfermedad o Medicación)" 
                              className="material-symbols-outlined text-error text-[18px] animate-pulse shrink-0"
                            >
                              warning
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Obra Social */}
                      <td className="py-4 px-6 text-sm text-on-surface-variant">
                        {insurances.find(i => i.id === patient.insurance_id) ? (
                          <span className="text-on-surface font-medium">
                            {insurances.find(i => i.id === patient.insurance_id)?.name}
                          </span>
                        ) : patient.health_insurances?.name ? (
                          <span className="text-on-surface font-medium">
                            {patient.health_insurances.name}
                          </span>
                        ) : (
                          'Particular'
                        )}
                      </td>

                      {/* DNI */}
                      <td className="py-4 px-6 text-sm text-on-surface font-medium">
                        {patient.document_id || '-'}
                      </td>

                      {/* Teléfono */}
                      <td className="py-4 px-6 text-sm text-on-surface-variant">
                        {patient.phone ? (
                          <div className="flex items-center gap-2">
                            <span>{patient.phone}</span>
                            <a 
                              href={`https://wa.me/549${patient.phone.replace(/\\D/g, '')}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-green-600 hover:text-green-500 transition-colors bg-green-100/50 hover:bg-green-100 p-1.5 rounded-full flex items-center justify-center shrink-0"
                              title="Enviar WhatsApp"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                              </svg>
                            </a>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Última Visita */}
                      <td className="py-4 px-6 text-sm text-on-surface-variant text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-primary font-bold text-[11px] tracking-wider uppercase bg-primary/10 px-2 py-1 rounded-md hidden md:block">Abrir Ficha</span>
                          <span>Hace 2 meses</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant/50 bg-surface-container-lowest mt-auto">
              <span className="text-sm text-on-surface-variant font-medium">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredPatients.length)} de {filteredPatients.length} pacientes
              </span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-low disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      currentPage === page 
                        ? 'bg-primary text-on-primary shadow-sm' 
                        : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-low disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Centrado "Nuevo Paciente" vía Portal */}
      {mounted && isSlideOverOpen && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-5" style={{ zIndex: 99999 }}>
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 99998 }}
            onClick={() => setIsSlideOverOpen(false)}
          ></div>
          
          {/* Panel Modal */}
          <div 
            className="relative bg-surface rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-outline-variant/30"
            style={{ zIndex: 99999, width: '100%', maxWidth: '600px' }}
          >
            {/* Cabecera del Modal */}
            <div className="px-6 py-4 border-b border-outline-variant/50 flex items-center justify-between bg-surface-container-lowest shrink-0">
              <h2 className="text-xl font-bold text-on-surface">Nuevo Paciente</h2>
              <button 
                type="button"
                onClick={() => setIsSlideOverOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            {/* Cuerpo del Modal (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-surface">
              <form id="new-patient-form" onSubmit={handleCreatePatient} className="space-y-5">
                
                {/* 1. Datos Personales */}
                <div>
                  <h3 className="font-bold text-on-surface text-sm mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                    Datos Personales y Contacto
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Nombre <span className="text-error">*</span></label>
                        <input required name="first_name" value={formData.first_name} onChange={handleInputChange} type="text" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Ej. Juan" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Apellido <span className="text-error">*</span></label>
                        <input required name="last_name" value={formData.last_name} onChange={handleInputChange} type="text" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Ej. Pérez" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Documento (DNI/Pasaporte)</label>
                        <input name="document_id" value={formData.document_id} onChange={handleInputChange} type="text" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Sin puntos ni espacios" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Fecha de Nac.</label>
                        <input name="birth_date" value={formData.birth_date} onChange={handleInputChange} type="date" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Teléfono</label>
                        <input name="phone" value={formData.phone} onChange={handleInputChange} type="text" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Ej. 11 5555-4444" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Correo Electrónico</label>
                        <input name="email" value={formData.email} onChange={handleInputChange} type="email" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="paciente@correo.com" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-on-surface-variant">Domicilio</label>
                      <input name="address" value={formData.address} onChange={handleInputChange} type="text" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Calle, Número, Barrio, Localidad" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Obra Social / Cobertura</label>
                        <select name="insurance_id" value={formData.insurance_id} onChange={handleInputChange} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors appearance-none">
                          <option value="">Particular / Sin Cobertura</option>
                          {insurances.map(os => (
                            <option key={os.id} value={os.id}>{os.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Nº Afiliado (Obra Social)</label>
                        <input name="affiliate_number" value={formData.affiliate_number} onChange={handleInputChange} type="text" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Ej. 12345678" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Profesión / Actividad</label>
                        <input name="occupation" value={formData.occupation} onChange={handleInputChange} type="text" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Ej. Docente" />
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-outline-variant/30" />
                
                {/* 2. Antecedentes de Salud */}
                <div>
                  <h3 className="font-bold text-on-surface text-sm mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">medical_services</span>
                    Antecedentes de Salud
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Grupo Sanguíneo</label>
                        <select name="blood_type" value={formData.blood_type} onChange={handleInputChange} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors">
                          <option value="">Desconocido</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Hábitos y Estado</label>
                        <input name="habits" value={formData.habits} onChange={handleInputChange} type="text" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Fuma, embarazo, etc." />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-on-surface-variant">Alergias</label>
                      <input name="allergies" value={formData.allergies} onChange={handleInputChange} type="text" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Anestesia, penicilina, otros" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-on-surface-variant">Medicación Habitual y Tratamientos</label>
                      <textarea name="medical_treatments" value={formData.medical_treatments} onChange={handleInputChange} rows={2} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none" placeholder="Especificar qué toma habitualmente (ej. aspirina, anticoagulante)"></textarea>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Enfermedades Sistémicas</label>
                        <textarea name="systemic_diseases" value={formData.systemic_diseases} onChange={handleInputChange} rows={2} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none" placeholder="Cardíacas, renales, respiratorias, úlceras..."></textarea>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Infecciones y Otras</label>
                        <textarea name="infectious_diseases" value={formData.infectious_diseases} onChange={handleInputChange} rows={2} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none" placeholder="Hepatitis, Chagas, Sífilis, HIV..."></textarea>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Condiciones Específicas</label>
                        <textarea name="specific_conditions" value={formData.specific_conditions} onChange={handleInputChange} rows={2} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none" placeholder="Diabetes, hipertensión, epilepsia..."></textarea>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Quirúrgicos / Hemorragias</label>
                        <textarea name="surgeries" value={formData.surgeries} onChange={handleInputChange} rows={2} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none" placeholder="Operaciones previas, transfusiones..."></textarea>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-outline-variant/30" />
                
                {/* 3. Motivo de Consulta e Historia Odontológica */}
                <div>
                  <h3 className="font-bold text-on-surface text-sm mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">dentistry</span>
                    Historia Odontológica
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-on-surface-variant">Motivo Principal de Consulta</label>
                      <input name="main_complaint" value={formData.main_complaint} onChange={handleInputChange} type="text" className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="¿Por qué asiste hoy a la consulta?" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-on-surface-variant">Evaluación del Dolor</label>
                      <textarea name="pain_history" value={formData.pain_history} onChange={handleInputChange} rows={2} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none" placeholder="Suave/Moderado/Intenso, Continuo/Intermitente, al frío/calor..."></textarea>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Traumatismos Previos</label>
                        <textarea name="dental_trauma" value={formData.dental_trauma} onChange={handleInputChange} rows={2} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none" placeholder="Golpes o fracturas previas en dientes..."></textarea>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-on-surface-variant">Dificultades Funcionales</label>
                        <textarea name="functional_difficulties" value={formData.functional_difficulties} onChange={handleInputChange} rows={2} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none" placeholder="Dificultad para masticar, tragar, hablar, abrir la boca..."></textarea>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-on-surface-variant">Plan de Tratamiento y Observaciones</label>
                      <textarea name="treatment_plan" value={formData.treatment_plan} onChange={handleInputChange} rows={3} className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none" placeholder="Evolución y anotaciones generales..."></textarea>
                    </div>
                  </div>
                </div>

              </form>
            </div>
            
            {/* Pie del Modal (Acciones) */}
            <div className="px-6 py-4 border-t border-outline-variant/50 bg-surface-container-lowest flex flex-col sm:flex-row justify-end gap-3 shrink-0">
              <button 
                type="button"
                onClick={() => setIsSlideOverOpen(false)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-full font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="new-patient-form"
                disabled={isCreating}
                className="w-full sm:w-auto px-6 py-2.5 rounded-full font-bold text-sm bg-primary text-on-primary hover:bg-primary/90 transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCreating ? (
                  <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
                ) : (
                  <span className="material-symbols-outlined text-[20px]">save</span>
                )}
                Guardar
              </button>
            </div>
          </div>
        </div>
      , document.body)}

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
