import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import type { User } from '@/types';

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

  // Auto-load session on app start
  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await withTimeout<Awaited<ReturnType<typeof supabase.auth.getSession>>>(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS,
          'getSession'
        );

        if (error) {
          throw error;
        }

        setSession(currentSession);

        if (currentSession?.user) {
          try {
            await loadUserProfile(currentSession.user.id);
          } catch (profileError) {
            console.error('[AuthContext] Failed to load profile on startup, creating minimal user:', profileError);
            setUser({
              id: currentSession.user.id,
              email: currentSession.user.email || '',
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

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);

      if (currentSession?.user) {
        // Skip if initial load already fetched this profile to avoid double-call
        if (!initialLoadDone.current) return;

        try {
          await loadUserProfile(currentSession.user.id);
        } catch (profileError) {
          console.error('[AuthContext] Failed to load profile on auth change, creating minimal user:', profileError);
          setUser({
            id: currentSession.user.id,
            email: currentSession.user.email || '',
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
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      console.log('[AuthContext] Loading user profile for:', userId);

      const { data, error } = await withTimeout<{ data: any; error: any }>(
        supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single() as PromiseLike<{ data: any; error: any }>,
        AUTH_TIMEOUT_MS,
        'loadUserProfile'
      );

      if (error) {
        console.error('[AuthContext] Failed to load user profile:', error);
        throw error;
      }

      if (!data) {
        console.warn('[AuthContext] User profile not found in database');
        throw new Error('User profile not found');
      }

      console.log('[AuthContext] User profile loaded:', data.email);

      // Map database fields to app User type
      const userProfile: User = {
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
      };

      setUser(userProfile);
    } catch (error) {
      console.error('[AuthContext] Failed to load user profile:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string, avatarStyle: string = 'notionists') => {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // Create user profile with default values
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          name,
          avatar_style: avatarStyle,
          age: 25,
          monthly_budget: 100,
          currency: 'USD',
          reminder_day: 0, // Sunday
          reminder_days_before: 3,
        });

      if (profileError) {
        throw profileError;
      }

      await loadUserProfile(authData.user.id);
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[AuthContext] Signing in with email:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[AuthContext] Sign in auth error:', error.message);
        throw error;
      }

      if (!data.user) {
        throw new Error('No user data returned from sign in');
      }

      console.log('[AuthContext] Auth sign in successful, loading profile...');

      try {
        await loadUserProfile(data.user.id);
        console.log('[AuthContext] Sign in complete');
      } catch (profileError) {
        console.error('[AuthContext] Failed to load profile after sign in:', profileError);
        // Don't throw - let user continue with basic auth
        console.warn('[AuthContext] Continuing with basic auth only');

        // Create a minimal user object for testing
        setUser({
          id: data.user.id,
          email: data.user.email || email,
          name: 'Test User',
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
      }
    } catch (error: any) {
      console.error('[AuthContext] Sign in failed:', error.message || error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      setUser(null);
      setSession(null);
    }
  };

  const value = {
    session,
    user,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
