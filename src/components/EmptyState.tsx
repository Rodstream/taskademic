'use client';

import React from 'react';
import { IconType } from 'react-icons';

interface EmptyStateProps {
  icon?: IconType;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      {Icon && (
        <Icon className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" aria-hidden="true" />
      )}
      <p className="text-lg font-medium text-[var(--foreground)]">{title}</p>
      {subtitle && (
        <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
