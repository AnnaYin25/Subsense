'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Subscription, User, UserPersona, SetupPreferences, CheckInResult, CheckInLog } from '@/lib/types';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase/client';
import {
  getUserProfile,
  getUserPersona,
  getUserSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  calculateMonthlySpend,
  insertCheckInLog,
} from '@/lib/utils/database';

interface SubscriptionContextType {
  subscriptions: Subscription[];
  user: User | null;
  persona: UserPersona | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  addSubscription: (subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt' | 'userId'> & { userId?: string }) => Promise<Subscription | null>;
  editSubscription: (id: string, updates: Partial<Subscription>) => Promise<boolean>;
  removeSubscription: (id: string) => Promise<boolean>;
  updatePersonaPreferences: (delta: Partial<SetupPreferences>) => Promise<boolean>;
  updateUserProfile: (updates: Partial<Pick<User, 'monthly_budget' | 'currency' | 'reminder_day' | 'reminder_days_before' | 'name'>>) => Promise<boolean>;
  submitCheckInFeedback: (result: CheckInResult) => Promise<boolean>;
  activeSubscriptions: Subscription[];
  monthlySpend: number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

type NumericPreferenceKey = 'budget_tightness' | 'price_sensitivity' | 'waste_tolerance' | 'exploration_tendency' | 'quality_preference';
const NUMERIC_PREFERENCE_KEYS: NumericPreferenceKey[] = [
  'budget_tightness',
  'price_sensitivity',
  'waste_tolerance',
  'exploration_tendency',
  'quality_preference',
];

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [persona, setPersona] = useState<UserPersona | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (!authUser) { setLoading(false); return; }
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const [userProfile, userPersona, userSubs] = await Promise.all([
        getUserProfile(authUser.id),
        getUserPersona(authUser.id),
        getUserSubscriptions(authUser.id),
      ]);
      setUser(userProfile);
      setPersona(userPersona);
      setSubscriptions(userSubs);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authUser]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  const addSubscription = useCallback(async (subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt' | 'userId'> & { userId?: string }): Promise<Subscription | null> => {
    if (!authUser) return null;
    const newSub = await createSubscription({ ...subscription, userId: authUser.id });
    if (newSub) { setSubscriptions(prev => [...prev, newSub]); return newSub; }
    return null;
  }, [authUser]);

  const editSubscription = useCallback(async (id: string, updates: Partial<Subscription>): Promise<boolean> => {
    const success = await updateSubscription(id, updates);
    if (success) { setSubscriptions(prev => prev.map(sub => sub.id === id ? { ...sub, ...updates } : sub)); }
    return success;
  }, []);

  const removeSubscription = useCallback(async (id: string): Promise<boolean> => {
    const success = await deleteSubscription(id);
    if (success) { setSubscriptions(prev => prev.filter(sub => sub.id !== id)); }
    return success;
  }, []);

  const updatePersonaPreferences = useCallback(async (delta: Partial<SetupPreferences>): Promise<boolean> => {
    if (!authUser) return false;
    try {
      const { data, error } = await supabase.from('user_personas').select('setup_preferences').eq('user_id', authUser.id).single();
      if (error) throw error;
      const current: SetupPreferences = data?.setup_preferences || { budget_tightness: 0.5, price_sensitivity: 0.5, waste_tolerance: 0.5, exploration_tendency: 0.5, quality_preference: 0.5, decision_style: 'moderate', favorite_categories: [] };
      const updated = { ...current } as SetupPreferences;
      NUMERIC_PREFERENCE_KEYS.forEach(key => {
        const value = delta[key];
        if (typeof value === 'number') {
          updated[key] = Math.max(0, Math.min(1, value));
        }
      });
      if (delta.decision_style) updated.decision_style = delta.decision_style;
      if (delta.favorite_categories) updated.favorite_categories = delta.favorite_categories;
      const { error: writeError } = await supabase.from('user_personas').update({ setup_preferences: updated, updated_at: new Date().toISOString() }).eq('user_id', authUser.id);
      if (writeError) throw writeError;
      setPersona(prev => prev ? { ...prev, setup_preferences: updated } : prev);
      return true;
    } catch (e) { console.error('[SubscriptionContext] updatePersonaPreferences failed:', e); return false; }
  }, [authUser]);

