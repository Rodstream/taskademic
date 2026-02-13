'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePlan } from '@/context/PlanContext';
import { type PremiumFeature, FEATURE_LABELS } from '@/lib/plans';

type Props = {
  feature: PremiumFeature;
  children: ReactNode;
  fullPage?: boolean;
};

export function PremiumGate({ feature, children, fullPage = false }: Props) {
  const { canAccess, loading } = usePlan();

  if (loading) return null;

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  const { title, description } = FEATURE_LABELS[feature];

  if (fullPage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-[var(--accent)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            {title}
          </h2>
          <p className="text-[var(--text-muted)] mb-6">{description}</p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold hover:opacity-90 transition-opacity"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
            Mejorar a Premium
          </Link>
        </div>
      </div>
    );
  }

  // Inline gate
  return (
    <div className="relative">
      <div className="border border-dashed border-[var(--card-border)] rounded-xl p-3 bg-[var(--card-bg)]/50">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <svg
            className="w-4 h-4 text-[var(--accent)] flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>{title}</span>
          <span className="text-[var(--text-muted)]">—</span>
          <Link
            href="/pricing"
            className="text-[var(--accent)] font-medium hover:underline"
          >
            Premium
          </Link>
        </div>
      </div>
    </div>
  );
}
