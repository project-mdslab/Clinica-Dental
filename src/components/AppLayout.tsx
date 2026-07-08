"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Portal from "./Portal";
import { useNotifications } from "@/contexts/NotificationContext";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from '@/utils/supabase/client';

export default function AppLayout({ children, role }: { children: React.ReactNode, role?: string }) {
  const pathname = usePathname();
  const isLoginRoute = pathname === '/login';
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Estados para la edición de perfil
  const [profileName, setProfileName] = useState("Cargando...");
  const [profilePic, setProfilePic] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, requestPermission, permissionGranted } = useNotifications();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [activeNotifTab, setActiveNotifTab] = useState<'unread' | 'read'>('unread');
  const mobileNotifRef = useRef<HTMLDivElement>(null);
  const desktopNotifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        (mobileNotifRef.current && mobileNotifRef.current.contains(target)) ||
        (desktopNotifRef.current && desktopNotifRef.current.contains(target))
      ) {
        return;
      }
      setIsNotifOpen(false);
    };
    
    if (isNotifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isNotifOpen]);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        const meta = session.user.user_metadata;
        const fullName = meta?.first_name ? `${meta.first_name} ${meta.last_name || ''}`.trim() : '';
        setProfileName(fullName);
        if (meta?.avatar_url) setProfilePic(meta.avatar_url);
      }
    };
    loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    if (!userId) return;
    try {
      const names = profileName.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ');
      
      await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          avatar_url: profilePic
        }
      });
      setIsProfileModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Determinar color de avatar basado en el rol
  const getRoleColor = (r?: string) => {
    switch(r) {
      case 'superuser': return 'bg-primary text-on-primary';
      case 'professional': return 'bg-[#34D399] text-white';
      case 'secretary': return 'bg-[#60A5FA] text-white';
      default: return 'bg-surface-container-high text-on-surface';
    }
  };

  // Obtener iniciales (ej. "Dra. Bina" -> "DB")
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  let navItems = [
    { name: "Dashboard", href: "/", icon: "dashboard" },
    { name: "Pacientes", href: "/patients", icon: "group" },
    { name: "Agenda", href: "/calendar", icon: "calendar_month" },
    { name: "Aranceles y O.S.", href: "/pricing", icon: "account_balance_wallet" },
    { name: "Finanzas", href: "/finance", icon: "payments" },
  ];

  const roleLabels: Record<string, string> = {
    superuser: 'Superusuario',
    professional: 'Profesional',
    secretary: 'Secretaría'
  };
  const displayRole = role ? roleLabels[role] || 'Usuario' : 'Cargando...';

  if (role === 'secretary') {
    navItems = navItems.filter(item => item.name !== "Finanzas");
  }

  const renderNotificationsDropdown = (positionClasses: string) => {
    if (!isNotifOpen) return null;
    return (
      <div className={`${positionClasses} w-[360px] max-w-[90vw] bg-surface-container-lowest border border-outline-variant shadow-xl rounded-2xl overflow-hidden z-50 flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-outline-variant/50 flex justify-between items-center bg-surface/50">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-on-surface">Notificaciones</h3>
            {unreadCount > 0 && (
              <span className="bg-[#6366F1] text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings" onClick={() => setIsNotifOpen(false)} className="text-on-surface-variant hover:text-[#6366F1] transition-colors" title="Configurar notificaciones">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </Link>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-[13px] font-semibold text-[#6366F1] hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">done_all</span>
                <span className="hidden sm:inline">Marcar leídas</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex w-full border-b border-outline-variant/30">
          <button 
            onClick={() => setActiveNotifTab('unread')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${activeNotifTab === 'unread' ? 'border-[#6366F1] text-[#6366F1]' : 'border-transparent text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            No leídas
          </button>
          <button 
            onClick={() => setActiveNotifTab('read')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${activeNotifTab === 'read' ? 'border-[#6366F1] text-[#6366F1]' : 'border-transparent text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            Leídas
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {notifications.filter(n => activeNotifTab === 'unread' ? !n.read : n.read).length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant flex flex-col items-center">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">notifications_paused</span>
              <p className="text-sm">No tienes notificaciones {activeNotifTab === 'unread' ? 'nuevas' : 'leídas'}.</p>
            </div>
          ) : (
            notifications
              .filter(n => activeNotifTab === 'unread' ? !n.read : n.read)
              .map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => {
                    markAsRead(notif.id);
                    if (notif.actionUrl) window.location.href = notif.actionUrl;
                    setIsNotifOpen(false);
                  }}
                  className="p-4 border-b border-outline-variant/20 hover:bg-surface-container-low cursor-pointer transition-colors flex gap-3 relative"
                >
                  {!notif.read && (
                    <div className="absolute top-6 left-2.5 w-2 h-2 rounded-full bg-[#6366F1]"></div>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-2 ${notif.type === 'appointment' ? 'bg-[#EEF2FF] text-[#6366F1]' : 'bg-red-50 text-red-500'}`}>
                    <span className="material-symbols-outlined text-[20px]">
                      {notif.type === 'appointment' ? 'calendar_clock' : 'account_balance_wallet'}
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface mb-0.5 truncate">
                      {notif.title}
                    </p>
                    <p className="text-[13px] text-on-surface-variant line-clamp-2 leading-snug mb-1">
                      {notif.message}
                    </p>
                    <span className="text-[11px] font-medium text-on-surface-variant/70">
                      {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  const handleGlobalSync = () => {
    setIsSyncing(true);
    // Un reload completo asegura que TODOS los datos en la PWA se actualicen
    window.location.reload();
  };

  const supabase = createClient();

  if (isLoginRoute) {
    return <main className="min-h-screen bg-surface">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* TopAppBar for Mobile */}
      <header className="fixed top-0 w-full z-50 bg-surface shadow-[0px_10px_30px_rgba(146,130,113,0.08)] flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="w-10 h-10 flex items-center justify-center text-on-surface hover:bg-surface-container-high rounded-full transition-colors">
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-semibold text-primary">Bina</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleGlobalSync}
            disabled={isSyncing}
            className="text-primary hover:bg-surface-container-high p-2 rounded-full transition-colors flex items-center justify-center"
            title="Sincronizar datos"
          >
            <span className={`material-symbols-outlined text-[24px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
          </button>
          <div className="relative" ref={mobileNotifRef}>
            <span 
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                if (!permissionGranted) requestPermission();
              }}
              className="material-symbols-outlined text-primary cursor-pointer hover:bg-surface-container-high p-2 rounded-full transition-colors"
            >
              notifications
            </span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-error rounded-full border border-surface"></span>
            )}
            {renderNotificationsDropdown("absolute right-0 top-[110%]")}
          </div>
        </div>
      </header>


      {/* Sidebar Izquierdo (Desktop) */}
      <aside className="fixed top-0 left-0 h-screen w-20 hover:w-64 group bg-surface-container-lowest border-r border-outline-variant flex-col hidden md:flex z-50 shadow-sm overflow-hidden transition-all duration-300">
        
        {/* Profile Header */}
        <div 
          onClick={() => setIsProfileModalOpen(true)}
          className="p-4 group-hover:p-6 border-b border-outline-variant/30 flex items-center bg-surface/50 cursor-pointer hover:bg-surface-container-low transition-all w-full justify-center group-hover:justify-start"
        >
          <div className="flex items-center gap-3">
            {profilePic ? (
              <img src={profilePic} alt="Perfil" className="w-10 h-10 rounded-full object-cover shadow-sm shrink-0" />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm shrink-0 ${getRoleColor(role)}`}>
                {getInitials(profileName || displayRole)}
              </div>
            )}
            <div className="flex-col hidden group-hover:flex">
              <span className="font-bold text-on-surface leading-tight truncate max-w-[130px]">{profileName || displayRole}</span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{displayRole}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-2">
          
          {/* Logo */}
          <div className="w-full h-8 group-hover:h-12 px-2 flex items-center justify-center shrink-0 mb-4 hover:scale-105 transition-all duration-300">
            <img src="/images/logo_b.png" alt="Bina Logo" className="w-auto h-full object-contain drop-shadow-sm" />
          </div>

          <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 hidden group-hover:block">Navegación</p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name}
                href={item.href}
                className={`flex items-center gap-4 py-3 rounded-xl transition-all justify-center group-hover:justify-start group-hover:px-4 ${
                  isActive ? "bg-primary-container text-primary font-bold shadow-sm" : "text-on-surface hover:bg-surface-container-low font-medium"
                }`}
                title={item.name}
              >
                <span 
                  className="material-symbols-outlined text-[24px] shrink-0" 
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>
                <span className="text-sm hidden group-hover:block whitespace-nowrap">
                  {item.name}
                </span>
              </Link>
            );
          })}

          <div className="my-2 h-[1px] bg-outline-variant/30 hidden group-hover:block"></div>
          <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 hidden group-hover:block">Opciones Avanzadas</p>

          <button 
            onClick={handleGlobalSync}
            disabled={isSyncing}
            className="flex items-center gap-4 py-3 rounded-xl hover:bg-surface-container-low text-on-surface transition-colors w-full justify-center group-hover:justify-start group-hover:px-4"
            title="Sincronizar"
          >
            <span className={`material-symbols-outlined text-[24px] shrink-0 ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
            <span className="font-medium text-sm hidden group-hover:block whitespace-nowrap">{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>



          <Link href="/settings" className="flex items-center gap-4 py-3 rounded-xl hover:bg-surface-container-low text-on-surface transition-colors justify-center group-hover:justify-start group-hover:px-4" title="Configuración">
            <span className="material-symbols-outlined text-[24px] shrink-0">settings</span>
            <span className="font-medium text-sm hidden group-hover:block whitespace-nowrap">Configuración</span>
          </Link>

        </div>
      </aside>

      {/* Main Content Area */}
      <main className="md:ml-20 min-h-screen pt-20 md:pt-0 pb-20 md:pb-0 transition-all duration-300 relative flex flex-col">
        {/* Desktop Top Right Notifications Bell */}
        <div className="hidden md:flex absolute top-4 right-8 z-50">
          <div className="relative" ref={desktopNotifRef}>
            <button 
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                if (!permissionGranted) requestPermission();
              }}
              className={`w-11 h-11 flex items-center justify-center rounded-[14px] transition-all ${isNotifOpen ? 'bg-primary-container text-primary' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low shadow-sm border border-outline-variant/30'}`}
              title="Notificaciones"
            >
              <span className="material-symbols-outlined text-[24px]">{isNotifOpen ? 'notifications_active' : 'notifications'}</span>
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-error rounded-full border-2 border-surface-container-lowest"></span>
              )}
            </button>
            {renderNotificationsDropdown("absolute right-0 top-[110%]")}
          </div>
        </div>
        {children}
      </main>

      {/* Bottom Navigation Bar (Mobile) */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center h-16 px-1 pb-safe bg-surface shadow-[0px_-4px_20px_rgba(146,130,113,0.1)] md:hidden z-50 rounded-t-xl">
        {navItems.slice(0,4).map((item) => {
          const isActive = pathname === item.href;
          const shortName = item.name === "Aranceles y O.S." ? "Aranceles" : item.name;
          return (
            <Link 
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center transition-all flex-1 min-w-0 py-1 ${
                isActive ? "text-primary-container" : "text-on-surface-variant active:bg-surface-container-high"
              }`}
            >
              <span 
                className={`material-symbols-outlined ${isActive ? 'scale-110 mb-0.5' : ''} transition-transform text-[22px]`} 
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className={`font-medium text-[10px] truncate w-full text-center px-1 transition-all ${isActive ? 'font-bold' : ''}`}>{shortName}</span>
            </Link>
          );
        })}
      </nav>

      {/* Modal de Perfil */}
      {isProfileModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 px-4">
          <div className="bg-surface w-full max-w-[360px] rounded-[2rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            
            <h2 className="font-title-md text-lg font-bold text-on-surface mb-5 text-center">Editar Perfil</h2>
            
            <div className="flex flex-col items-center mb-5 relative">
              <div className="relative group cursor-pointer">
                {profilePic ? (
                  <img 
                    src={profilePic} 
                    alt="Perfil" 
                    className="w-20 h-20 rounded-full object-cover border-4 border-surface-container shadow-sm"
                  />
                ) : (
                  <div className={`w-20 h-20 rounded-full border-4 border-surface-container shadow-sm flex items-center justify-center font-bold text-2xl ${getRoleColor(role)}`}>
                    {getInitials(profileName)}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-white text-[20px]">photo_camera</span>
                </div>
              </div>
              <p className="text-[11px] text-primary font-semibold mt-2 cursor-pointer hover:underline">Cambiar foto</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Nombre</label>
                <input 
                  type="text" 
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-sm text-on-surface font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Rol de Sistema</label>
                <input 
                  type="text" 
                  value={displayRole}
                  disabled
                  className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-3 py-2 text-sm text-on-surface-variant font-medium opacity-70 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-full font-label-sm text-sm bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveProfile}
                className="flex-1 py-2.5 px-4 rounded-full font-label-sm text-sm bg-primary hover:bg-primary/90 text-on-primary transition-colors shadow-sm"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Mobile Sidebar (Menú Hamburguesa) */}
      {isMobileMenuOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex">
            <div 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
              onClick={() => setIsMobileMenuOpen(false)}
            ></div>
            <div className="w-72 max-w-[80vw] h-full bg-surface-container-lowest shadow-2xl relative z-10 animate-in slide-in-from-left duration-300 flex flex-col">
              
              <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-surface/50">
                <div className="flex items-center gap-3">
                  {profilePic ? (
                    <img src={profilePic} alt="Perfil" className="w-10 h-10 rounded-full object-cover shadow-sm" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${getRoleColor(role)}`}>
                      {getInitials(profileName || displayRole)}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-bold text-on-surface leading-tight truncate max-w-[150px]">{profileName || displayRole}</span>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{displayRole}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-2">
                <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Opciones Avanzadas</p>
                
                {role !== 'secretary' && (
                  <Link 
                    href="/finance" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-surface-container-low text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-primary">payments</span>
                    <span className="font-medium">Finanzas</span>
                  </Link>
                )}
                
                <Link 
                  href="/settings" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-surface-container-low text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-on-surface-variant">settings</span>
                  <span className="font-medium">Configuración</span>
                </Link>

                <div className="my-2 border-t border-outline-variant/30"></div>
                
                <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Cuenta</p>

                <button 
                  onClick={() => { setIsMobileMenuOpen(false); setIsProfileModalOpen(true); }}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-surface-container-low text-on-surface transition-colors w-full text-left"
                >
                  <span className="material-symbols-outlined text-on-surface-variant">person</span>
                  <span className="font-medium">Editar Perfil</span>
                </button>

                <button 
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = '/login';
                  }}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-error/10 text-error transition-colors w-full text-left"
                >
                  <span className="material-symbols-outlined">logout</span>
                  <span className="font-medium">Cerrar Sesión</span>
                </button>
              </div>

              <div className="p-4 border-t border-outline-variant/30 text-center">
                <p className="text-[10px] font-bold text-on-surface-variant">Bina Odontología Integral</p>
                <p className="text-[9px] text-on-surface-variant/70 mt-1">Versión 1.0.0</p>
              </div>

            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
