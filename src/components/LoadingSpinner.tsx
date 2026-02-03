'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export default function LoadingSpinner({
  size = 'md',
  className = ''
}: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div
        className={`${sizeClasses[size]} border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin`}
        role="status"
        aria-label="Cargando"
      />
    </div>
  );
}
