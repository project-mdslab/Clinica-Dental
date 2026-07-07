'use client';

import React, { useState } from 'react';

// Tipos
export type ToothSurface = 'top' | 'bottom' | 'left' | 'right' | 'center';
export type ToothStatus = 'absent_red' | 'absent_blue' | 'crown_red' | 'crown_blue' | null;
export type ToothColor = 'red' | 'blue' | null;

export type ToothBridge = 'bridge_red' | 'bridge_blue' | null;
export type ToothSealant = 'sealant_blue' | null;

export interface ToothState {
  surfaces: Record<ToothSurface, ToothColor>;
  status: ToothStatus;
  bridge?: ToothBridge;
  sealant?: ToothSealant;
}

export type OdontogramState = Record<number, ToothState>;

interface OdontogramProps {
  initialState?: OdontogramState;
  onStateChange?: (newState: OdontogramState) => void;
  readOnly?: boolean;
}

// Herramientas disponibles en la paleta
type Tool = 'fill_red' | 'fill_blue' | 'cross_red' | 'cross_blue' | 'crown_red' | 'crown_blue' | 'bridge_red' | 'bridge_blue' | 'sealant_blue' | 'eraser';

const defaultToothState: ToothState = {
  surfaces: { top: null, bottom: null, left: null, right: null, center: null },
  status: null,
  bridge: null,
  sealant: null,
};

// Dientes Permanentes
const adultUpper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const adultLower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// Dientes Temporales (Niños)
const childUpper = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const childLower = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

