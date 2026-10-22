
import React, { useState, useMemo } from 'react';
import { useSubscriptions, formatDate } from '../context/SubscriptionContext.tsx';
import { useNavigate } from 'react-router-dom';

const Hub: React.FC = () => {
  const navigate = useNavigate();
  const { subscriptions, user } = useSubscriptions();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'All' | 'Active' | 'Paused'>('All');
  const [isPersonaExpanded, setIsPersonaExpanded] = useState(false);
  
  // Helper to get local YYYY-MM-DD
  const toISODate = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
    return adjustedDate.toISOString().split('T')[0];
  };

  // Dynamic Calendar State - Defaulting to March 2026 to match our Mock Data
  const [currentViewDate, setCurrentViewDate] = useState(new Date(2026, 2, 1)); // March is index 2
  const [selectedDateStr, setSelectedDateStr] = useState<string>(toISODate(new Date(2026, 2, 14)));

  const activeSubs = useMemo(() => subscriptions.filter(s => s.status === 'active'), [subscriptions]);
  const currentSpend = useMemo(() => activeSubs.reduce((acc, sub) => acc + sub.cost, 0), [activeSubs]);

  const filteredSubs = useMemo(() => {
    return subscriptions.filter(sub => {
      const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           sub.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filter === 'All' || 
                           (filter === 'Active' && sub.status === 'active') || 
                           (filter === 'Paused' && sub.status === 'paused');
      return matchesSearch && matchesFilter;
    });
  }, [subscriptions, searchQuery, filter]);

  // Calendar Helpers
  const monthName = currentViewDate.toLocaleString('default', { month: 'short' }).toUpperCase();
  const yearNum = currentViewDate.getFullYear();
  
  const handlePrevWeek = () => {
    const d = new Date(currentViewDate);
    d.setDate(d.getDate() - 7);
    setCurrentViewDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentViewDate);
    d.setDate(d.getDate() + 7);
    setCurrentViewDate(d);
  };

  const currentWeekDays = useMemo(() => {
    const days = [];
    const firstDayOfWeek = currentViewDate.getDate() - currentViewDate.getDay();
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth(), firstDayOfWeek + i);
      days.push(date);
    }
    return days;
  }, [currentViewDate]);

  const getSubsForDate = (date: Date) => {
    const dateStr = toISODate(date);
    return subscriptions.filter(s => {
      if (s.status !== 'active') return false;
      return s.renewalDate === dateStr;
    });
  };

  const selectedSubs = useMemo(() => {
    return subscriptions.filter(s => s.status === 'active' && s.renewalDate === selectedDateStr);
  }, [subscriptions, selectedDateStr]);

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl pb-24">
      {/* Top Bar */}
      <header className="flex items-center justify-between p-4 pb-2 sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-transparent dark:border-slate-800">
        <div className="size-10"></div>
        <h2 className="text-lg font-black leading-tight flex-1 text-center text-gray-900 dark:text-white uppercase tracking-[0.2em]">Manager</h2>
        <button className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      {/* User Stats Card */}
      <section className="px-6 py-8 flex flex-col bg-white dark:bg-surface-dark border-b border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-6 mb-6">
            <div className="size-20 rounded-3xl overflow-hidden border-4 border-primary/20 bg-slate-100 p-0.5 shrink-0 shadow-lg">
                <img src={user.avatar} alt={user.name} className="w-full h-full object-contain" />
            </div>
            <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-1">{user.name}</h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">PRO SAVER</span>
                    <span className="material-symbols-outlined text-yellow-500 text-sm">workspace_premium</span>
                </div>
            </div>
        </div>

        {/* Foldable Persona Highlight Card */}
        {user.persona && (
          <div 
            onClick={() => setIsPersonaExpanded(!isPersonaExpanded)}
            className={`mb-6 bg-primary/5 dark:bg-primary/10 rounded-[32px] p-5 border border-primary/10 cursor-pointer transition-all duration-300 animate-fade-in-up group hover:bg-primary/10 dark:hover:bg-primary/20`}
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl shrink-0 group-hover:scale-110 transition-transform">{user.persona.emoji}</div>
              <div className="flex-1">
                <h4 className="text-[9px] font-black text-primary uppercase tracking-widest mb-0.5 opacity-70">Subscription Persona</h4>
                <p className="font-black text-gray-900 dark:text-white text-base leading-tight">{user.persona.title}</p>
              </div>
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary transition-colors group-hover:bg-primary/20">
                <span className={`material-symbols-outlined transition-transform duration-300 ${isPersonaExpanded ? 'rotate-180' : ''}`}>
                  keyboard_arrow_down
                </span>
              </div>
            </div>
            
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isPersonaExpanded ? 'max-h-[500px] opacity-100 mt-5' : 'max-h-0 opacity-0'}`}>
              <div className="border-t border-primary/10 pt-4 space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic">
                  "{user.persona.description}"
                </p>
                <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-primary/5 shadow-inner">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="material-symbols-outlined text-[14px] text-primary">lightbulb</span>
                    <p className="text-[9px] font-black text-primary uppercase tracking-widest">Savings Insight</p>
                  </div>
                  <p className="text-[11px] font-bold text-gray-800 dark:text-slate-200 leading-snug">{user.persona.tip}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Budget</span>
                    <span className="text-lg font-black text-gray-800 dark:text-gray-100">${user.monthlyBudget}</span>
                </div>
                <span className="material-symbols-outlined text-slate-300">account_balance_wallet</span>
            </div>
            <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl flex items-center justify-between border border-primary/10">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest mb-0.5">Active</span>
                    <span className="text-lg font-black text-primary">${currentSpend.toFixed(2)}</span>
                </div>
                <span className="material-symbols-outlined text-primary">payments</span>
            </div>
        </div>
      </section>

      {/* Dynamic Calendar Widget */}
      <section className="p-4">
        <div className="bg-white dark:bg-surface-dark rounded-[40px] p-8 shadow-xl border border-slate-200 dark:border-slate-800 transition-all">
          <div className="flex items-center justify-between mb-8">
            <button onClick={handlePrevWeek} className="size-10 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 active:scale-90 transition-all">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <div className="text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-800 dark:text-slate-200">{monthName} {yearNum}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Week View</p>
            </div>
            <button onClick={handleNextWeek} className="size-10 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 active:scale-90 transition-all">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-8">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
              <p key={d} className="text-[10px] font-black text-slate-300 dark:text-slate-600 text-center py-2">{d}</p>
            ))}
            {currentWeekDays.map((date, idx) => {
              const dayNum = date.getDate();
              const dateStr = toISODate(date);
              const subsOnDay = getSubsForDate(date);
              const hasReminders = subsOnDay.some(s => s.isReminder);
              const hasRenewals = subsOnDay.length > 0;
              const isSelected = selectedDateStr === dateStr;
              
              return (
                <button 
                  key={idx} 
                  onClick={() => setSelectedDateStr(dateStr)} 
                  className={`h-12 rounded-2xl flex flex-col items-center justify-center text-sm font-black transition-all relative ${isSelected ? 'bg-primary text-white shadow-xl scale-110 z-10' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {dayNum}
                  {hasRenewals && (
                      <span className={`absolute bottom-2 w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : (hasReminders ? 'bg-red-500 animate-pulse' : 'bg-primary animate-pulse')
                      }`}></span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedSubs.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">
                Scheduled for {formatDate(selectedDateStr)}
              </p>
              {selectedSubs.map(sub => (
                <div key={sub.id} onClick={() => navigate(`/subscription/${sub.id}`)} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 animate-fade-in flex items-center justify-between cursor-pointer active:scale-95 transition-all">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{sub.icon}</span>
                    <div className="flex flex-col">
                        <span className={`text-base font-black tracking-tight ${sub.isReminder ? 'text-red-500' : ''}`}>{sub.name}</span>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{sub.category}</span>
                    </div>
                  </div>
                  <span className={`text-xl font-black ${sub.isReminder ? 'text-red-500' : 'text-primary'}`}>
                      {sub.cost > 0 ? `$${sub.cost.toFixed(2)}` : 'Reminder'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-slate-50/50 dark:bg-slate-800/20 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No active events on {formatDate(selectedDateStr)}</p>
            </div>
          )}
        </div>
      </section>

      {/* Filter Chips */}
      <div className="flex gap-3 px-4 py-4 overflow-x-auto no-scrollbar">
        {['All', 'Active', 'Paused'].map(f => (
          <button key={f} onClick={() => setFilter(f as any)} className={`flex h-11 shrink-0 items-center justify-center px-8 rounded-full transition-all active:scale-95 ${filter === f ? "bg-primary text-white shadow-xl shadow-primary/25" : "bg-white dark:bg-surface-dark border border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-50"}`}>
            <p className="text-[11px] font-black uppercase tracking-widest">{f}</p>
          </button>
        ))}
      </div>

      {/* List Views */}
      <div className="px-4 space-y-8 mt-4">
        {['Entertainment', 'Productivity', 'Utilities', 'Health'].map(cat => {
            const catSubs = filteredSubs.filter(sub => sub.category === cat);
            if (catSubs.length === 0) return null;
            return (
                <div key={cat} className="space-y-4">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] pl-1">{cat}</h3>
                    <div className="flex flex-col gap-4">
                        {catSubs.map(sub => (
                            <div key={sub.id} onClick={() => navigate(`/subscription/${sub.id}`)} className={`flex items-center p-5 rounded-[32px] bg-white dark:bg-surface-dark border border-slate-100 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer ${sub.status === 'paused' ? 'opacity-50 grayscale' : ''}`}>
                                <div className={`size-14 rounded-2xl flex items-center justify-center shrink-0 mr-4 shadow-sm text-3xl ${sub.color} bg-opacity-10`}>
                                    {sub.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`font-black text-gray-900 dark:text-white tracking-tight truncate pr-2 ${sub.isReminder ? 'text-red-500' : ''}`}>{sub.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest truncate">{sub.plan}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`font-black ${sub.isReminder ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{sub.cost > 0 ? `$${sub.cost.toFixed(2)}` : 'Trial End'}</span>
                                    <span className={`text-[9px] font-black uppercase ${sub.isReminder ? 'text-red-400' : 'text-slate-400'}`}>{formatDate(sub.renewalDate)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default Hub;
