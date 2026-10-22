'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { generatePersonaProfile } from '@/lib/utils/personaGenerator';
import type { SetupPreferences } from '@/lib/types';

type PersonaProfile = ReturnType<typeof generatePersonaProfile>;

export default function PersonaResultPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [persona, setPersona] = useState<PersonaProfile | null>(null);
  const [userInfo, setUserInfo] = useState<{ name: string; avatar: string } | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, router, user]);

  const load = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setLoadError(null);

    try {
      const [personaRes, userRes] = await Promise.all([
        supabase.from('user_personas').select('setup_preferences').eq('user_id', user.id).single(),
        supabase.from('users').select('name, avatar').eq('id', user.id).single(),
      ]);

      if (personaRes.error) throw personaRes.error;
      if (userRes.error) throw userRes.error;

      if (!personaRes.data?.setup_preferences) {
        throw new Error('No persona data found. Please complete setup first.');
      }

      setPersona(generatePersonaProfile(personaRes.data.setup_preferences as SetupPreferences));
      setUserInfo({
        name: userRes.data?.name || 'User',
        avatar: userRes.data?.avatar || '',
      });
    } catch (err) {
      console.error('Failed to load persona result:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load your profile.');
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  // Loading state
  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-[#8E8E93]">Generating your profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError || !persona || !userInfo) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-5">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-[#F2F2F7] shadow-sm p-6 text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-2xl">⚠️</div>
          <div>
            <h2 className="text-lg font-black text-[#1C1C1E]">Couldn&apos;t load your profile</h2>
            <p className="text-sm text-[#8E8E93] mt-2 leading-5">
              {loadError || 'We had trouble fetching your persona. You can retry or go to the dashboard.'}
            </p>
          </div>
          <div className="w-full flex flex-col gap-2">
            <button
              onClick={() => void load()}
              className="w-full h-12 rounded-xl bg-[#3B82F6] text-white text-sm font-black shadow-sm active:scale-[0.98] transition-transform"
            >
              Retry
            </button>
            <button
              onClick={() => router.replace('/dashboard')}
              className="w-full h-12 rounded-xl border border-[#E5E5EA] bg-white text-sm font-bold text-[#1C1C1E] active:scale-[0.98] transition-transform"
            >
              Skip to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <div className="flex-1 overflow-y-auto px-5 py-10">
        <div className="max-w-lg mx-auto flex flex-col gap-5">
          {/* Header */}
          <div className="text-center">
            <p className="text-xs font-black tracking-[0.18em] text-[#3B82F6] uppercase">Your Persona</p>
            <h1 className="text-3xl font-black text-[#1C1C1E] mt-1">Meet Your Profile</h1>
          </div>

          {/* Persona Card */}
          <section className="bg-white rounded-2xl border border-[#F2F2F7] shadow-sm p-6 flex flex-col items-center text-center">
            {userInfo.avatar && (
              <img
                src={userInfo.avatar}
                alt={userInfo.name}
                className="w-24 h-24 rounded-full bg-[#F2F2F7] object-cover mb-4"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <p className="text-xl font-black text-[#1C1C1E]">{userInfo.name}</p>
            <p className="text-5xl mt-4">{persona.emoji}</p>
            <h2 className="text-2xl font-black text-[#1C1C1E] mt-2">{persona.title}</h2>
            <p className="text-sm text-[#8E8E93] leading-6 mt-2">{persona.description}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {persona.traits.map(trait => (
                <span
                  key={trait}
                  className="px-3 py-1.5 rounded-full bg-[#F2F2F7] text-xs font-bold text-[#3B82F6]"
                >
                  {trait}
                </span>
              ))}
            </div>
          </section>

          {/* Info Box */}
          <div className="bg-[#3B82F608] rounded-2xl border-l-4 border-[#3B82F6] p-4">
            <p className="text-sm font-semibold leading-6 text-[#1C1C1E]">
              💡 We&apos;ll use your persona to personalize subscription recommendations and insights.
            </p>
            <p className="text-xs text-[#8E8E93] mt-1">
              You can update your preferences anytime in Settings.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky bottom button */}
      <div className="px-5 pb-8 pt-4 bg-[#F9FAFB]">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => router.replace('/dashboard')}
            className="w-full h-14 rounded-xl bg-[#3B82F6] text-white text-base font-black shadow-sm active:scale-[0.98] transition-transform"
          >
            Continue to App
          </button>
        </div>
      </div>
    </main>
  );
}
