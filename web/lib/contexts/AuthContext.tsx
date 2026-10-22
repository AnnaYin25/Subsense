'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@/lib/types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, avatarStyle?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_TIMEOUT_MS = 15000;

const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS,
          'getSession'
        );

        if (error) throw error;

        setSession(currentSession);

        if (currentSession?.user) {
          try {
            await loadUserProfile(currentSession.user.id);
          } catch {
            setUser(minimalUser(currentSession.user.id, currentSession.user.email || ''));
          }
        }
      } catch (error) {
        console.error('[AuthContext] Failed to load session:', error);
      } finally {
        initialLoadDone.current = true;
        setLoading(false);
      }
    };

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);

      if (currentSession?.user) {
        if (!initialLoadDone.current) return;
        try {
          await loadUserProfile(currentSession.user.id);
        } catch {
          setUser(minimalUser(currentSession.user.id, currentSession.user.email || ''));
        }
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const minimalUser = (id: string, email: string): User => ({
    id,
    email,
    name: 'User',
    avatar: '',
    avatarStyle: 'notionists',
    age: 25,
    monthly_budget: 100,
    currency: 'USD',
    reminder_day: 0,
    reminder_days_before: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const loadUserProfile = async (userId: string) => {
    const { data, error } = await withTimeout(
      supabase.from('users').select('*').eq('id', userId).single() as PromiseLike<{ data: any; error: any }>,
      AUTH_TIMEOUT_MS,
      'loadUserProfile'
    );

    if (error || !data) throw error || new Error('User profile not found');

    setUser({
      id: data.id,
      email: data.email,
      name: data.name,
      avatar: data.avatar || '',
      avatarStyle: data.avatar_style || 'notionists',
      age: data.age || 25,
      monthly_budget: parseFloat(data.monthly_budget) || 100,
      currency: data.currency || 'USD',
      reminder_day: data.reminder_day || 0,
      reminder_days_before: data.reminder_days_before || 3,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  };

  const signUp = async (email: string, password: string, name: string, avatarStyle = 'notionists') => {
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user account');

    const { error: profileError } = await supabase.from('users').insert({
      id: authData.user.id,
      email,
      name,
      avatar_style: avatarStyle,
      age: 25,
      monthly_budget: 100,
      currency: 'USD',
      reminder_day: 0,
      reminder_days_before: 3,
    });
    if (profileError) throw profileError;

    await loadUserProfile(authData.user.id);
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('No user data returned');

    try {
      await loadUserProfile(data.user.id);
    } catch {
      setUser(minimalUser(data.user.id, data.user.email || email));
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
