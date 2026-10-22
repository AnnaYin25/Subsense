'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { SETUP_QUESTIONS, mergeSetupAnswers } from '@/lib/utils/setupQuestions';
import type { SetupPreferences } from '@/lib/types';

const CATEGORY_OPTIONS = [
  { label: 'Music', emoji: '🎵' },
  { label: 'Video', emoji: '🎬' },
  { label: 'Podcast', emoji: '🎙️' },
  { label: 'Gaming', emoji: '🎮' },
  { label: 'Productivity', emoji: '💻' },
  { label: 'Health', emoji: '🩺' },
  { label: 'Fitness', emoji: '💪' },
  { label: 'Learning', emoji: '📚' },
  { label: 'Design', emoji: '🎨' },
  { label: 'Creative', emoji: '✨' },
  { label: 'Social', emoji: '💬' },
  { label: 'News', emoji: '📰' },
  { label: 'Finance', emoji: '💰' },
  { label: 'Career', emoji: '💼' },
];

const ALL_AVATAR_PAGES = [
  ['1','2','3','4','5','6','7','8','9','10','11','12'],
  ['13','14','15','16','17','18','19','20','21','22','23','24'],
  ['25','26','27','28','29','30','31','32','33','34','35','36'],
];

const SETUP_TIMEOUT_MS = 12000;
const avatarUrlFor = (seed: string) =>
  `https://api.dicebear.com/7.x/notionists/png?seed=${seed}&size=150`;

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

