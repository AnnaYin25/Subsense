'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSubscriptions } from '@/lib/contexts/SubscriptionContext';
import { generateAvatarUrl } from '@/lib/utils/avatarUtils';
import { generatePersonaProfile } from '@/lib/utils/personaGenerator';
import { getAllCategories } from '@/lib/utils/categoryManager';
import { supabase } from '@/lib/supabase/client';
import type { AvatarStyle, SetupPreferences, Subscription } from '@/lib/types';

const getRiskLevel = (sub: Subscription): 'high' | 'medium' | 'none' => {
  const u = sub.usageScore ?? sub.usage_score;
  const s = sub.satisfactionScore ?? sub.satisfaction_score;
  if (u === undefined && s === undefined) return 'none';
  const minVal = Math.min(u ?? 65, s ?? 65);
  if (minVal < 25) return 'high';
  if (minVal < 45) return 'medium';
  return 'none';
};

const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
};

type FilterType = 'All' | 'Active' | 'Paused' | 'Watchlist';
type DashboardUserInfo = {
  name?: string | null;
  avatar?: string | null;
  avatar_style?: AvatarStyle | null;
  monthly_budget?: number | null;
  currency?: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { subscriptions, loading, monthlySpend } = useSubscriptions();

  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<FilterType>('All');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [userInfo, setUserInfo] = useState<DashboardUserInfo | null>(null);
  const [personaTitle, setPersonaTitle] = useState('PRO SAVER');
  const [categories, setCategories] = useState(['Entertainment', 'Productivity', 'Utilities', 'Health']);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!authUser) return;
    (async () => {
      const { data: userData } = await supabase
        .from('users').select('name, avatar, avatar_style, monthly_budget, currency')
        .eq('id', authUser.id).single();
      if (userData) setUserInfo(userData);

      const { data: personaData } = await supabase
        .from('user_personas').select('setup_preferences')
        .eq('user_id', authUser.id).single();
      if (personaData?.setup_preferences) {
        setPersonaTitle(generatePersonaProfile(personaData.setup_preferences as SetupPreferences).title);
      }
    })();
  }, [authUser]);

  useEffect(() => { getAllCategories().then(setCategories); }, []);

  const effectiveRenewalMap = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const map = new Map<string, string>();
    subscriptions.forEach(sub => {
      if (!sub.nextRenewalDate) return;
      const [y, m, d] = sub.nextRenewalDate.split('-').map(Number);
      const renewal = new Date(y, m - 1, d);
      while (renewal <= today) {
        switch (sub.billingCycle) {
          case 'daily':     renewal.setDate(renewal.getDate() + 1); break;
          case 'weekly':    renewal.setDate(renewal.getDate() + 7); break;
          case 'monthly':   renewal.setMonth(renewal.getMonth() + 1); break;
          case 'quarterly': renewal.setMonth(renewal.getMonth() + 3); break;
          case 'yearly':    renewal.setFullYear(renewal.getFullYear() + 1); break;
        }
      }
      map.set(sub.id, toISODate(renewal));
    });
    return map;
  }, [subscriptions]);

  const currentWeekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  }), [weekStart]);

  const getSubsForDate = (date: Date) => {
    const str = toISODate(date);
    return subscriptions.filter(s => effectiveRenewalMap.get(s.id) === str && s.status === 'active');
  };

  const selectedSubs = getSubsForDate(selectedDate);
  const selectedDateStr = toISODate(selectedDate);
  const upcomingRenewals = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return subscriptions
      .filter(sub => sub.status === 'active' && effectiveRenewalMap.has(sub.id))
      .map(sub => {
        const date = effectiveRenewalMap.get(sub.id)!;
        const [y, m, d] = date.split('-').map(Number);
        const renewalDate = new Date(y, m - 1, d);
        renewalDate.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((renewalDate.getTime() - today.getTime()) / 86400000);
        return { sub, date, daysLeft, risk: getRiskLevel(sub) };
      })
      .filter(item => item.daysLeft >= 0 && item.daysLeft <= 7 && item.risk !== 'none')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [subscriptions, effectiveRenewalMap]);

  const prevWeek  = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); setCurrentMonth(new Date(d)); };
  const nextWeek  = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); setCurrentMonth(new Date(d)); };
  const prevMonth = () => { const d = new Date(currentMonth); d.setMonth(d.getMonth() - 1); d.setDate(1); setCurrentMonth(d); setWeekStart(getWeekStart(d)); setSelectedDate(d); };
  const nextMonth = () => { const d = new Date(currentMonth); d.setMonth(d.getMonth() + 1); d.setDate(1); setCurrentMonth(d); setWeekStart(getWeekStart(d)); setSelectedDate(d); };

  const filteredSubs = useMemo(() => subscriptions.filter(sub => {
    if (filter === 'All')       return sub.status !== 'watchlist' && sub.status !== 'cancelled';
    if (filter === 'Active')    return sub.status === 'active';
    if (filter === 'Paused')    return sub.status === 'paused';
    if (filter === 'Watchlist') return sub.status === 'watchlist';
    return true;
  }), [subscriptions, filter]);

  const currency  = userInfo?.currency || 'USD';
  const budget    = userInfo?.monthly_budget ?? 100;
  const name      = userInfo?.name || authUser?.name || 'User';
  const avatarUrl = userInfo?.avatar || generateAvatarUrl(name, authUser?.id || '', userInfo?.avatar_style || 'notionists');
  const monthName = mounted ? currentMonth.toLocaleDateString('en-US', { month: 'long' }) : '';

  if (!mounted) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="w-8" />
        <span className="text-sm font-black tracking-[0.15em] text-gray-900">MANAGER</span>
        <button onClick={() => router.push('/settings')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-lg">⚙️</button>
      </header>

      <div
        className="max-w-lg mx-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 104px)' }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading your subscriptions...</p>
          </div>
        ) : (
          <>
            {/* User stats card */}
            <div className="bg-white border-b border-gray-100 px-4 py-4">
              <div className="flex items-center gap-4 mb-3">
                <img src={avatarUrl} alt={name} className="w-16 h-16 rounded-full border-4 border-blue-200 object-cover shadow-md" />
                <div>
                  <p className="text-xl font-black text-gray-900">{name}</p>
                  <p className="text-[10px] font-black tracking-[0.12em] text-blue-500">{personaTitle.toUpperCase()} ⭐</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-center justify-between border border-gray-100">
                  <div>
                    <p className="text-[9px] font-black tracking-widest text-gray-400 mb-0.5">BUDGET</p>
                    <p className="text-lg font-black text-gray-900">{currency === 'USD' ? '$' : currency}{budget}</p>
                  </div>
                  <span className="text-xl">💰</span>
                </div>
                <div className="bg-blue-50 rounded-xl px-3 py-2.5 flex items-center justify-between border border-blue-100">
                  <div>
                    <p className="text-[9px] font-black tracking-widest text-blue-500 mb-0.5">ACTIVE</p>
                    <p className="text-lg font-black text-blue-600">${monthlySpend.toFixed(2)}</p>
                  </div>
                  <span className="text-xl">💳</span>
                </div>
              </div>
            </div>

            {/* Attention queue */}
            <div className="px-4 py-2">
              <div className="bg-white rounded-[22px] border border-gray-100 shadow-sm p-3.5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[9px] font-black tracking-widest text-gray-400">NEXT 7 DAYS</p>
                    <p className="text-sm font-black text-gray-900">Needs attention</p>
                  </div>
                  <button
                    onClick={() => setCalendarExpanded(v => !v)}
                    className="h-9 px-3 rounded-full bg-blue-50 text-blue-500 text-[10px] font-black"
                  >
                    {calendarExpanded ? 'HIDE CALENDAR' : 'CALENDAR'}
                  </button>
                </div>
                <div className="space-y-2">
                  {upcomingRenewals.length > 0 ? upcomingRenewals.map(({ sub, date, daysLeft, risk }) => {
                    const [y, m, d] = date.split('-').map(Number);
                    const label = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <button
                        key={sub.id}
                        onClick={() => router.push(`/subscription/${sub.id}`)}
                        className="w-full flex items-center justify-between bg-gray-50 rounded-2xl border border-gray-100 px-3 py-2 text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl">{sub.iconEmoji}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-gray-900 truncate">{sub.name}</p>
                            <p className={`text-[9px] font-black ${risk === 'high' ? 'text-red-500' : risk === 'medium' ? 'text-yellow-600' : 'text-gray-400'}`}>
                              {risk === 'high' ? 'REVIEW BEFORE RENEWAL' : 'SOFT SIGNAL'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-sm font-black text-blue-500">{label}</p>
                          <p className="text-[9px] font-black text-gray-400">{daysLeft === 0 ? 'Today' : `${daysLeft}d left`}</p>
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="border border-dashed border-gray-200 rounded-2xl py-4 text-center">
                      <p className="text-[10px] font-black tracking-widest text-gray-300">NO URGENT REVIEWS</p>
                      <p className="text-xs text-gray-400 mt-1">Nothing risky renews in the next week.</p>
                    </div>
                  )}
                </div>

                {calendarExpanded && (
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-4 gap-2">
                      <button onClick={prevMonth} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-blue-500 font-bold text-lg">«</button>
                      <button onClick={prevWeek}  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-blue-500 font-bold text-lg">‹</button>
                      <div className="text-center flex-1">
                        <p className="text-sm font-black text-gray-900 tracking-[0.075em]">{monthName} {currentMonth.getFullYear()}</p>
                        <p className="text-[7px] font-bold tracking-[0.075em] text-gray-400 mt-0.5">WEEK VIEW</p>
                      </div>
                      <button onClick={nextWeek}  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-blue-500 font-bold text-lg">›</button>
                      <button onClick={nextMonth} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-blue-500 font-bold text-lg">»</button>
                    </div>
                    <div className="flex justify-around mb-3">
                      {['S','M','T','W','T','F','S'].map((d, i) => (
                        <div key={i} className="flex-1 text-center text-[9px] font-black text-gray-300">{d}</div>
                      ))}
                    </div>
                    <div className="flex justify-around gap-1 mb-4">
                      {currentWeekDays.map((date, i) => {
                        const subs = getSubsForDate(date);
                        const isSelected = toISODate(date) === selectedDateStr;
                        const hasReminder = subs.some(s => s.isReminder);
                        return (
                          <button key={i} onClick={() => setSelectedDate(date)}
                            className={`relative flex-1 h-10 rounded-xl flex flex-col items-center justify-center transition-all ${
                              isSelected ? 'bg-blue-500 shadow-lg shadow-blue-200 scale-110' : 'hover:bg-gray-50'
                            }`}>
                            <span className={`text-sm font-black ${isSelected ? 'text-white' : 'text-gray-900'}`}>{date.getDate()}</span>
                            {subs.length > 0 && (
                              <div className={`absolute bottom-1.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : hasReminder ? 'bg-red-400' : 'bg-blue-400'}`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {selectedSubs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black tracking-[0.075em] text-gray-400 px-1 mb-1">
                          SCHEDULED FOR {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
                        </p>
                        {selectedSubs.map(sub => (
                          <div key={sub.id} className="flex items-center justify-between bg-gray-50 rounded-[16px] border border-gray-100 px-3 py-2.5">
                            <p className="text-sm font-black text-gray-900 truncate">{sub.iconEmoji} {sub.name}</p>
                            <span className="text-sm font-black text-blue-500 ml-3 shrink-0">{sub.cost > 0 ? `$${sub.cost.toFixed(2)}` : 'Reminder'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
              {(['All', 'Active', 'Paused', 'Watchlist'] as FilterType[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`shrink-0 h-8 px-4 rounded-full text-[10px] font-black tracking-wider transition-colors ${
                    filter === f
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                      : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                  }`}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Subscription list */}
            <div className="px-4 space-y-4">
              {filteredSubs.length === 0 && (
                <div className="flex flex-col items-center py-12 gap-2">
                  <span className="text-4xl">📭</span>
                  <p className="font-black text-gray-900">{filter === 'All' ? 'No subscriptions yet' : `No ${filter.toLowerCase()} subscriptions`}</p>
                  <p className="text-sm text-gray-400">{filter === 'All' ? 'Tap + to add your first subscription' : 'Try a different filter'}</p>
                </div>
              )}
              {categories.map(category => {
                const catSubs = filteredSubs.filter(s => s.category === category);
                if (catSubs.length === 0) return null;
                const riskOrder = { high: 0, medium: 1, none: 2 };
                const sorted = [...catSubs].sort((a, b) => riskOrder[getRiskLevel(a)] - riskOrder[getRiskLevel(b)]);
                return (
                  <div key={category}>
                    <p className="text-[9px] font-black tracking-widest text-gray-400 mb-2">{category.toUpperCase()}</p>
                    <div className="space-y-2">
                      {sorted.map(sub => {
                        const risk = getRiskLevel(sub);
                        const renewal = effectiveRenewalMap.get(sub.id) || sub.nextRenewalDate;
                        const [y, mo, d] = renewal.split('-').map(Number);
                        const renewalLabel = new Date(y, mo - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        return (
                          <button key={sub.id} onClick={() => router.push(`/subscription/${sub.id}`)}
                            className={`w-full flex items-center gap-3 p-4 rounded-3xl border transition-all text-left shadow-sm active:scale-[0.98] ${
                              sub.status === 'paused'    ? 'bg-white border-gray-100 opacity-50' :
                              sub.status === 'watchlist' ? 'bg-white border-gray-100 border-l-[3px] border-l-blue-500' :
                              'bg-white border-gray-100 hover:shadow-md'
                            }`}>
                            <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center text-3xl shrink-0">
                              {sub.iconEmoji}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-black text-gray-900 text-sm truncate">{sub.name}</span>
                                {risk === 'high'   && <span className="text-[9px] font-black bg-red-50 text-red-500 border border-red-100 rounded px-1.5 py-0.5 shrink-0">⚠ AT RISK</span>}
                                {risk === 'medium' && <span className="text-[9px] font-black bg-yellow-50 text-yellow-600 border border-yellow-100 rounded px-1.5 py-0.5 shrink-0">• REVIEW</span>}
                              </div>
                              <p className="text-[10px] font-black tracking-[0.075em] text-gray-400">{sub.planName.toUpperCase()}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-black ${sub.isReminder ? 'text-gray-400' : 'text-gray-900'}`}>
                                {sub.cost > 0 ? `$${sub.cost.toFixed(2)}` : 'Trial End'}
                              </p>
                              <p className="text-[9px] font-black text-gray-400">{renewalLabel}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => router.push('/subscription/new')}
        className="fixed right-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-2xl text-white shadow-xl shadow-blue-200 transition-colors"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}>
        +
      </button>
    </div>
  );
}