  const updateUserProfile = useCallback(async (updates: Partial<Pick<User, 'monthly_budget' | 'currency' | 'reminder_day' | 'reminder_days_before' | 'name'>>): Promise<boolean> => {
    if (!authUser) return false;
    try {
      const { error } = await supabase.from('users').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', authUser.id);
      if (error) throw error;
      setUser(prev => prev ? { ...prev, ...updates } : prev);
      return true;
    } catch (e) { console.error('[SubscriptionContext] updateUserProfile failed:', e); return false; }
  }, [authUser]);

  const submitCheckInFeedback = useCallback(async (result: CheckInResult): Promise<boolean> => {
    const { subId, action, step1Reason, step2Reason } = result;
    const target = subscriptions.find(s => s.id === subId);
    if (!target) return false;

    const currentUsage = target.usageScore ?? target.usage_score ?? 65;
    const currentSatisfaction = target.satisfactionScore ?? target.satisfaction_score ?? 65;
    let nextUsage = currentUsage, nextSatisfaction = currentSatisfaction;

    if (action === 'love') { nextUsage = Math.min(100, currentUsage + 15); nextSatisfaction = Math.min(100, currentSatisfaction + 15); }
    else if (action === 'review') { nextUsage = Math.max(0, currentUsage - 15); nextSatisfaction = Math.max(0, currentSatisfaction - 20); }
    else { nextUsage = Math.max(0, currentUsage - 5); nextSatisfaction = Math.max(0, currentSatisfaction - 5); }

    await editSubscription(subId, { usageScore: nextUsage, satisfactionScore: nextSatisfaction });

    const deltaAdditive: Partial<Record<NumericPreferenceKey, number>> = {};
    const bump = (key: NumericPreferenceKey, amount: number) => { deltaAdditive[key] = (deltaAdditive[key] ?? 0) + amount; };

    if (step1Reason) {
      if (step1Reason === 'Too expensive') { bump('price_sensitivity', 0.12); bump('budget_tightness', 0.08); }
      else if (step1Reason === 'Not using enough') { bump('waste_tolerance', -0.1); bump('budget_tightness', 0.06); }
      else if (step1Reason === 'Found alternative') { bump('exploration_tendency', 0.06); bump('quality_preference', 0.04); }
      else if (step1Reason === 'No longer need it') { bump('waste_tolerance', -0.05); bump('exploration_tendency', -0.04); }
    }
    if (step2Reason) {
      if (['Price spike', 'Promo ended', 'Hidden fees'].includes(step2Reason)) bump('price_sensitivity', 0.08);
      if (['Content stale', 'Not enough value'].includes(step2Reason)) bump('quality_preference', -0.04);
      if (['Too many subs', 'Overlapping service'].includes(step2Reason)) { bump('budget_tightness', 0.05); bump('waste_tolerance', -0.05); }
      if (['Switching soon', 'Testing alternative'].includes(step2Reason)) bump('exploration_tendency', 0.05);
    }

    if (persona?.setup_preferences && Object.keys(deltaAdditive).length > 0) {
      const current = persona.setup_preferences;
      const absolute: Partial<SetupPreferences> = {};
      (Object.keys(deltaAdditive) as NumericPreferenceKey[]).forEach(key => {
        absolute[key] = Math.max(0, Math.min(1, current[key] + (deltaAdditive[key] ?? 0)));
      });
      await updatePersonaPreferences(absolute);
    }

    if (authUser) {
      void insertCheckInLog({ userId: authUser.id, subId, action, q1Answer: step1Reason, q2Answer: step2Reason, diveDeeperNote: result.diveDeeperNote ?? null } as CheckInLog);
    }

    setSubscriptions(prev => prev.map(sub => sub.id === subId ? { ...sub, usageScore: nextUsage, satisfactionScore: nextSatisfaction } : sub));
    return true;
  }, [editSubscription, subscriptions, updatePersonaPreferences, persona, authUser]);

  return (
    <SubscriptionContext.Provider value={{
      subscriptions, user, persona, loading, refreshing,
      refresh, addSubscription, editSubscription, removeSubscription,
      updatePersonaPreferences, updateUserProfile, submitCheckInFeedback,
      activeSubscriptions: subscriptions.filter(s => s.status === 'active'),
      monthlySpend: calculateMonthlySpend(subscriptions),
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscriptions = () => {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscriptions must be used within SubscriptionProvider');
  return context;
};
