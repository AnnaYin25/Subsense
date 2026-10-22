'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSubscriptions } from '@/lib/contexts/SubscriptionContext';
import { getAllCategories, addCustomCategory } from '@/lib/utils/categoryManager';
import type { Subscription } from '@/lib/types';

const DEFAULT_CATEGORIES = ['Entertainment', 'Productivity', 'Utilities', 'Health'];
const BILLING_CYCLES: Subscription['billingCycle'][] = ['monthly', 'yearly', 'weekly', 'quarterly', 'daily'];
const PLAN_NAMES = ['Basic', 'Standard', 'Premium', 'Pro', 'Plus', 'Enterprise', 'Individual', 'Family'];
const EMOJI_ICONS = ['🎬', '🎵', '🤖', '📝', '☁️', '📺', '🎨', '💪', '📚', '🎮', '📱', '💻', '🍕', '🏃', '🎯', '💰'];
const SERVICE_HINTS: Array<{ match: string[]; category: string; icon: string; plan?: string }> = [
  { match: ['netflix', 'hulu', 'disney', 'max', 'hbo', 'prime video', 'paramount', 'peacock'], category: 'Entertainment', icon: '📺', plan: 'Standard' },
  { match: ['spotify', 'apple music', 'tidal', 'youtube music'], category: 'Entertainment', icon: '🎵', plan: 'Individual' },
  { match: ['chatgpt', 'claude', 'perplexity', 'notion', 'figma', 'canva', 'adobe'], category: 'Productivity', icon: '🤖', plan: 'Plus' },
  { match: ['icloud', 'google one', 'dropbox', 'onedrive'], category: 'Utilities', icon: '☁️', plan: 'Basic' },
  { match: ['peloton', 'strava', 'calm', 'headspace', 'fitbod'], category: 'Health', icon: '💪', plan: 'Premium' },
  { match: ['xbox', 'playstation', 'nintendo', 'game pass'], category: 'Entertainment', icon: '🎮', plan: 'Standard' },
];

const findServiceHint = (value: string) => {
  const normalized = value.toLowerCase();
  return SERVICE_HINTS.find(item => item.match.some(token => normalized.includes(token)));
};

interface Props {
  subscriptionId?: string;
}

