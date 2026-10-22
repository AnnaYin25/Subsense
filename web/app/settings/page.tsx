'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSubscriptions } from '@/lib/contexts/SubscriptionContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { SETUP_QUESTIONS, mergeSetupAnswers } from '@/lib/utils/setupQuestions';
import { generatePersonaProfile } from '@/lib/utils/personaGenerator';
import type { SetupPreferences } from '@/lib/types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'KRW'];
const WEEKDAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REMINDER_DAYS_OPTIONS = [1, 3, 7, 14];

export default function SettingsPage() {
  const router = useRouter();
  const { user, persona, updateUserProfile, updatePersonaPreferences, refresh } = useSubscriptions();
  const { signOut } = useAuth();

  const [budget,      setBudget]      = useState(String(user?.monthly_budget ?? '100'));
  const [currency,    setCurrency]    = useState(user?.currency ?? 'USD');
  const [reminderDay, setReminderDay] = useState(user?.reminder_day ?? 0);
  const [daysBefore,  setDaysBefore]  = useState(user?.reminder_days_before ?? 3);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');

  const [showQuiz,      setShowQuiz]      = useState(false);
  const [quizStep,      setQuizStep]      = useState(0);
  const [quizAnswers,   setQuizAnswers]   = useState<Partial<SetupPreferences>>({});
  const [savingPersona, setSavingPersona] = useState(false);

  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const currentPersona = persona?.setup_preferences
    ? generatePersonaProfile(persona.setup_preferences as SetupPreferences)
    : null;

  useEffect(() => {
    if (user) {
      const id = window.setTimeout(() => {
        setBudget(String(user.monthly_budget ?? '100'));
        setCurrency(user.currency ?? 'USD');
        setReminderDay(user.reminder_day ?? 0);
        setDaysBefore(user.reminder_days_before ?? 3);
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [user]);

  const handleSave = async () => {
    const budgetNum = parseFloat(budget);
    if (isNaN(budgetNum) || budgetNum <= 0) { setError('Please enter a valid budget greater than 0.'); return; }
    setError('');
    setSaving(true);
    const ok = await updateUserProfile({ monthly_budget: budgetNum, currency, reminder_day: reminderDay, reminder_days_before: daysBefore });
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    else { setError('Failed to save. Please try again.'); }
  };

  const handlePersonaAnswer = useCallback(async (values: Partial<SetupPreferences>) => {
    const merged = { ...quizAnswers, ...values };
    setQuizAnswers(merged);
    if (quizStep < SETUP_QUESTIONS.length - 1) {
      setQuizStep(s => s + 1);
    } else {
      setSavingPersona(true);
      const final = mergeSetupAnswers(merged);
      const ok = await updatePersonaPreferences(final);
      if (ok) await refresh();
      setSavingPersona(false);
      setShowQuiz(false);
      setQuizStep(0);
      setQuizAnswers({});
    }
  }, [quizAnswers, quizStep, updatePersonaPreferences, refresh]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-xl text-gray-900">←</button>
        <span className="text-sm font-black tracking-[0.15em] text-gray-900">SETTINGS</span>
        <div className="w-8" />
      </header>

      <div
        className="max-w-lg mx-auto px-4 pt-4 space-y-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 104px)' }}
      >

        {/* Persona section */}
        {!showQuiz ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center">
            {currentPersona ? (
              <>
                <span className="text-5xl mb-3">{currentPersona.emoji}</span>
                <p className="text-xl font-bold text-gray-900 mb-1">{currentPersona.title}</p>
                <p className="text-sm text-gray-400 mb-4 leading-relaxed">{currentPersona.description}</p>
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {currentPersona.traits.slice(0, 3).map(t => (
                    <span key={t} className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-500">{t}</span>
                  ))}
                </div>
                <button onClick={() => setShowQuiz(true)} className="text-sm text-blue-500 font-semibold hover:text-blue-600 transition-colors">
                  ↻ Retake quiz
                </button>
              </>
            ) : (
              <>
                <span className="text-5xl mb-3">⚖️</span>
                <p className="text-lg font-bold text-gray-900 mb-3">No persona yet</p>
                <button onClick={() => setShowQuiz(true)} className="text-sm text-blue-500 font-semibold hover:text-blue-600 transition-colors">
                  Take quiz
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex gap-1.5">
                {SETUP_QUESTIONS.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i === quizStep ? 'w-5 bg-blue-500' : 'w-1.5 bg-gray-200'}`} />
                ))}
              </div>
              <button onClick={() => { setShowQuiz(false); setQuizStep(0); setQuizAnswers({}); }}
                className="text-sm text-blue-500 font-semibold hover:text-blue-600 transition-colors">
                Cancel
              </button>
            </div>
            <p className="text-base font-bold text-gray-900 mb-4 leading-snug">{SETUP_QUESTIONS[quizStep].question}</p>
            <div className="space-y-2">
              {SETUP_QUESTIONS[quizStep].options.map(opt => (
                <button key={opt.label}
                  onClick={() => !savingPersona && void handlePersonaAnswer(opt.values as Partial<SetupPreferences>)}
                  disabled={savingPersona}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-40">
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="text-sm font-medium text-gray-900 flex-1">{opt.label}</span>
                  <span className="text-gray-300">›</span>
                </button>
              ))}
            </div>
            {savingPersona && <p className="text-center text-sm text-gray-400 mt-3">Saving…</p>}
          </div>
        )}

        {/* Budget */}
        <div>
          <p className="text-[9px] font-black tracking-widest text-gray-400 mb-2">MONTHLY BUDGET</p>
          <div className="flex items-center h-14 px-4 bg-white rounded-xl border border-gray-200 focus-within:border-blue-400 transition-colors">
            <span className="text-2xl font-bold text-gray-400 mr-1">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="100"
              className="flex-1 text-2xl font-bold text-gray-900 bg-transparent outline-none placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Currency */}
        <div>
          <p className="text-[9px] font-black tracking-widest text-gray-400 mb-2">CURRENCY</p>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map(c => (
              <button key={c} onClick={() => setCurrency(c)}
                className={`h-9 px-3 rounded-lg text-[10px] font-black transition-colors ${
                  currency === c ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Check-in day */}
        <div>
          <p className="text-[9px] font-black tracking-widest text-gray-400 mb-2">CHECK-IN DAY</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day, i) => (
              <button key={day} onClick={() => setReminderDay(i)}
                className={`h-9 px-3 rounded-lg text-[10px] font-black min-w-[3rem] transition-colors ${
                  reminderDay === i ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}>
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Renewal alert */}
        <div>
          <p className="text-[9px] font-black tracking-widest text-gray-400 mb-1">RENEWAL ALERT</p>
          <p className="text-xs text-gray-400 mb-2">Days before a subscription renews</p>
          <div className="flex flex-wrap gap-2">
            {REMINDER_DAYS_OPTIONS.map(d => (
              <button key={d} onClick={() => setDaysBefore(d)}
                className={`h-9 px-3 rounded-lg text-[10px] font-black transition-colors ${
                  daysBefore === d ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}>
                {d} {d === 1 ? 'day' : 'days'}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

        {/* Save */}
        <button onClick={handleSave} disabled={saving || saved}
          className={`w-full h-14 font-bold rounded-xl transition-colors disabled:opacity-75 flex items-center justify-center ${
            saved ? 'bg-green-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200'
          }`}>
          {saved ? 'Saved ✓' : saving ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Changes'}
        </button>

        {/* Sign out */}
        {!confirmSignOut ? (
          <button onClick={() => setConfirmSignOut(true)}
            className="w-full py-3 text-sm font-semibold text-red-500 hover:text-red-600 transition-colors text-center">
            Sign Out
          </button>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => setConfirmSignOut(false)}
              className="flex-1 h-11 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button onClick={async () => { await signOut(); router.replace('/'); }}
              className="flex-1 h-11 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-100 transition-colors">
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
