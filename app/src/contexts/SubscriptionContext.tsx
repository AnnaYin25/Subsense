/**
 * Subscription Context
 * Manages subscription data across the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Subscription, User, UserPersona, SetupPreferences, CheckInResult, CheckInLog } from '@/types';
import { useAuth } from './AuthContext';
import { supabase } from '@/utils/supabase';
import {
  getUserProfile,
  getUserPersona,
  getUserSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  calculateMonthlySpend,
  insertCheckInLog,
} from '@/utils/database';
import { rescheduleAllNotifications, cancelSubscriptionNotifications } from '@/utils/notificationScheduler';

interface SubscriptionContextType {
  // Data
  subscriptions: Subscription[];
  user: User | null;
  persona: UserPersona | null;

  // Loading states
  loading: boolean;
  refreshing: boolean;

  // Actions
  refresh: () => Promise<void>;
  addSubscription: (subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Subscription | null>;
  editSubscription: (id: string, updates: Partial<Subscription>) => Promise<boolean>;
  removeSubscription: (id: string) => Promise<boolean>;
  updatePersonaPreferences: (delta: Partial<SetupPreferences>) => Promise<boolean>;
  updateUserProfile: (updates: Partial<Pick<User, 'monthly_budget' | 'currency' | 'reminder_day' | 'reminder_days_before' | 'name'>>) => Promise<boolean>;
  submitCheckInFeedback: (result: CheckInResult) => Promise<boolean>;

  // Computed values
  activeSubscriptions: Subscription[];
  monthlySpend: number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);
type NumericPreferenceKey =
  | 'budget_tightness'
  | 'price_sensitivity'
  | 'waste_tolerance'
  | 'exploration_tendency'
  | 'quality_preference';

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser } = useAuth();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [persona, setPersona] = useState<UserPersona | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch all data
  const fetchData = useCallback(async (showRefreshing = false) => {
    if (!authUser) {
      setLoading(false);
      return;
    }

    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Fetch user profile, persona, and subscriptions in parallel
      const [userProfile, userPersona, userSubs] = await Promise.all([
        getUserProfile(authUser.id),
        getUserPersona(authUser.id),
        getUserSubscriptions(authUser.id),
      ]);

      setUser(userProfile);
      setPersona(userPersona);
      setSubscriptions(userSubs);

      // Reschedule 3-day reminders for active subscriptions with reminders enabled
      void rescheduleAllNotifications(userSubs);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authUser]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh data
  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // Add subscription
  const addSubscription = useCallback(async (
    subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Subscription | null> => {
    if (!authUser) return null;

    const newSub = await createSubscription({
      ...subscription,
      userId: authUser.id,
    });

    if (newSub) {
      setSubscriptions(prev => [...prev, newSub]);
      return newSub;
    }

    return null;
  }, [authUser]);

  // Edit subscription
  const editSubscription = useCallback(async (
    id: string,
    updates: Partial<Subscription>
  ): Promise<boolean> => {
    const success = await updateSubscription(id, updates);

    if (success) {
      setSubscriptions(prev =>
        prev.map(sub => (sub.id === id ? { ...sub, ...updates } : sub))
      );
      return true;
    }

    return false;
  }, []);

  // Remove subscription
  const removeSubscription = useCallback(async (id: string): Promise<boolean> => {
    const success = await deleteSubscription(id);

    if (success) {
      setSubscriptions(prev => prev.filter(sub => sub.id !== id));
      void cancelSubscriptionNotifications(id);
      return true;
    }

    return false;
  }, []);

  // Update persona preferences from check-in feedback
  // Reads current setup_preferences, merges delta, writes back to DB and updates local state
  const updatePersonaPreferences = useCallback(async (
    delta: Partial<SetupPreferences>
  ): Promise<boolean> => {
    if (!authUser) return false;
    try {
      const { data, error } = await supabase
        .from('user_personas')
        .select('setup_preferences')
        .eq('user_id', authUser.id)
        .single();

      if (error) throw error;

      const current: SetupPreferences = data?.setup_preferences || {
        budget_tightness: 0.5,
        price_sensitivity: 0.5,
        waste_tolerance: 0.5,
        exploration_tendency: 0.5,
        quality_preference: 0.5,
        decision_style: 'moderate',
      };

      const updated = { ...current } as SetupPreferences;
      for (const [k, v] of Object.entries(delta)) {
        const key = k as keyof SetupPreferences;
        if (typeof v === 'number') {
          (updated as any)[key] = Math.max(0, Math.min(1, v));
        } else {
          (updated as any)[key] = v;
        }
      }

      const { error: writeError } = await supabase
        .from('user_personas')
        .update({ setup_preferences: updated, updated_at: new Date().toISOString() })
        .eq('user_id', authUser.id);

      if (writeError) throw writeError;

      setPersona(prev => prev ? { ...prev, setup_preferences: updated } : prev);
      return true;
    } catch (e) {
      console.error('[SubscriptionContext] updatePersonaPreferences failed:', e);
      return false;
    }
  }, [authUser]);

  // Computed values
  const activeSubscriptions = subscriptions.filter(sub => sub.status === 'active');
  const monthlySpend = calculateMonthlySpend(subscriptions);

  // Interpret check-in results, update sub scores and persona preferences
  const submitCheckInFeedback = useCallback(async (result: CheckInResult): Promise<boolean> => {
    const { subId, action, step1Reason, step2Reason } = result;
    const target = subscriptions.find(s => s.id === subId);
    if (!target) return false;

    const currentUsage = target.usageScore ?? target.usage_score ?? 65;
    const currentSatisfaction = target.satisfactionScore ?? target.satisfaction_score ?? 65;

    let nextUsage = currentUsage;
    let nextSatisfaction = currentSatisfaction;

    if (action === 'love') {
      nextUsage = Math.min(100, currentUsage + 15);
      nextSatisfaction = Math.min(100, currentSatisfaction + 15);
    } else if (action === 'review') {
      nextUsage = Math.max(0, currentUsage - 15);
      nextSatisfaction = Math.max(0, currentSatisfaction - 20);
    } else {
      // unsure — mild penalty, not a negative signal
      nextUsage = Math.max(0, currentUsage - 5);
      nextSatisfaction = Math.max(0, currentSatisfaction - 5);
    }

    // Apply subscription score updates
    await editSubscription(subId, {
      usageScore: nextUsage,
      satisfactionScore: nextSatisfaction,
    });

    // Build preference adjustments as additive deltas, then convert to absolute values based on current persona
    const deltaAdditive: Partial<Record<NumericPreferenceKey, number>> = {};
    const bump = (key: NumericPreferenceKey, amount: number) => {
      deltaAdditive[key] = (deltaAdditive[key] ?? 0) + amount;
    };

    if (step1Reason) {
      switch (step1Reason) {
        case 'Too expensive':
          bump('price_sensitivity', 0.12);
          bump('budget_tightness', 0.08);
          break;
        case 'Not using enough':
          bump('waste_tolerance', -0.1);
          bump('budget_tightness', 0.06);
          break;
        case 'Found alternative':
          bump('exploration_tendency', 0.06);
          bump('quality_preference', 0.04);
          break;
        case 'No longer need it':
          bump('waste_tolerance', -0.05);
          bump('exploration_tendency', -0.04);
          break;
      }
    }

    if (step2Reason) {
      if (['Price spike', 'Promo ended', 'Hidden fees'].includes(step2Reason)) {
        bump('price_sensitivity', 0.08);
      }
      if (['Content stale', 'Not enough value'].includes(step2Reason)) {
        bump('quality_preference', -0.04);
      }
      if (['Too many subs', 'Overlapping service'].includes(step2Reason)) {
        bump('budget_tightness', 0.05);
        bump('waste_tolerance', -0.05);
      }
      if (['Switching soon', 'Testing alternative'].includes(step2Reason)) {
        bump('exploration_tendency', 0.05);
      }
    }

    if (persona && persona.setup_preferences && Object.keys(deltaAdditive).length > 0) {
      const current = persona.setup_preferences;
      const absolute: Partial<SetupPreferences> = {};

      (Object.keys(deltaAdditive) as NumericPreferenceKey[]).forEach(key => {
        const nextVal = Math.max(0, Math.min(1, (current as any)[key] + (deltaAdditive[key] ?? 0)));
        absolute[key] = nextVal;
      });

      await updatePersonaPreferences(absolute);
    }

    // For unsure action: store recency + usageType signals on the subscription
    if (action === 'unsure' && step1Reason) {
      const recencyValues = ['today', 'this_week', 'last_week', 'over_2_weeks'] as const;
      const usageTypeValues = ['active', 'passive'] as const;
      const recencyUpdate = recencyValues.includes(step1Reason as any)
        ? { lastUsedRecency: step1Reason as Subscription['lastUsedRecency'] }
        : {};
      const usageTypeUpdate = step2Reason && usageTypeValues.includes(step2Reason as any)
        ? { usageType: step2Reason as Subscription['usageType'] }
        : {};
      if (Object.keys({ ...recencyUpdate, ...usageTypeUpdate }).length > 0) {
        await editSubscription(subId, { ...recencyUpdate, ...usageTypeUpdate });
      }
    }

    // Log check-in to check_ins table (best-effort; fails silently if table doesn't exist)
    if (authUser) {
      void insertCheckInLog({
        userId: authUser.id,
        subId,
        action,
        q1Answer: step1Reason,
        q2Answer: step2Reason,
        diveDeeperNote: result.diveDeeperNote ?? null,
      } as CheckInLog);
    }

    // Update local state immediately for UI freshness
    setSubscriptions(prev =>
      prev.map(sub =>
        sub.id === subId
          ? {
              ...sub,
              usageScore: nextUsage,
              satisfactionScore: nextSatisfaction,
            }
          : sub
      )
    );

    return true;
  }, [editSubscription, subscriptions, updatePersonaPreferences, persona, authUser]);

  const updateUserProfile = useCallback(async (
    updates: Partial<Pick<User, 'monthly_budget' | 'currency' | 'reminder_day' | 'reminder_days_before' | 'name'>>
  ): Promise<boolean> => {
    if (!authUser) return false;
    try {
      const { error } = await supabase
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', authUser.id);
      if (error) throw error;
      setUser(prev => prev ? { ...prev, ...updates } : prev);
      return true;
    } catch (e) {
      console.error('[SubscriptionContext] updateUserProfile failed:', e);
      return false;
    }
  }, [authUser]);

  const value: SubscriptionContextType = {
    subscriptions,
    user,
    persona,
    loading,
    refreshing,
    refresh,
    addSubscription,
    editSubscription,
    removeSubscription,
    updatePersonaPreferences,
    updateUserProfile,
    submitCheckInFeedback,
    activeSubscriptions,
    monthlySpend,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

// Hook to use subscription context
export const useSubscriptions = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscriptions must be used within SubscriptionProvider');
  }
  return context;
};
