'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
import {
  type Plan,
  type PremiumFeature,
  type LimitedResource,
  canAccess as canAccessFn,
  isWithinLimit as isWithinLimitFn,
} from '@/lib/plans';

type PlanContextType = {
  plan: Plan;
  isPremium: boolean;
  loading: boolean;
  canAccess: (feature: PremiumFeature) => boolean;
  isWithinLimit: (resource: LimitedResource, currentCount: number) => boolean;
};

const PlanContext = createContext<PlanContextType>({
  plan: 'free',
  isPremium: false,
  loading: true,
  canAccess: () => false,
  isWithinLimit: () => true,
});

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPlan('free');
      setLoading(false);
      return;
    }

    const fetchPlan = async () => {
      setLoading(true);
      const { data } = await supabaseClient
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .maybeSingle();

      setPlan((data?.plan as Plan) ?? 'free');
      setLoading(false);
    };

    fetchPlan();
  }, [user]);

  const isPremium = plan === 'premium';

  const canAccess = useCallback(
    (feature: PremiumFeature) => canAccessFn(plan, feature),
    [plan],
  );

  const isWithinLimit = useCallback(
    (resource: LimitedResource, currentCount: number) =>
      isWithinLimitFn(plan, resource, currentCount),
    [plan],
  );

  const value = useMemo(
    () => ({ plan, isPremium, loading, canAccess, isWithinLimit }),
    [plan, isPremium, loading, canAccess, isWithinLimit],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  return useContext(PlanContext);
}
