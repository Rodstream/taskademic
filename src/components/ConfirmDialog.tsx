// src/components/ConfirmDialog.tsx
'use client';

import type { ReactNode } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
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
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-[var(--background)] backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-full max-w-sm border border-[var(--card-border)] rounded-xl bg-[var(--card-bg)] px-4 py-4 shadow-xl">
        <h2 className="font-semibold mb-2 text-sm">{title}</h2>
        <div className="text-sm mb-4">{description}</div>

        <div className="flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 rounded-md border border-[var(--card-border)] hover:bg-white/10"
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1 rounded-md bg-[var(--danger)] text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
