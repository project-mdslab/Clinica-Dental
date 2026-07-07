"use client";

import { useEffect, useState } from "react";

export default function AnimatedLogo() {
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expandir una vez al cargar para mostrar el efecto
  useEffect(() => {
    const timer = setTimeout(() => setIsExpanded(true), 800);
    const timerClose = setTimeout(() => setIsExpanded(false), 3500);
    return () => {
      clearTimeout(timer);
      clearTimeout(timerClose);
    };
  }, []);

  return (
    <div 
      className="flex flex-col items-start font-headline-lg cursor-pointer group"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex flex-col text-primary font-bold tracking-tight text-3xl md:text-4xl leading-[1.1]">
        
        {/* Letra B / Odontología */}
        <div className="flex items-center overflow-hidden">
          <div className="relative z-10 flex items-center">
            {/* Truco visual: La B que se fusiona con la O */}
            <span className="text-primary group-hover:text-secondary transition-colors duration-500">B</span>
          </div>
          <div 
            className={`flex transition-all duration-700 ease-out origin-left ${
              isExpanded ? "max-w-[200px] opacity-100 ml-1" : "max-w-0 opacity-0"
            }`}
          >
            <span className="text-on-surface-variant font-light tracking-normal">dontología</span>
          </div>
        </div>

        {/* Letra I / Integral */}
        <div className="flex items-center overflow-hidden">
          <span className="text-primary group-hover:text-secondary transition-colors duration-500 delay-75">I</span>
          <div 
            className={`flex transition-all duration-700 ease-out origin-left ${
              isExpanded ? "max-w-[200px] opacity-100 ml-1" : "max-w-0 opacity-0"
            }`}
          >
            <span className="text-on-surface-variant font-light tracking-normal">ntegral</span>
          </div>
        </div>

        {/* Letra N / Niños */}
        <div className="flex items-center overflow-hidden">
          <span className="text-primary group-hover:text-secondary transition-colors duration-500 delay-150">N</span>
          <div 
            className={`flex transition-all duration-700 ease-out origin-left ${
              isExpanded ? "max-w-[200px] opacity-100 ml-1" : "max-w-0 opacity-0"
            }`}
          >
            <span className="text-on-surface-variant font-light tracking-normal">iños</span>
          </div>
        </div>

        {/* Letra A / Adultos */}
        <div className="flex items-center overflow-hidden">
          <span className="text-primary group-hover:text-secondary transition-colors duration-500 delay-200">A</span>
          <div 
            className={`flex transition-all duration-700 ease-out origin-left ${
              isExpanded ? "max-w-[200px] opacity-100 ml-1" : "max-w-0 opacity-0"
            }`}
          >
            <span className="text-on-surface-variant font-light tracking-normal">dultos</span>
            <span className="text-primary font-bold ml-1 transition-transform duration-700 delay-300 transform group-hover:scale-110">.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