export default function Odontogram({ initialState = {}, onStateChange, readOnly = false }: OdontogramProps) {
  const [state, setState] = useState<OdontogramState>(initialState);
  const [activeTool, setActiveTool] = useState<Tool>('fill_red');

  const handleStateUpdate = (newState: OdontogramState) => {
    setState(newState);
    if (onStateChange) onStateChange(newState);
  };

  const handleSurfaceClick = (toothId: number, surface: ToothSurface) => {
    if (readOnly) return;
    
    const toothState = state[toothId] || { ...defaultToothState, surfaces: { ...defaultToothState.surfaces } };
    let newSurfaces = { ...toothState.surfaces };
    let newStatus = toothState.status;

    let newBridge = toothState.bridge;
    let newSealant = toothState.sealant;

    if (activeTool === 'fill_red') newSurfaces[surface] = 'red';
    if (activeTool === 'fill_blue') newSurfaces[surface] = 'blue';
    if (activeTool === 'eraser') newSurfaces[surface] = null;

    if (activeTool === 'cross_red') newStatus = 'absent_red';
    if (activeTool === 'cross_blue') newStatus = 'absent_blue';
    if (activeTool === 'crown_red') newStatus = 'crown_red';
    if (activeTool === 'crown_blue') newStatus = 'crown_blue';
    if (activeTool === 'bridge_red') newBridge = newBridge === 'bridge_red' ? null : 'bridge_red';
    if (activeTool === 'bridge_blue') newBridge = newBridge === 'bridge_blue' ? null : 'bridge_blue';
    if (activeTool === 'sealant_blue') newSealant = newSealant === 'sealant_blue' ? null : 'sealant_blue';
    
    if (activeTool === 'eraser') {
      if (newStatus !== null) newStatus = null;
      if (newBridge !== null) newBridge = null;
      if (newSealant !== null) newSealant = null;
    }

    handleStateUpdate({
      ...state,
      [toothId]: { surfaces: newSurfaces, status: newStatus, bridge: newBridge, sealant: newSealant }
    });
  };

  const handleToothClick = (toothId: number) => {
    if (readOnly) return;
    // Clics a nivel diente entero (Cruces y Coronas y Puentes y Sellantes)
    if (['cross_red', 'cross_blue', 'crown_red', 'crown_blue', 'bridge_red', 'bridge_blue', 'sealant_blue'].includes(activeTool)) {
      const toothState = state[toothId] || { ...defaultToothState, surfaces: { ...defaultToothState.surfaces } };
      let newStatus = toothState.status;
      let newBridge = toothState.bridge;
      let newSealant = toothState.sealant;

      if (activeTool === 'cross_red') newStatus = 'absent_red';
      if (activeTool === 'cross_blue') newStatus = 'absent_blue';
      if (activeTool === 'crown_red') newStatus = 'crown_red';
      if (activeTool === 'crown_blue') newStatus = 'crown_blue';
      if (activeTool === 'bridge_red') newBridge = newBridge === 'bridge_red' ? null : 'bridge_red';
      if (activeTool === 'bridge_blue') newBridge = newBridge === 'bridge_blue' ? null : 'bridge_blue';
      if (activeTool === 'sealant_blue') newSealant = newSealant === 'sealant_blue' ? null : 'sealant_blue';

      handleStateUpdate({
        ...state,
        [toothId]: { ...toothState, status: newStatus, bridge: newBridge, sealant: newSealant }
      });
    }
  };

  const renderTooth = (id: number) => {
    const tState = state[id] || defaultToothState;
    const s = tState.surfaces;
    const st = tState.status;

    const getColor = (color: ToothColor) => {
      if (color === 'red') return '#ef4444'; // Tailwind red-500
      if (color === 'blue') return '#3b82f6'; // Tailwind blue-500
      return 'white';
    };

    const isUpper = [1, 2, 5, 6].includes(Math.floor(id / 10));
    const bridge = tState.bridge;
    let hasLeft = false;
    let hasRight = false;

    if (bridge) {
      let arr: number[] = [];
      if (adultUpper.includes(id)) arr = adultUpper;
      else if (adultLower.includes(id)) arr = adultLower;
      else if (childUpper.includes(id)) arr = childUpper;
      else if (childLower.includes(id)) arr = childLower;

      const idx = arr.indexOf(id);
      const leftId = idx > 0 ? arr[idx - 1] : null;
      const rightId = idx < arr.length - 1 ? arr[idx + 1] : null;

      if (leftId && state[leftId]?.bridge === bridge) hasLeft = true;
      if (rightId && state[rightId]?.bridge === bridge) hasRight = true;
    }

    const bridgeColor = bridge === 'bridge_red' ? '#ef4444' : '#3b82f6';

    return (
      <div key={id} className="flex flex-col items-center gap-1 relative">
        {bridge && (
          <div 
            className="absolute pointer-events-none z-10"
            style={{
              top: isUpper ? '16px' : 'auto',
              bottom: !isUpper ? '2px' : 'auto', // Ligeramente despegado del borde inferior del contenedor de 40px
              left: '0px',
              right: '0px',
              height: '10px',
              borderTop: isUpper ? `3px solid ${bridgeColor}` : 'none',
              borderBottom: !isUpper ? `3px solid ${bridgeColor}` : 'none',
              borderLeft: !hasLeft ? `3px solid ${bridgeColor}` : 'none',
              borderRight: !hasRight ? `3px solid ${bridgeColor}` : 'none',
            }}
          />
        )}
        <span className="text-xs font-bold text-on-surface-variant z-10">{id}</span>
        <div 
          className="relative w-10 h-10 cursor-pointer select-none"
          onClick={() => handleToothClick(id)}
        >
          <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-sm">
            {/* Top Surface */}
            <polygon 
              points="0,0 40,0 30,10 10,10" 
              fill={getColor(s.top)} 
              stroke="#94a3b8" strokeWidth="1"
              onClick={(e) => { e.stopPropagation(); handleSurfaceClick(id, 'top'); }}
              className="hover:brightness-90 transition-all"
            />
            {/* Bottom Surface */}
            <polygon 
              points="0,40 40,40 30,30 10,30" 
              fill={getColor(s.bottom)} 
              stroke="#94a3b8" strokeWidth="1"
              onClick={(e) => { e.stopPropagation(); handleSurfaceClick(id, 'bottom'); }}
              className="hover:brightness-90 transition-all"
            />
            {/* Left Surface */}
            <polygon 
              points="0,0 0,40 10,30 10,10" 
              fill={getColor(s.left)} 
              stroke="#94a3b8" strokeWidth="1"
              onClick={(e) => { e.stopPropagation(); handleSurfaceClick(id, 'left'); }}
              className="hover:brightness-90 transition-all"
            />
            {/* Right Surface */}
            <polygon 
              points="40,0 40,40 30,30 30,10" 
              fill={getColor(s.right)} 
              stroke="#94a3b8" strokeWidth="1"
              onClick={(e) => { e.stopPropagation(); handleSurfaceClick(id, 'right'); }}
              className="hover:brightness-90 transition-all"
            />
            {/* Center Surface */}
            <rect 
              x="10" y="10" width="20" height="20" 
              fill={getColor(s.center)} 
              stroke="#94a3b8" strokeWidth="1"
              onClick={(e) => { e.stopPropagation(); handleSurfaceClick(id, 'center'); }}
              className="hover:brightness-90 transition-all"
            />
            
            {/* Overlays (Status) */}
            {st?.includes('absent') && (
              <g className="pointer-events-none">
                <line x1="0" y1="0" x2="40" y2="40" stroke={st === 'absent_red' ? '#ef4444' : '#3b82f6'} strokeWidth="4" />
                <line x1="40" y1="0" x2="0" y2="40" stroke={st === 'absent_red' ? '#ef4444' : '#3b82f6'} strokeWidth="4" />
              </g>
            )}
            
            {st?.includes('crown') && (
              <circle 
                cx="20" cy="20" r="18" 
                fill="none" 
                stroke={st === 'crown_red' ? '#ef4444' : '#3b82f6'} 
                strokeWidth="3" 
                className="pointer-events-none"
              />
            )}
            
            {tState.sealant === 'sealant_blue' && (
              <text 
                x="20" y="25" 
                textAnchor="middle" 
                fontSize="14" 
                fontWeight="900" 
                fill="#3b82f6" 
                className="pointer-events-none select-none drop-shadow-md"
              >
                SE
              </text>
            )}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">
      {/* Paleta de Herramientas (Etiquetas Laterales) */}
      {!readOnly && (
        <div className="flex lg:flex-col gap-6 p-4 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl lg:w-64 shrink-0 overflow-x-auto">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2 hidden lg:flex">
            <span className="material-symbols-outlined text-[18px]">palette</span>
            Herramientas
          </h3>
          
          <div className="flex lg:flex-col gap-6 lg:gap-4 w-max lg:w-full">
            {/* Grupo: Caras */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Caras:</span>
              <div className="flex lg:flex-col gap-2">
                <button type="button" onClick={() => setActiveTool('fill_red')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeTool === 'fill_red' ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444] shadow-sm' : 'bg-surface border-outline-variant/30 text-on-surface hover:bg-surface-container'}`}>
                  <div className="w-3 h-3 bg-[#ef4444] rounded-full"></div> Existente (Rojo)
                </button>
                <button type="button" onClick={() => setActiveTool('fill_blue')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeTool === 'fill_blue' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6] shadow-sm' : 'bg-surface border-outline-variant/30 text-on-surface hover:bg-surface-container'}`}>
                  <div className="w-3 h-3 bg-[#3b82f6] rounded-full"></div> Requerido (Azul)
                </button>
              </div>
            </div>

            <div className="w-px h-auto lg:w-full lg:h-px bg-outline-variant/30 mx-2 lg:mx-0"></div>

            {/* Grupo: Estados */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Pieza Completa:</span>
              <div className="flex lg:flex-col gap-2">
                <button type="button" onClick={() => setActiveTool('cross_red')} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeTool === 'cross_red' ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444] shadow-sm' : 'bg-surface border-outline-variant/30 text-on-surface hover:bg-surface-container'}`}>
                  <span className="material-symbols-outlined text-[18px] text-[#ef4444]">close</span> Extraído (Rojo)
                </button>
                <button type="button" onClick={() => setActiveTool('cross_blue')} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeTool === 'cross_blue' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6] shadow-sm' : 'bg-surface border-outline-variant/30 text-on-surface hover:bg-surface-container'}`}>
                  <span className="material-symbols-outlined text-[18px] text-[#3b82f6]">close</span> A Extraer (Azul)
                </button>
                <button type="button" onClick={() => setActiveTool('crown_red')} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeTool === 'crown_red' ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444] shadow-sm' : 'bg-surface border-outline-variant/30 text-on-surface hover:bg-surface-container'}`}>
                  <span className="material-symbols-outlined text-[18px] text-[#ef4444]">radio_button_unchecked</span> Corona (Roja)
                </button>
                <button type="button" onClick={() => setActiveTool('crown_blue')} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeTool === 'crown_blue' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6] shadow-sm' : 'bg-surface border-outline-variant/30 text-on-surface hover:bg-surface-container'}`}>
                  <span className="material-symbols-outlined text-[18px] text-[#3b82f6]">radio_button_unchecked</span> Corona (Azul)
                </button>
              </div>
            </div>

            <div className="w-px h-auto lg:w-full lg:h-px bg-outline-variant/30 mx-2 lg:mx-0"></div>

            {/* Grupo: Puentes */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Tratamientos:</span>
              <div className="flex lg:flex-col gap-2">
                <button type="button" onClick={() => setActiveTool('bridge_red')} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeTool === 'bridge_red' ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444] shadow-sm' : 'bg-surface border-outline-variant/30 text-on-surface hover:bg-surface-container'}`}>
                  <span className="material-symbols-outlined text-[18px] text-[#ef4444]">data_array</span> Puente (Rojo)
                </button>
                <button type="button" onClick={() => setActiveTool('bridge_blue')} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeTool === 'bridge_blue' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6] shadow-sm' : 'bg-surface border-outline-variant/30 text-on-surface hover:bg-surface-container'}`}>
                  <span className="material-symbols-outlined text-[18px] text-[#3b82f6]">data_array</span> Puente (Azul)
                </button>
                <button type="button" onClick={() => setActiveTool('sealant_blue')} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeTool === 'sealant_blue' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6] shadow-sm' : 'bg-surface border-outline-variant/30 text-on-surface hover:bg-surface-container'}`}>
                  <span className="text-[#3b82f6] font-black leading-none tracking-tight">SE</span> Sellante (Azul)
                </button>
              </div>
            </div>

            <div className="w-px h-auto lg:w-full lg:h-px bg-outline-variant/30 mx-2 lg:mx-0"></div>

            {/* Grupo: Borrador */}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => setActiveTool('eraser')} className={`flex items-center lg:justify-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border transition-all ${activeTool === 'eraser' ? 'bg-on-surface/10 text-on-surface border-on-surface shadow-sm' : 'bg-surface border-outline-variant/30 text-on-surface hover:bg-surface-container'}`}>
                <span className="material-symbols-outlined text-[18px]">ink_eraser</span> Borrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Grilla del Odontograma */}
      <div className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 overflow-x-auto">
        <div className="min-w-[800px] flex flex-col gap-10">
          
          {/* Adultos Superior */}
          <div>
            <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4 text-center">Dentición Permanente - Superior</h4>
            <div className="flex justify-center gap-2">
              {adultUpper.slice(0, 8).map(renderTooth)}
              <div className="w-4"></div> {/* Separador central */}
              {adultUpper.slice(8).map(renderTooth)}
            </div>
          </div>

          {/* Niños */}
          <div className="bg-surface-container/30 py-6 rounded-2xl">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 text-center">Dentición Temporal (Niños)</h4>
            <div className="flex flex-col gap-8">
              {/* Niños Superior */}
              <div className="flex justify-center gap-2">
                {childUpper.slice(0, 5).map(renderTooth)}
                <div className="w-8"></div>
                {childUpper.slice(5).map(renderTooth)}
              </div>
              {/* Niños Inferior */}
              <div className="flex justify-center gap-2">
                {childLower.slice(0, 5).map(renderTooth)}
                <div className="w-8"></div>
                {childLower.slice(5).map(renderTooth)}
              </div>
            </div>
          </div>

          {/* Adultos Inferior */}
          <div>
            <div className="flex justify-center gap-2">
              {adultLower.slice(0, 8).map(renderTooth)}
              <div className="w-4"></div>
              {adultLower.slice(8).map(renderTooth)}
            </div>
            <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mt-4 text-center">Dentición Permanente - Inferior</h4>
          </div>

        </div>
      </div>
    </div>
  );
}
