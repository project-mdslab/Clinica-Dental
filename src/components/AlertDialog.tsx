'use client';

import React from 'react';
import Portal from './Portal';

interface AlertDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: 'alert' | 'confirm';
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function AlertDialog({
  isOpen,
  title,
  message,
  type = 'alert',
  onConfirm,
  onCancel,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar'
}: AlertDialogProps) {
  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-surface rounded-3xl shadow-2xl w-[90vw] sm:w-[384px] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <h3 className="text-xl font-black text-on-surface mb-2">
            {title || (type === 'confirm' ? 'Confirmar acción' : 'Atención')}
          </h3>
          <p className="text-sm text-on-surface-variant font-medium">
            {message}
          </p>
        </div>
        
        <div className="bg-surface-container-low px-6 py-4 flex gap-3 justify-end items-center border-t border-outline-variant/30">
          {type === 'confirm' && (
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-outline-variant/30 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors shadow-sm hover:shadow-md ${
              type === 'confirm' 
                ? 'bg-error hover:bg-error/90 shadow-error/20' 
                : 'bg-primary hover:bg-primary/90 shadow-primary/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
        </div>
      </div>
    </Portal>
  );
}
