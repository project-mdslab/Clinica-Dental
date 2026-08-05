'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import AlertDialog from '@/components/AlertDialog';
import Portal from '@/components/Portal';

interface Professional {
  id: string;
  name: string;
  email: string;
  color: string;
  role: string;
  avatar_url?: string;
  matricula?: string;
  clinic_address?: string;
  clinic_logo_url?: string;
}

export default function TeamPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<Professional | null>(null);
  
  // Modal State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState('bg-primary');
  const [role, setRole] = useState('professional');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [matricula, setMatricula] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicLogoUrl, setClinicLogoUrl] = useState('');

  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'alert' as 'alert' | 'confirm', onConfirm: () => {}, confirmText: 'Aceptar' });
  const [isSaving, setIsSaving] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  const colors = [
    { label: 'Azul', value: 'bg-primary' },
    { label: 'Verde', value: 'bg-[#34D399]' },
    { label: 'Celeste', value: 'bg-[#60A5FA]' },
    { label: 'Naranja', value: 'bg-[#F59E0B]' },
    { label: 'Morado', value: 'bg-[#8B5CF6]' },
    { label: 'Rosa', value: 'bg-[#EC4899]' }
  ];

  useEffect(() => {
    checkAccessAndLoad();
  }, []);

  const checkAccessAndLoad = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    let userRole = 'professional';
    if (session?.user) {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).single();
      if (data) {
        userRole = data.role;
      }
    }

    if (!session || userRole !== 'superuser') {
      router.push('/');
      return;
    }
    loadProfessionals();
  };

  const loadProfessionals = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/team');
      if (res.ok) {
        const data = await res.json();
        setProfessionals(data);
      } else {
        showAlert('Error al cargar profesionales. ¿Agregaste la Service Role Key?');
      }
    } catch (e) {
      console.error(e);
      showAlert('Error de conexión');
    }
    setIsLoading(false);
  };

  const showAlert = (message: string, type: 'alert' | 'confirm' = 'alert', onConfirm = () => setAlertDialog(prev => ({...prev, isOpen: false}))) => {
    setAlertDialog({ isOpen: true, title: 'Atención', message, type, onConfirm, confirmText: 'Aceptar' });
  };

  const handleOpenModal = (prof?: Professional) => {
    if (prof) {
      setEditingProf(prof);
      setName(prof.name);
      setEmail(prof.email);
      setPassword('');
      setColor(prof.color);
      setRole(prof.role);
      setAvatarUrl(prof.avatar_url || '');
      setMatricula(prof.matricula || '');
      setClinicAddress(prof.clinic_address || '');
      setClinicLogoUrl(prof.clinic_logo_url || '');
    } else {
      setEditingProf(null);
      setName('');
      setEmail('');
      setPassword('');
      setColor(colors[0].value);
      setRole('professional');
      setAvatarUrl('');
      setMatricula('');
      setClinicAddress('');
      setClinicLogoUrl('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || (!editingProf && !password)) {
      showAlert('Por favor completá los campos obligatorios.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = { 
        id: editingProf?.id, 
        name, 
        email, 
        password, 
        color, 
        role, 
        avatar_url: avatarUrl,
        matricula,
        clinic_address: clinicAddress,
        clinic_logo_url: clinicLogoUrl
      };
      const method = editingProf ? 'PUT' : 'POST';
      
      const res = await fetch('/api/team', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setIsModalOpen(false);
        loadProfessionals();
        showAlert('Profesional guardado con éxito.');
      } else {
        showAlert(data.error || 'Ocurrió un error');
      }
    } catch (e) {
      showAlert('Error de red');
    }
    setIsSaving(false);
  };

  const handleDelete = (id: string) => {
    showAlert('¿Estás seguro de que querés eliminar a este profesional? Esta acción no se puede deshacer.', 'confirm', async () => {
      setAlertDialog(prev => ({...prev, isOpen: false}));
      try {
        const res = await fetch(`/api/team?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          loadProfessionals();
        } else {
          const data = await res.json();
          showAlert(data.error || 'Error al eliminar');
        }
      } catch (e) {
        showAlert('Error de red');
      }
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 256;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setAvatarUrl(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 512;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/png');
        setClinicLogoUrl(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-container-lowest overflow-hidden">
      <div className="p-8 sm:px-12 md:pr-28 border-b border-outline-variant/30 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-on-surface">Equipo</h1>
        <p className="text-sm text-on-surface-variant">Profesionales del consultorio y configuración de agenda.</p>
      </div>

      <div className="flex-1 overflow-auto p-8 sm:px-12 md:pr-28 max-w-5xl">
        <div className="bg-surface rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden mb-8">
          <div className="p-6 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-lowest">
            <div>
              <h2 className="text-xl font-bold text-on-surface">Profesionales</h2>
              <p className="text-sm text-on-surface-variant mt-1">Cada uno con su color y rol para la agenda.</p>
            </div>
            <button 
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-primary text-on-primary font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Agregar
            </button>
          </div>
          
          <div className="p-6">
            {isLoading ? (
              <div className="py-12 text-center text-on-surface-variant">Cargando...</div>
            ) : professionals.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-outline-variant/30 rounded-xl text-center text-on-surface-variant">
                Todavía no cargaste profesionales. Agregá al menos uno para usar la agenda.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {professionals.map(prof => (
                  <div key={prof.id} className="flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant/30 rounded-xl hover:border-outline-variant transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full flex-shrink-0 relative overflow-hidden">
                        {prof.avatar_url ? (
                          <img src={prof.avatar_url} alt={prof.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full ${prof.color} flex items-center justify-center text-on-surface font-bold text-lg`}>
                            {prof.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">{prof.name}</p>
                        <p className="text-xs text-on-surface-variant flex items-center gap-2 mt-0.5">
                          <span>{prof.email}</span>
                          <span>•</span>
                          <span className="bg-surface-container-high px-2 py-0.5 rounded-full uppercase tracking-wider text-[10px] font-bold">
                            {prof.role === 'superuser' ? 'Superusuario' : 'Profesional'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleOpenModal(prof)}
                        className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(prof.id)}
                        className="w-10 h-10 rounded-full hover:bg-error/10 flex items-center justify-center text-error transition-colors"
                        title="Eliminar"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface rounded-3xl w-[90vw] sm:w-[500px] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest">
                <h3 className="text-xl font-bold text-on-surface">
                  {editingProf ? 'Editar Profesional' : 'Nuevo Profesional'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              
              <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
                <div className="flex flex-col items-center mb-2 relative">
                  <div className="relative group cursor-pointer">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      title="Cambiar foto de perfil"
                    />
                    {avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt="Perfil" 
                        className="w-20 h-20 rounded-full object-cover border-4 border-surface-container shadow-sm"
                      />
                    ) : (
                      <div className={`w-20 h-20 rounded-full border-4 border-surface-container shadow-sm flex items-center justify-center font-bold text-2xl ${color}`}>
                        {name ? name.charAt(0).toUpperCase() : 'P'}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <span className="material-symbols-outlined text-white text-[20px]">photo_camera</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-primary font-semibold mt-2">Cambiar foto</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Nombre Completo</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    placeholder="Ej. Dr. Juan Pérez"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Email</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                    placeholder="correo@ejemplo.com"
                    required
                    disabled={!!editingProf}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">
                    Contraseña {editingProf && <span className="text-xs text-on-surface-variant font-normal">(Dejar en blanco para no cambiarla)</span>}
                  </label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    placeholder="Mínimo 6 caracteres"
                    required={!editingProf}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-1">Rol</label>
                    <select 
                      value={role} 
                      onChange={e => setRole(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="professional">Profesional</option>
                      <option value="superuser">Superusuario</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-1">Color en Agenda</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {colors.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setColor(c.value)}
                          className={`w-8 h-8 rounded-full ${c.value} shadow-sm border-2 transition-all ${color === c.value ? 'border-on-surface scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                          title={c.label}
                        ></button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-1">Matrícula (opcional)</label>
                    <input 
                      type="text" 
                      value={matricula} 
                      onChange={e => setMatricula(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                      placeholder="Ej. MN 12345"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-1">Dirección Clínica (opcional)</label>
                    <input 
                      type="text" 
                      value={clinicAddress} 
                      onChange={e => setClinicAddress(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                      placeholder="Ej. Av. San Martín 123"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Logo de la Clínica para Recetas/Certificados</label>
                  <div className="flex items-center gap-4 mt-2">
                    {clinicLogoUrl ? (
                      <div className="relative group">
                        <img src={clinicLogoUrl} alt="Logo Clinica" className="h-16 object-contain border border-outline-variant rounded bg-white p-1" />
                        <button type="button" onClick={() => setClinicLogoUrl('')} className="absolute -top-2 -right-2 bg-error text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ) : (
                      <div className="h-16 w-32 border-2 border-dashed border-outline-variant/50 rounded flex items-center justify-center bg-surface-container-lowest text-on-surface-variant text-xs text-center p-2">
                        Sin Logo
                      </div>
                    )}
                    <label className="px-4 py-2 bg-surface-container hover:bg-surface-container-high transition-colors text-sm font-bold rounded-lg cursor-pointer border border-outline-variant/30 text-on-surface">
                      Subir Logo
                      <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                    </label>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">Este logo aparecerá en el encabezado de los documentos impresos.</p>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/30 mt-2">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {alertDialog.isOpen && (
        <AlertDialog 
          title={alertDialog.title} 
          message={alertDialog.message} 
          onClose={() => setAlertDialog(prev => ({...prev, isOpen: false}))} 
          type={alertDialog.type}
          onConfirm={alertDialog.onConfirm}
          confirmText={alertDialog.confirmText}
        />
      )}
    </div>
  );
}
