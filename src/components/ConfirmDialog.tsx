'use client';

import React from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="
        fixed inset-0 z-50 flex items-center justify-center
        bg-black/60 backdrop-blur-sm
      "
    >
      {/* CUADRO DEL MODAL – 100% OPACO */}
      <div
        className="
          w-full max-w-md rounded-lg p-6
          bg-[var(--background)] 
          border border-[var(--card-border)]
          shadow-xl
        "
      >
        <h2 className="text-lg font-bold mb-2">{title}</h2>

        {description && (
          <p className="text-sm text-[var(--text-muted)] mb-4">{description}</p>
        )}

        {children}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-[var(--card-border)] hover:bg-white/10"
          >
            {cancelLabel}
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className="
              px-4 py-2 rounded-md 
              bg-[var(--accent)] text-black font-semibold
              hover:bg-yellow-400
              disabled:opacity-60
            "
          >
            {loading ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
