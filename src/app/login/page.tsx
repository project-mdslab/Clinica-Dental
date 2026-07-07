'use client'

import { useState, useEffect } from 'react'
import { login } from './actions'
import Link from 'next/link'
import Image from 'next/image'

const CLINIC_IMAGES = [
  '/images/clinic1.jpg',
  '/images/clinic2.jpg',
  '/images/clinic3.jpg'
];

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % CLINIC_IMAGES.length)
    }, 4000); // Cambia cada 4 segundos
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const result = await login(formData)
    
    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-container-low flex flex-col justify-center items-center p-4 md:p-lg">
      
      {/* Contenedor Principal (Tarjeta Dividida) */}
      <div className="w-full max-w-[1000px] bg-surface-container-lowest rounded-[32px] shadow-[0px_20px_60px_rgba(146,130,113,0.15)] flex flex-col md:flex-row overflow-hidden min-h-[650px]">
        
        {/* Lado Izquierdo (Imagen / Arte en Carrusel) */}
        <div className="w-full h-48 md:h-auto md:w-[45%] bg-primary-container relative overflow-hidden">
          {CLINIC_IMAGES.map((src, index) => (
            <img 
              key={src}
              src={src} 
              alt={`Bina Clinic Interior ${index + 1}`} 
              className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out ${
                index === currentImageIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            />
          ))}
          {/* Overlay suave para integrar los colores y textos (opcional) */}
          <div className="absolute inset-0 bg-primary/20 mix-blend-multiply z-20 pointer-events-none"></div>
        </div>

        {/* Lado Derecho (Formulario) */}
        <div className="w-full md:w-[55%] p-lg md:p-[64px] flex flex-col justify-center relative">
          
          {/* Volver a la web */}
          <Link href="#" className="absolute top-8 left-8 md:top-12 md:left-12 flex items-center gap-2 text-on-surface-variant font-label-md text-sm hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            Volver a la web
          </Link>

          <div className="mt-8 md:mt-0 flex flex-col justify-center h-full">
            <div className="mb-8 flex justify-center md:justify-start">
              <img 
                src="/images/logo_full.png" 
                alt="Bina Clinic Logo" 
                className="h-24 md:h-28 object-contain"
              />
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 bg-error-container text-on-error-container rounded-2xl font-label-md text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="font-label-md text-on-surface font-semibold text-sm ml-1 block">Correo Electrónico</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-outline-variant text-[20px]">mail</span>
                  <input 
                    id="email" 
                    name="email" 
                    type="email" 
                    required 
                    placeholder="doctor@clinicabina.com"
                    className="w-full pl-12 pr-6 py-4 bg-transparent border-2 border-surface-container-high rounded-full focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 font-body-md transition-all placeholder:text-outline-variant"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-label-md text-on-surface font-semibold text-sm ml-1 block">Contraseña</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-outline-variant text-[20px]">lock</span>
                  <input 
                    id="password" 
                    name="password" 
                    type="password" 
                    required 
                    placeholder="••••••••"
                    className="w-full pl-12 pr-6 py-4 bg-transparent border-2 border-surface-container-high rounded-full focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 font-body-md transition-all placeholder:text-outline-variant tracking-widest"
                  />
                </div>
              </div>

              <div className="flex justify-end mb-2">
                <a href="#" className="font-label-sm text-sm text-on-surface font-semibold hover:text-primary transition-colors underline underline-offset-4">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-4 bg-primary text-on-primary rounded-full font-label-md text-base font-semibold hover:bg-on-primary-fixed-variant active:scale-[0.98] transition-all flex justify-center items-center shadow-lg disabled:opacity-70 mt-2"
              >
                {isLoading ? (
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                  'Ingresar'
                )}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