export default function SubscriptionForm({ subscriptionId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { subscriptions, user, addSubscription, editSubscription } = useSubscriptions();

  const isEditing = !!subscriptionId;
  const existing = subscriptions.find(s => s.id === subscriptionId);
  const queryName = isEditing ? '' : searchParams.get('name')?.trim() ?? '';
  const queryCost = isEditing ? '' : searchParams.get('cost')?.trim() ?? '';
  const queryCategory = isEditing ? '' : searchParams.get('category')?.trim() ?? '';
  const billingParam = isEditing ? null : searchParams.get('billing');
  const queryBilling = billingParam && BILLING_CYCLES.includes(billingParam as Subscription['billingCycle'])
    ? billingParam as Subscription['billingCycle']
    : undefined;
  const queryHint = queryName ? findServiceHint(queryName) : undefined;
  const initialCategory = existing?.category || queryCategory || queryHint?.category || 'Entertainment';
  const initialCategoryIsDefault = DEFAULT_CATEGORIES.includes(initialCategory);

  const [name,            setName]            = useState(existing?.name || queryName);
  const [planName,        setPlanName]        = useState(existing?.planName || queryHint?.plan || 'Standard');
  const [cost,            setCost]            = useState(existing?.cost.toString() || queryCost);
  const [billingCycle,    setBillingCycle]    = useState<Subscription['billingCycle']>(existing?.billingCycle || queryBilling || 'monthly');
  const [category,        setCategory]        = useState<string>(initialCategoryIsDefault ? initialCategory : 'Entertainment');
  const [iconEmoji,       setIconEmoji]       = useState(existing?.iconEmoji || queryHint?.icon || '📱');
  const [nextRenewalDate, setNextRenewalDate] = useState(existing?.nextRenewalDate || new Date().toISOString().split('T')[0]);
  const [notes,           setNotes]           = useState(existing?.notes || '');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  const [categories,         setCategories]         = useState<string[]>(DEFAULT_CATEGORIES);
  const [customCategory,     setCustomCategory]     = useState(
    initialCategory && !DEFAULT_CATEGORIES.includes(initialCategory) ? initialCategory : ''
  );
  const [showCustomEmoji,    setShowCustomEmoji]    = useState(false);

  useEffect(() => { getAllCategories().then(setCategories); }, []);

  const finalCategory = customCategory.trim() || category;
  const monthlyEquivalent = (() => {
    const value = parseFloat(cost);
    if (!Number.isFinite(value) || value <= 0) return null;
    if (billingCycle === 'yearly') return value / 12;
    if (billingCycle === 'quarterly') return value / 3;
    if (billingCycle === 'weekly') return value * 4;
    if (billingCycle === 'daily') return value * 30;
    return null;
  })();
  const monthlyCostForBudget = monthlyEquivalent ?? (billingCycle === 'monthly' ? parseFloat(cost) : null);
  const budgetWarning = monthlyCostForBudget !== null &&
    Number.isFinite(monthlyCostForBudget) &&
    user?.monthly_budget &&
    monthlyCostForBudget > user.monthly_budget * 0.3;
  const renewalWarning = (() => {
    const selected = new Date(nextRenewalDate);
    const today = new Date();
    selected.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return !isEditing && selected <= today;
  })();

  const getRenewalDateForCycle = (cycle: Subscription['billingCycle']) => {
    const date = new Date();
    switch (cycle) {
      case 'daily': date.setDate(date.getDate() + 1); break;
      case 'weekly': date.setDate(date.getDate() + 7); break;
      case 'quarterly': date.setMonth(date.getMonth() + 3); break;
      case 'yearly': date.setFullYear(date.getFullYear() + 1); break;
      case 'monthly':
      default: date.setMonth(date.getMonth() + 1); break;
    }
    return date.toISOString().split('T')[0];
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (isEditing) return;
    const hint = findServiceHint(value);
    if (!hint) return;
    setCategory(hint.category);
    setCustomCategory('');
    setIconEmoji(hint.icon);
    setShowCustomEmoji(false);
    if (hint.plan && planName === 'Standard') setPlanName(hint.plan);
  };

  const handleBillingCycleChange = (cycle: Subscription['billingCycle']) => {
    setBillingCycle(cycle);
    if (!isEditing) setNextRenewalDate(getRenewalDateForCycle(cycle));
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Please enter a subscription name.'); return; }
    if (!cost || isNaN(parseFloat(cost)) || parseFloat(cost) < 0) { setError('Please enter a valid cost.'); return; }
    setError('');
    setLoading(true);

    try {
      if (customCategory.trim() && !DEFAULT_CATEGORIES.includes(customCategory.trim())) {
        await addCustomCategory(customCategory.trim());
      }

      const data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt' | 'userId'> = {
        name: name.trim(),
        planName: planName.trim(),
        cost: parseFloat(cost),
        billingCycle,
        category: finalCategory as 'Entertainment' | 'Productivity' | 'Utilities' | 'Health',
        iconEmoji,
        color: existing?.color ?? '#3B82F6',
        status: (isEditing ? (existing?.status ?? 'active') : 'active') as Subscription['status'],
        isReminder: existing?.isReminder ?? false,
        startDate: existing?.startDate || new Date().toISOString().split('T')[0],
        nextRenewalDate,
        notes: notes.trim(),
        usageScore: existing?.usageScore ?? undefined,
        satisfactionScore: existing?.satisfactionScore ?? undefined,
      };

      if (isEditing && subscriptionId) {
        const ok = await editSubscription(subscriptionId, data);
        if (!ok) throw new Error('Failed to update subscription.');
        router.push(`/subscription/${subscriptionId}`);
      } else {
        const newSub = await addSubscription(data);
        if (!newSub) throw new Error('Failed to add subscription.');
        router.push('/dashboard');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-xl text-gray-900">←</button>
        <span className="text-sm font-black tracking-[0.15em] text-gray-900">{isEditing ? 'EDIT SUBSCRIPTION' : 'ADD SUBSCRIPTION'}</span>
        <div className="w-8" />
      </header>

      <div
        className="max-w-lg mx-auto px-4 space-y-6 pt-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
      >

        {/* Icon picker */}
        <div>
          <p className="text-[9px] font-black tracking-widest text-gray-400 mb-2">ICON</p>
          <div className="flex flex-wrap gap-2">
            {EMOJI_ICONS.map(e => (
              <button key={e} onClick={() => { setIconEmoji(e); setShowCustomEmoji(false); }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl border transition-colors ${
                  iconEmoji === e && !showCustomEmoji ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200 hover:border-gray-300'
                }`}>
                {e}
              </button>
            ))}
            {showCustomEmoji ? (
              <div className="w-12 h-12 rounded-xl bg-blue-50 border-2 border-blue-400 flex items-center justify-center">
                <input
                  type="text"
                  className="w-full text-center text-2xl bg-transparent outline-none"
                  value={iconEmoji}
                  onChange={e => setIconEmoji(e.target.value)}
                  maxLength={2}
                  autoFocus
                  onBlur={() => { if (!iconEmoji.trim()) { setShowCustomEmoji(false); setIconEmoji('📱'); } }}
                />
              </div>
            ) : (
              <button onClick={() => setShowCustomEmoji(true)}
                className="w-12 h-12 rounded-xl bg-white border border-dashed border-gray-300 flex items-center justify-center text-xl text-gray-400 hover:border-gray-400 transition-colors">
                +
              </button>
            )}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-[9px] font-black tracking-widest text-gray-400 block mb-2">SERVICE NAME *</label>
          <input
            type="text"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g., Netflix, Spotify"
            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-gray-900 text-base placeholder:text-gray-300 focus:outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        {/* Plan name */}
        <div>
          <label className="text-[9px] font-black tracking-widest text-gray-400 block mb-2">PLAN NAME</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PLAN_NAMES.map(p => (
              <button key={p} onClick={() => setPlanName(p)}
                className={`h-8 px-3 rounded-full text-[10px] font-black transition-colors ${
                  planName === p ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}>
                {p}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={!PLAN_NAMES.includes(planName) ? planName : ''}
            onChange={e => setPlanName(e.target.value)}
            placeholder="Or enter custom plan name"
            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-gray-900 text-base placeholder:text-gray-300 focus:outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        {/* Cost */}
        <div>
          <label className="text-[9px] font-black tracking-widest text-gray-400 block mb-2">COST *</label>
          <div className="flex items-center h-12 px-4 rounded-xl border border-gray-200 bg-white focus-within:border-blue-400 transition-colors">
            <span className="text-lg font-bold text-gray-400 mr-1">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={e => setCost(e.target.value)}
              placeholder="0.00"
              className="flex-1 text-base text-gray-900 bg-transparent outline-none placeholder:text-gray-300"
            />
          </div>
          {monthlyEquivalent !== null && (
            <p className="mt-1.5 text-xs font-semibold text-gray-400">
              About ${monthlyEquivalent.toFixed(2)} per month
            </p>
          )}
          {budgetWarning && (
            <p className="mt-1.5 text-xs font-semibold text-orange-500">
              This is over 30% of your monthly subscription budget.
            </p>
          )}
        </div>

        {/* Billing cycle */}
        <div>
          <label className="text-[9px] font-black tracking-widest text-gray-400 block mb-2">BILLING CYCLE</label>
          <div className="flex flex-wrap gap-2">
            {BILLING_CYCLES.map(c => (
              <button key={c} onClick={() => handleBillingCycleChange(c)}
                className={`h-8 px-3 rounded-full text-[10px] font-black transition-colors ${
                  billingCycle === c ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-[9px] font-black tracking-widest text-gray-400 block mb-2">CATEGORY</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {categories.map(c => (
              <button key={c} onClick={() => { setCategory(c); setCustomCategory(''); }}
                className={`h-8 px-3 rounded-full text-[10px] font-black transition-colors ${
                  category === c && !customCategory.trim() ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}>
                {c}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={customCategory}
            onChange={e => setCustomCategory(e.target.value)}
            placeholder="Or enter custom category"
            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-gray-900 text-base placeholder:text-gray-300 focus:outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        {/* Next renewal date */}
        <div>
          <label className="text-[9px] font-black tracking-widest text-gray-400 block mb-2">NEXT RENEWAL DATE</label>
          <input
            type="date"
            value={nextRenewalDate}
            onChange={e => setNextRenewalDate(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-gray-900 text-base focus:outline-none focus:border-blue-400 transition-colors"
          />
          {renewalWarning && (
            <p className="mt-1.5 text-xs font-semibold text-orange-500">
              First renewal should usually be in the future.
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-[9px] font-black tracking-widest text-gray-400 block mb-2">NOTES (OPTIONAL)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add any notes about this subscription"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-base placeholder:text-gray-300 focus:outline-none focus:border-blue-400 transition-colors resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

        {/* Save */}
        <button onClick={handleSave} disabled={loading}
          className="w-full h-14 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl shadow-md shadow-blue-200 transition-colors disabled:opacity-60 flex items-center justify-center">
          {loading
            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : isEditing ? 'Update Subscription' : 'Add Subscription'}
        </button>
      </div>
    </div>
  );
}
