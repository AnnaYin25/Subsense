
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptions, formatDate } from '../context/SubscriptionContext';
import { Subscription, AssessmentReport } from '../types';

type DetailType = 'spending' | 'assessments' | 'new' | 'paused' | 'category' | null;

const Report: React.FC = () => {
  const navigate = useNavigate();
  const { subscriptions, auditReports } = useSubscriptions();
  const [selectedDetail, setSelectedDetail] = useState<{ type: DetailType, data?: any }>(null);

  // --- Synchronized Data Logic ---
  const activeSubs = useMemo(() => subscriptions.filter(s => s.status === 'active'), [subscriptions]);
  const pausedSubs = useMemo(() => subscriptions.filter(s => s.status === 'paused'), [subscriptions]);
  const monthlySpend = useMemo(() => activeSubs.reduce((acc, sub) => acc + sub.cost, 0), [activeSubs]);
  
  // Logic for "New" (recently added within 30 days)
  const newSubs = useMemo(() => subscriptions.filter(s => {
      const idNum = parseInt(s.id.replace('setup-', ''));
      const isNewId = !isNaN(idNum) && idNum > (Date.now() - (30 * 24 * 60 * 60 * 1000));
      return s.id.startsWith('setup-') || isNewId;
  }), [subscriptions]);

  const categories = [
    { name: 'Entertainment', icon: 'movie', color: 'bg-purple-50 text-purple-600', code: 'Entertainment' },
    { name: 'Productivity', icon: 'edit_note', color: 'bg-blue-50 text-blue-600', code: 'Productivity' },
    { name: 'Utilities', icon: 'settings_suggest', color: 'bg-slate-50 text-slate-600', code: 'Utilities' },
    { name: 'Health', icon: 'favorite', color: 'bg-teal-50 text-teal-600', code: 'Health' },
  ];

  const handleCloseDetail = () => setSelectedDetail(null);

  // --- Detail Breakdown Overlay ---
  const renderDetailContent = () => {
    if (!selectedDetail) return null;

    switch (selectedDetail.type) {
      case 'spending':
        return (
          <div className="space-y-4">
            <div className="mb-2">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Monthly Spending</h3>
              <p className="text-sm text-slate-500 font-medium">Breakdown of {activeSubs.length} active bills.</p>
            </div>
            <div className="space-y-3 max-h-[45vh] overflow-y-auto no-scrollbar pr-1">
              {[...activeSubs].sort((a, b) => b.cost - a.cost).map(sub => (
                <div key={sub.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{sub.icon}</span>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm text-gray-900 dark:text-white tracking-tight">{sub.name}</span>
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-[0.1em]">{sub.category}</span>
                    </div>
                  </div>
                  <span className="font-black text-primary">${sub.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Total Monthly</span>
                <span className="text-2xl font-black text-primary tracking-tighter">${monthlySpend.toFixed(2)}</span>
            </div>
          </div>
        );

      case 'assessments':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-black text-gray-900 dark:text-white">Audit History</h3>
            <p className="text-sm text-slate-500 mb-4 font-medium">Recent results from SubSense AI.</p>
            <div className="space-y-3 max-h-[45vh] overflow-y-auto no-scrollbar">
              {auditReports.map((audit) => (
                <div key={audit.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-xl flex items-center justify-center font-black text-xs ${audit.score >= 70 ? 'bg-mint-50 text-mint-600' : 'bg-orange-50 text-orange-600'}`}>
                      {audit.score}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-900 dark:text-white text-sm">{audit.name}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase">{formatDate(audit.date)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-gray-900 dark:text-white">{audit.cost}</p>
                    <p className={`text-[9px] font-black uppercase ${audit.status === 'Good' ? 'text-mint-500' : 'text-orange-500'}`}>{audit.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'new':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-black text-gray-900 dark:text-white">Newly Tracked</h3>
            <p className="text-sm text-slate-500 mb-4 font-medium">Services added in the last 30 days.</p>
            {newSubs.length > 0 ? (
              <div className="space-y-3 max-h-[45vh] overflow-y-auto no-scrollbar">
                {newSubs.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-4 bg-mint-50 dark:bg-mint-900/10 rounded-2xl border border-mint-100 dark:border-mint-900/20">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{sub.icon}</span>
                      <span className="font-bold text-sm text-mint-800 dark:text-mint-300">{sub.name}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase text-mint-600 tracking-widest">${sub.cost.toFixed(2)}/mo</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-slate-400 py-12 text-sm italic">No new subscriptions this period.</p>}
          </div>
        );

      case 'paused':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-black text-gray-900 dark:text-white">Active Savings</h3>
            <p className="text-sm text-slate-500 mb-4 font-medium">Currently paused subscriptions.</p>
            {pausedSubs.length > 0 ? (
              <div className="space-y-3 max-h-[45vh] overflow-y-auto no-scrollbar">
                {pausedSubs.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/20">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl opacity-60 grayscale">{sub.icon}</span>
                      <span className="font-bold text-sm text-orange-800 dark:text-orange-300">{sub.name}</span>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-orange-600 uppercase">Paused</p>
                        <p className="text-[10px] font-bold text-slate-400 tracking-tighter">Saving ${sub.cost.toFixed(2)}/mo</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-slate-400 py-12 text-sm italic">You have no paused subscriptions.</p>}
          </div>
        );

      case 'category':
        const catSubs = activeSubs.filter(s => s.category === selectedDetail.data.code);
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <div className={`size-12 rounded-2xl flex items-center justify-center ${selectedDetail.data.color}`}>
                    <span className="material-symbols-outlined text-2xl">{selectedDetail.data.icon}</span>
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white">{selectedDetail.data.name}</h3>
            </div>
            <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Category Total</span>
               <span className="text-xl font-black text-primary">${catSubs.reduce((a, b) => a + b.cost, 0).toFixed(2)}</span>
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto no-scrollbar pr-1">
              {catSubs.length > 0 ? (
                  catSubs.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{sub.icon}</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-slate-200">{sub.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-gray-900 dark:text-white">${sub.cost.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Usage: {sub.usageScore}%</p>
                      </div>
                    </div>
                  ))
              ) : <p className="text-center text-slate-400 py-12 text-sm italic">No active subscriptions in this category.</p>}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen shadow-2xl flex flex-col pb-24 mx-auto overflow-x-hidden">
      {/* Top App Bar */}
      <div className="flex items-center px-4 py-4 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="size-10"></div>
        <h1 className="text-lg font-black leading-tight flex-1 text-center text-gray-900 dark:text-white uppercase tracking-[0.2em]">Health Report</h1>
        <button className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-900 dark:text-white">
          <span className="material-symbols-outlined text-[24px]">ios_share</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-6 pt-2 pb-10">
        {/* Health Score Gauge */}
        <div className="bg-white dark:bg-[#1a2233] rounded-[40px] p-8 shadow-xl border border-gray-100 dark:border-gray-800 relative overflow-hidden text-center group">
          <div className="relative size-48 mx-auto mb-6">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100">
              <circle className="text-gray-100 dark:text-gray-700 stroke-current" cx="50" cy="50" fill="transparent" r="44" strokeWidth="8"></circle>
              <circle className="text-mint-500 stroke-current transition-all duration-1000 ease-out" cx="50" cy="50" fill="transparent" r="44" strokeDasharray="276" strokeDashoffset="36" strokeLinecap="round" strokeWidth="8"></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">87</span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Score</span>
            </div>
          </div>
          <p className="text-primary font-black text-[11px] mb-1 uppercase tracking-[0.4em]">PRO SAVER STATUS</p>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">February Health Score</h2>
          <p className="text-slate-500 text-xs px-4 leading-relaxed font-medium">
            You've optimized <span className="text-mint-600 font-bold">{pausedSubs.length + 2} services</span> this month. Keep it up!
          </p>
        </div>

        {/* Sync'd Grid Dashboard */}
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setSelectedDetail({ type: 'spending' })} className="text-left bg-white dark:bg-[#1a2233] p-6 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800 active:scale-95 transition-all flex flex-col justify-between h-36">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Spending</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">${monthlySpend.toFixed(0)}</p>
            </div>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center">Detail <span className="material-symbols-outlined text-sm ml-1">chevron_right</span></span>
          </button>

          <button onClick={() => setSelectedDetail({ type: 'assessments' })} className="text-left bg-white dark:bg-[#1a2233] p-6 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800 active:scale-95 transition-all flex flex-col justify-between h-36">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">AI Audits</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{auditReports.length}</p>
            </div>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center">History <span className="material-symbols-outlined text-sm ml-1">chevron_right</span></span>
          </button>

          <button onClick={() => setSelectedDetail({ type: 'new' })} className="text-left bg-white dark:bg-[#1a2233] p-6 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800 active:scale-95 transition-all flex flex-col justify-between h-36">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Newly Tracked</p>
                <p className="text-2xl font-black text-mint-500 tracking-tight">+{newSubs.length}</p>
            </div>
            <div className="flex -space-x-2 overflow-hidden">
                {newSubs.slice(0, 3).map((s, i) => (
                  <span key={i} className="size-6 bg-slate-50 dark:bg-slate-800 rounded-full border-2 border-white dark:border-slate-700 flex items-center justify-center text-[10px] shadow-sm">{s.icon}</span>
                ))}
            </div>
          </button>

          <button onClick={() => setSelectedDetail({ type: 'paused' })} className="text-left bg-white dark:bg-[#1a2233] p-6 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800 active:scale-95 transition-all flex flex-col justify-between h-36">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Savings</p>
                <p className="text-2xl font-black text-orange-500 tracking-tight">{pausedSubs.length}</p>
            </div>
            <div className="flex -space-x-2 overflow-hidden">
                {pausedSubs.slice(0, 3).map((s, i) => (
                  <span key={i} className="size-6 bg-slate-100 dark:bg-slate-800 rounded-full border-2 border-white dark:border-slate-700 flex items-center justify-center text-[10px] grayscale opacity-50 shadow-sm">{s.icon}</span>
                ))}
            </div>
          </button>
        </div>

        {/* Dynamic Savings Forecast */}
        <div className="bg-mint-500 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col gap-2">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 opacity-80">
              <span className="material-symbols-outlined text-[20px]">savings</span>
              <p className="text-[10px] font-black uppercase tracking-widest">Yearly Savings Forecast</p>
            </div>
            <p className="text-6xl font-black tracking-tighter mb-1">
                ${(pausedSubs.reduce((a, b) => a + b.cost, 0) * 12).toFixed(0)}
            </p>
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Based on your paused list</p>
          </div>
        </div>

        {/* Sync'd Categories */}
        <div className="space-y-4">
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1 flex justify-between items-center">
            <span>Spend by Category</span>
            <span className="text-[9px] lowercase font-medium">Tap cards for detail</span>
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {categories.map((cat, i) => {
              const total = activeSubs.filter(s => s.category === cat.code).reduce((a, b) => a + b.cost, 0);
              return (
                <button key={i} onClick={() => setSelectedDetail({ type: 'category', data: cat })} className="flex flex-col gap-4 rounded-[32px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a2233] p-6 active:scale-95 transition-all text-left">
                  <div className={`size-12 rounded-2xl flex items-center justify-center ${cat.color}`}>
                    <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-gray-900 dark:text-white text-base font-black tracking-tight">{cat.name}</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.1em] mt-1">
                      ${total.toFixed(2)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail Breakdown Overlay */}
      {selectedDetail && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-8">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={handleCloseDetail}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1e2330] rounded-[40px] p-8 shadow-2xl animate-slide-up border border-slate-100 dark:border-slate-800">
             <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-8"></div>
             <div className="animate-fade-in">
                {renderDetailContent()}
             </div>
             <button onClick={handleCloseDetail} className="w-full mt-10 h-16 bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl active:scale-95 transition-all">
               Close Breakdown
             </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Report;