export default function SetupPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [step, setStep] = useState(-4);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('100');
  const [avatarSeed, setAvatarSeed] = useState('1');
  const [avatarPage, setAvatarPage] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Partial<SetupPreferences>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return;
    setName(prev => prev || (user.name === 'User' ? '' : user.name));
    setBudget(prev => prev || String(user.monthly_budget || 100));
  }, [user]);

  const totalSteps = SETUP_QUESTIONS.length + 4;
  const progress = Math.min(100, Math.max(8, ((step + 5) / totalSteps) * 100));
  const currentQuestion = step >= 0 ? SETUP_QUESTIONS[step] : null;
  const currentAvatarUrl = useMemo(() => avatarUrlFor(avatarSeed), [avatarSeed]);
  const currentAvatarSeeds = ALL_AVATAR_PAGES[avatarPage];
  const selectedAvatarPageIndex = ALL_AVATAR_PAGES.findIndex(p => p.includes(avatarSeed));
  const isSelectedOffPage = selectedAvatarPageIndex !== avatarPage;

  const saveSetup = async (prefs: SetupPreferences, completed: boolean) => {
    if (!user) return;
    setSaving(true);
    setError('');

    try {
      const budgetValue = parseFloat(budget);
      if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
        throw new Error('Please enter a valid monthly budget.');
      }

      const { error: userError } = await withTimeout(
        supabase
          .from('users')
          .update({
            name: name.trim() || 'User',
            monthly_budget: budgetValue,
            avatar: currentAvatarUrl,
            avatar_style: 'notionists',
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id),
        SETUP_TIMEOUT_MS,
        'save profile',
      );
      if (userError) throw userError;

      const { error: personaError } = await withTimeout(
        supabase
          .from('user_personas')
          .upsert({
            user_id: user.id,
            setup_preferences: prefs,
            setup_completed: completed,
            confidence_score: completed ? 0.3 : 0.2,
            last_updated: new Date().toISOString(),
          }, { onConflict: 'user_id' }),
        SETUP_TIMEOUT_MS,
        'save persona',
      );
      if (personaError) throw personaError;

      router.replace(completed ? '/setup/result' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save setup.');
      setSaving(false);
    }
  };

  const handleNext = () => {
    setError('');
    if (step === -4) {
      if (!name.trim()) { setError('Please enter your name.'); return; }
      setStep(-3);
      return;
    }
    if (step === -3) {
      const budgetValue = parseFloat(budget);
      if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
        setError('Please enter a valid monthly budget.');
        return;
      }
      setStep(-2);
      return;
    }
    if (step === -2) { setStep(-1); return; }
    if (step === -1) {
      setAnswers(prev => ({ ...prev, favorite_categories: categories }));
      setStep(0);
    }
  };

  const handleBack = () => {
    setError('');
    if (step > -4) setStep(prev => prev - 1);
  };

  const handleAnswer = (values: Partial<SetupPreferences>) => {
    const merged = { ...answers, ...values };
    setAnswers(merged);
    if (step >= SETUP_QUESTIONS.length - 1) {
      void saveSetup(mergeSetupAnswers(merged), true);
    } else {
      setStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    void saveSetup(
      mergeSetupAnswers({ ...answers, favorite_categories: categories }),
      false,
    );
  };

  const toggleCategory = (category: string) => {
    setCategories(prev =>
      prev.includes(category)
        ? prev.filter(item => item !== category)
        : [...prev, category]
    );
  };

  if (loading || !user) {
    return <div className="min-h-screen bg-[#F9FAFB]" />;
  }

  return (
    <main className="min-h-screen bg-[#F9FAFB] px-5 py-6">
      <div className="max-w-lg mx-auto">
        <div className="h-1.5 bg-[#E5E5EA] rounded-full overflow-hidden">
          <div className="h-full bg-[#3B82F6] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex items-center justify-between mt-4 mb-8">
          <div className="flex items-center gap-3">
            {step > -4 && (
              <button
                onClick={handleBack}
                disabled={saving}
                aria-label="Go back"
                className="text-xs font-bold text-[#8E8E93] hover:text-[#3B82F6] disabled:opacity-40 transition-colors"
              >
                ← Back
              </button>
            )}
            <p className="text-[10px] font-black tracking-[0.18em] text-[#8E8E93] uppercase">
              {step === -4 ? 'Name' : step === -3 ? 'Budget' : step === -2 ? 'Avatar' : step === -1 ? 'Interests' : `${step + 1} of ${SETUP_QUESTIONS.length}`}
            </p>
          </div>
          {step >= 0 && (
            <button onClick={handleSkip} disabled={saving} className="text-xs font-bold text-[#8E8E93] hover:text-[#3B82F6] disabled:opacity-40 transition-colors">
              Skip
            </button>
          )}
        </div>

        {step === -4 && (
          <section>
            <h1 className="text-3xl font-black text-[#1C1C1E]">What&apos;s your name?</h1>
            <p className="text-sm text-[#8E8E93] mt-2">We&apos;ll use this to personalize your experience.</p>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNext()}
              placeholder="Your name"
              className="mt-8 w-full h-14 rounded-xl border border-[#E5E5EA] bg-white px-4 text-base text-[#1C1C1E] outline-none focus:border-[#3B82F6]"
              autoFocus
            />
          </section>
        )}

        {step === -3 && (
          <section>
            <h1 className="text-3xl font-black text-[#1C1C1E]">Monthly subscription budget?</h1>
            <p className="text-sm text-[#8E8E93] mt-2">This helps us judge what feels meaningful for you.</p>
            <div className="mt-8 flex items-center h-14 rounded-xl border border-[#E5E5EA] bg-white px-4 focus-within:border-[#3B82F6]">
              <span className="text-lg font-black text-[#8E8E93] mr-2">$</span>
              <input
                type="number"
                min="1"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNext()}
                className="flex-1 bg-transparent outline-none text-base text-[#1C1C1E]"
                autoFocus
              />
            </div>
          </section>
        )}

        {step === -2 && (
          <section>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-black text-[#1C1C1E]">Choose your avatar</h1>
                <p className="text-sm text-[#8E8E93] mt-2">Pick one that feels close enough.</p>
              </div>
              {/* Currently selected preview */}
              <div className="flex flex-col items-center gap-1 shrink-0 ml-4">
                <img
                  src={currentAvatarUrl}
                  alt="Selected avatar"
                  className="w-14 h-14 rounded-full border-2 border-[#3B82F6] bg-white object-cover"
                />
                <span className="text-[9px] font-black tracking-wider text-[#3B82F6] uppercase">Selected</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mt-8">
              {currentAvatarSeeds.map(seed => {
                const url = avatarUrlFor(seed);
                const active = avatarSeed === seed;
                return (
                  <button
                    key={seed}
                    onClick={() => setAvatarSeed(seed)}
                    className={`relative aspect-square rounded-2xl border bg-white overflow-hidden transition-all ${active ? 'border-[#3B82F6] ring-2 ring-[#3B82F630]' : 'border-[#E5E5EA]'}`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {active && (
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#3B82F6] text-white text-[10px] font-black flex items-center justify-center">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => setAvatarPage(p => Math.max(0, p - 1))}
                disabled={avatarPage === 0}
                className="px-4 py-2 rounded-xl border border-[#E5E5EA] bg-white text-sm font-semibold text-[#3B82F6] disabled:opacity-30 transition-opacity"
              >
                ← Prev
              </button>

              <div className="flex items-center gap-2">
                {ALL_AVATAR_PAGES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setAvatarPage(i)}
                    aria-label={`Avatar page ${i + 1}`}
                    className={`rounded-full transition-all ${avatarPage === i ? 'w-6 h-2 bg-[#3B82F6]' : 'w-2 h-2 bg-[#E5E5EA]'}`}
                  />
                ))}
              </div>

              <button
                onClick={() => setAvatarPage(p => Math.min(ALL_AVATAR_PAGES.length - 1, p + 1))}
                disabled={avatarPage === ALL_AVATAR_PAGES.length - 1}
                className="px-4 py-2 rounded-xl border border-[#E5E5EA] bg-white text-sm font-semibold text-[#3B82F6] disabled:opacity-30 transition-opacity"
              >
                Next →
              </button>
            </div>

            {isSelectedOffPage && (
              <button
                onClick={() => setAvatarPage(selectedAvatarPageIndex)}
                className="mt-4 w-full text-xs font-bold text-[#3B82F6] hover:underline"
              >
                Your selection is on page {selectedAvatarPageIndex + 1} — jump to it
              </button>
            )}
          </section>
        )}

        {step === -1 && (
          <section>
            <h1 className="text-3xl font-black text-[#1C1C1E]">What do you care about?</h1>
            <p className="text-sm text-[#8E8E93] mt-2">Choose any categories you use often.</p>
            <div className="flex flex-wrap gap-2 mt-8">
              {CATEGORY_OPTIONS.map(item => {
                const active = categories.includes(item.label);
                return (
                  <button
                    key={item.label}
                    onClick={() => toggleCategory(item.label)}
                    className={`h-11 px-3 rounded-full border text-sm font-bold transition-colors ${active ? 'bg-[#3B82F6] border-[#3B82F6] text-white' : 'bg-white border-[#E5E5EA] text-[#1C1C1E]'}`}
                  >
                    <span className="mr-1">{item.emoji}</span>{item.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {currentQuestion && (
          <section>
            <h1 className="text-3xl font-black text-[#1C1C1E]">{currentQuestion.question}</h1>
            <div className="flex flex-col gap-3 mt-8">
              {currentQuestion.options.map(option => (
                <button
                  key={option.label}
                  onClick={() => handleAnswer(option.values)}
                  disabled={saving}
                  className="w-full flex items-center gap-4 rounded-2xl border border-[#F2F2F7] bg-white p-4 text-left shadow-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  <span className="text-3xl">{option.emoji}</span>
                  <span className="text-base font-black text-[#1C1C1E]">{option.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {error && <p className="mt-5 text-sm font-semibold text-red-500">{error}</p>}

        {step < 0 && (
          <button
            onClick={handleNext}
            disabled={saving}
            className="mt-8 w-full h-14 rounded-xl bg-[#3B82F6] text-white text-base font-black shadow-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {step === -1 && categories.length === 0 ? 'No Favorites — Skip' : 'Continue'}
          </button>
        )}
      </div>

      {/* Full-screen saving overlay */}
      {saving && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl px-8 py-6 flex flex-col items-center gap-3 max-w-xs mx-4">
            <div className="w-8 h-8 border-[3px] border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold text-[#1C1C1E]">Setting up your profile...</p>
            <p className="text-xs text-[#8E8E93] text-center">This will just take a moment</p>
          </div>
        </div>
      )}
    </main>
  );
}
