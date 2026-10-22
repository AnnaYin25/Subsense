
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptions, formatDate } from '../context/SubscriptionContext';

type DetailType = 'spending' | 'assessments' | 'new' | 'paused' | 'category' | null;

const DIMENSION_META = [
  {
    key: 'budget',
    emoji: '💰',
    label: 'Budget vs Spend',
    weight: 30,
    hint: (spend: number, budget: number) =>
      spend <= budget
        ? `$${spend.toFixed(0)} of $${budget} used — under budget ✓`
        : `$${(spend - budget).toFixed(0)} over your $${budget} limit`,
  },
  {
    key: 'usage',
    emoji: '📱',
    label: 'Usage Rate',
    weight: 30,
    hint: (avg: number, count: number) =>
      `Avg ${Math.round(avg)}% usage across ${count} active subs`,
  },
  {
    key: 'cleanup',
    emoji: '🧹',
    label: 'Cleanup Speed',
    weight: 20,
    hint: (paused: number) =>
      paused > 0 ? `${paused} sub${paused > 1 ? 's' : ''} paused — saving money` : 'No paused subs yet',
  },
];

const scoreColor = (s: number) =>
  s >= 80 ? 'bg-emerald-400' : s >= 60 ? 'bg-amber-400' : 'bg-rose-400';
const scoreText = (s: number) =>
  s >= 80 ? 'text-emerald-600' : s >= 60 ? 'text-amber-500' : 'text-rose-500';
const scoreBg = (s: number) =>
  s >= 80 ? 'bg-emerald-50 dark:bg-emerald-900/20' : s >= 60 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-rose-50 dark:bg-rose-900/20';

const CATEGORIES = [
  { name: 'Entertainment', icon: 'movie',           color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600', code: 'Entertainment' },
  { name: 'Productivity',  icon: 'edit_note',        color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',       code: 'Productivity'  },
  { name: 'Health',        icon: 'favorite',         color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600', code: 'Health'      },
  { name: 'Utilities',     icon: 'settings_suggest', color: 'bg-slate-50 dark:bg-slate-700/40 text-slate-500',    code: 'Utilities'    },
  { name: 'MBTI',          icon: 'psychology',       color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600', code: 'MBTI'         },
];

const Report: React.FC = () => {
  useNavigate();
  const { subscriptions, auditReports, user } = useSubscriptions();
  const [selectedDetail, setSelectedDetail] = useState<{ type: DetailType; data?: any }>(null);

  const activeSubs  = useMemo(() => subscriptions.filter(s => s.status === 'active'),  [subscriptions]);
  const pausedSubs  = useMemo(() => subscriptions.filter(s => s.status === 'paused'),  [subscriptions]);
  const monthlySpend = useMemo(() => activeSubs.reduce((acc, s) => acc + s.cost, 0),   [activeSubs]);
  const budget = user.monthlyBudget;

  const newSubs = useMemo(() => subscriptions.filter(s => s.id.startsWith('setup-')), [subscriptions]);

  // ---- Dimensions ----
  const budgetScore  = Math.round(Math.min(100, Math.max(0, budget > 0 ? (1 - Math.max(monthlySpend - budget, 0) / budget) * 100 : 100)));
  const usageAvg     = activeSubs.length > 0 ? activeSubs.reduce((a, b) => a + (b.usageScore ?? 50), 0) / activeSubs.length : 50;
  const cleanupScore = Math.min(100, 45 + pausedSubs.length * 18);
  const dimensionScores = [budgetScore, Math.round(usageAvg), Math.round(cleanupScore)];
  const overallScore = Math.round(
    (dimensionScores[0] * 30 + dimensionScores[1] * 30 + dimensionScores[2] * 20) / 80
  );

  const dimensionHints = [
    DIMENSION_META[0].hint(monthlySpend, budget),
    DIMENSION_META[1].hint(usageAvg, activeSubs.length),
    DIMENSION_META[2].hint(pausedSubs.length),
  ];

  const handleClose = () => setSelectedDetail(null);

  // ---- Overlays ----
  const renderDetail = () => {
    if (!selectedDetail) return null;
    switch (selectedDetail.type) {
      case 'spending':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Monthly Spending</h3>
              <p className="text-sm text-slate-500 mt-0.5">{activeSubs.length} active bills</p>
            </div>
            <div className="space-y-2.5 max-h-[45vh] overflow-y-auto no-scrollbar">
              {[...activeSubs].sort((a, b) => b.cost - a.cost).map(sub => (
                <div key={sub.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{sub.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{sub.name}</p>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{sub.category}</p>
                    </div>
                  </div>
                  <span className="font-black text-primary text-sm">${sub.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Total</span>
              <span className="text-2xl font-black text-primary">${monthlySpend.toFixed(2)}</span>
            </div>
          </div>
        );

      case 'assessments':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Audit History</h3>
              <p className="text-sm text-slate-500 mt-0.5">Recent results from SubSense AI</p>
            </div>
            <div className="space-y-2.5 max-h-[45vh] overflow-y-auto no-scrollbar">
              {auditReports.map(audit => (
                <div key={audit.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-xl flex items-center justify-center font-black text-sm ${audit.score >= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>{audit.score}</div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{audit.name}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase">{formatDate(audit.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-gray-900 dark:text-white">{audit.cost}</p>
                    <p className={`text-[9px] font-black uppercase ${audit.status === 'Good' ? 'text-emerald-500' : 'text-orange-500'}`}>{audit.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'new':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Newly Tracked</h3>
              <p className="text-sm text-slate-500 mt-0.5">Services added recently</p>
            </div>
            {newSubs.length > 0 ? (
              <div className="space-y-2.5 max-h-[45vh] overflow-y-auto no-scrollbar">
                {newSubs.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{sub.icon}</span>
                      <span className="font-bold text-sm text-gray-900 dark:text-white">{sub.name}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase text-primary tracking-widest">${sub.cost.toFixed(2)}/mo</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-slate-400 py-10 text-sm italic">No new subscriptions this period.</p>}
          </div>
        );

      case 'paused':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Paused Subs</h3>
              <p className="text-sm text-slate-500 mt-0.5">Saving ${pausedSubs.reduce((a, b) => a + b.cost, 0).toFixed(2)}/mo</p>
            </div>
            {pausedSubs.length > 0 ? (
              <div className="space-y-2.5 max-h-[45vh] overflow-y-auto no-scrollbar">
                {pausedSubs.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-4 bg-amber-50/80 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                    <div className="flex items-center gap-3">
                      <span className="text-xl opacity-50 grayscale">{sub.icon}</span>
                      <span className="font-bold text-sm text-gray-800 dark:text-white">{sub.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-amber-600 uppercase">Paused</p>
                      <p className="text-[10px] text-slate-400">–${sub.cost.toFixed(2)}/mo</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-slate-400 py-10 text-sm italic">No paused subscriptions yet.</p>}
          </div>
        );

      case 'category': {
        const cat = selectedDetail.data;
        const catSubs = activeSubs.filter(s => s.category === cat.code);
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`size-12 rounded-2xl flex items-center justify-center ${cat.color}`}>
                <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white">{cat.name}</h3>
                <p className="text-sm text-slate-500">{catSubs.length} subscription{catSubs.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Category Total</span>
              <span className="text-xl font-black text-primary">${catSubs.reduce((a, b) => a + b.cost, 0).toFixed(2)}/mo</span>
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto no-scrollbar">
              {catSubs.length > 0 ? catSubs.map(sub => (
                <div key={sub.id} className="flex items-center justify-between px-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{sub.icon}</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-slate-200">{sub.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900 dark:text-white">${sub.cost.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Usage {sub.usageScore}%</p>
                  </div>
                </div>
              )) : <p className="text-center text-slate-400 py-10 text-sm italic">No active subscriptions here.</p>}
            </div>
          </div>
        );
      }
      default: return null;
    }
  };

  return (
    <div className="relative w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen shadow-2xl flex flex-col pb-24 mx-auto overflow-x-hidden">

      {/* ─── Header: HEALTH centered ─── */}
      <div className="relative flex items-center justify-center px-4 py-3 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm sticky top-0 z-20 border-b border-slate-100/80 dark:border-slate-800/80">
        <h1 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-[0.3em]">Health</h1>
        <button className="absolute right-3 flex size-9 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-slate-400">
          <span className="material-symbols-outlined text-[22px]">ios_share</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4 pb-10 space-y-4">

        {/* ─── Big Score (original position) ─── */}
        <div className="bg-white dark:bg-slate-800/60 rounded-[28px] border-2 border-slate-100 dark:border-slate-700/60 px-6 py-7 flex flex-col items-center gap-3">
          <div className={`size-32 rounded-full border-4 flex items-center justify-center ${scoreBg(overallScore)} ${overallScore >= 80 ? 'border-emerald-300/60 dark:border-emerald-500/30' : overallScore >= 60 ? 'border-amber-300/60 dark:border-amber-500/30' : 'border-rose-300/60 dark:border-rose-500/30'}`}>
            <span className={`text-5xl font-black tabular-nums tracking-tighter ${scoreText(overallScore)}`}>{overallScore}</span>
          </div>
          <div className="text-center">
            <p className={`text-sm font-black ${scoreText(overallScore)}`}>
              {overallScore >= 80 ? 'Well Optimized' : overallScore >= 60 ? 'Moderately Optimized' : 'Needs Attention'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Health Score · {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* ─── Quick Stats ─── */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Spend',  val: `$${monthlySpend.toFixed(0)}`, sub: `of $${budget}`,       color: 'text-gray-900 dark:text-white' },
            { label: 'Active', val: String(activeSubs.length),     sub: 'subscriptions',        color: 'text-primary' },
            { label: 'Saved',  val: String(pausedSubs.length),     sub: 'paused',               color: 'text-emerald-600 dark:text-emerald-400' },
          ].map(tile => (
            <div key={tile.label} className="bg-white dark:bg-slate-800/60 rounded-2xl border-2 border-slate-100 dark:border-slate-700/60 px-3 py-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">{tile.label}</p>
              <p className={`text-lg font-black leading-none ${tile.color}`}>{tile.val}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{tile.sub}</p>
            </div>
          ))}
        </div>

        {/* ─── Score Breakdown (pulled out, main feature) ─── */}
        <div className="bg-white dark:bg-slate-800/60 rounded-[28px] border-2 border-slate-100 dark:border-slate-700/60 overflow-hidden">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-gray-900 dark:text-white">Score Breakdown</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">What builds your health score</p>
            </div>
            <div className={`px-3 py-1.5 rounded-full ${scoreBg(overallScore)}`}>
              <span className={`text-lg font-black tabular-nums ${scoreText(overallScore)}`}>{overallScore}</span>
            </div>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700/40 px-1">
            {DIMENSION_META.map((meta, i) => (
              <div key={meta.key} className="flex items-start gap-3 px-4 py-3.5">
                <span className="text-lg shrink-0 mt-0.5">{meta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-bold text-gray-800 dark:text-slate-200">{meta.label}</span>
                    <span className={`text-xs font-black tabular-nums ${scoreText(dimensionScores[i])}`}>{dimensionScores[i]}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${scoreColor(dimensionScores[i])}`} style={{ width: `${dimensionScores[i]}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{dimensionHints[i]}</p>
                </div>
                <span className="text-[9px] font-black text-slate-300 dark:text-slate-600 shrink-0 mt-1">{meta.weight}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Grid Dashboard ─── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              type: 'spending' as DetailType,
              label: 'Monthly Spend',
              value: `$${monthlySpend.toFixed(0)}`,
              cta: 'Detail',
              valClass: 'text-gray-900 dark:text-white',
            },
            {
              type: 'assessments' as DetailType,
              label: 'AI Audits',
              value: String(auditReports.length),
              cta: 'History',
              valClass: 'text-gray-900 dark:text-white',
            },
            {
              type: 'new' as DetailType,
              label: 'Newly Tracked',
              value: `+${newSubs.length}`,
              cta: 'View',
              valClass: 'text-primary',
            },
            {
              type: 'paused' as DetailType,
              label: 'Paused Subs',
              value: String(pausedSubs.length),
              cta: 'Savings',
              valClass: 'text-amber-500',
            },
          ].map(card => (
            <button
              key={card.type}
              onClick={() => setSelectedDetail({ type: card.type })}
              className="text-left bg-white dark:bg-slate-800/60 p-5 rounded-[24px] border-2 border-slate-100 dark:border-slate-700/60 active:scale-[0.97] transition-all flex flex-col justify-between h-28"
            >
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
                <p className={`text-2xl font-black tracking-tight ${card.valClass}`}>{card.value}</p>
              </div>
              <span className="text-[9px] font-black text-primary uppercase tracking-wider flex items-center gap-0.5">
                {card.cta}
                <span className="material-symbols-outlined text-[13px]">chevron_right</span>
              </span>
            </button>
          ))}
        </div>

        {/* ─── Savings Forecast ─── */}
        <div className="bg-primary rounded-[28px] px-6 py-5 text-white relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-2 opacity-90">
              <span className="material-symbols-outlined text-base">savings</span>
              <p className="text-[10px] font-bold uppercase tracking-widest">Yearly Savings Forecast</p>
            </div>
            <p className="text-4xl font-black tracking-tighter">
              ${(pausedSubs.reduce((a, b) => a + b.cost, 0) * 12).toFixed(0)}
            </p>
            <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mt-1">
              Based on {pausedSubs.length} paused sub{pausedSubs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* ─── Categories (incl. MBTI) ─── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pl-1">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Spend by Category</h2>
            <span className="text-[9px] text-slate-400">Tap for detail</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map(cat => {
              const total = activeSubs.filter(s => s.category === cat.code).reduce((a, b) => a + b.cost, 0);
              return (
                <button
                  key={cat.code}
                  onClick={() => setSelectedDetail({ type: 'category', data: cat })}
                  className="flex flex-col gap-3 bg-white dark:bg-slate-800/60 rounded-[24px] border-2 border-slate-100 dark:border-slate-700/60 p-4 active:scale-[0.97] transition-all text-left"
                >
                  <div className={`size-10 rounded-xl flex items-center justify-center ${cat.color}`}>
                    <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-gray-900 dark:text-white text-sm font-black tracking-tight">{cat.name}</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider mt-0.5">${total.toFixed(2)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Export/Share card (no big single number) ─── */}
        <div className="rounded-[28px] border-2 border-slate-100 dark:border-slate-700/60 overflow-hidden">
          <div className="bg-primary px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/70">SubSense Health</p>
              <p className="text-white font-black text-base mt-0.5">
                {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-2 active:scale-95 transition-all">
              <span className="material-symbols-outlined text-white text-[18px]">ios_share</span>
              <span className="text-white text-xs font-bold">Export</span>
            </button>
          </div>
          <div className="bg-white dark:bg-slate-800/60 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { label: 'Spend',  value: `$${monthlySpend.toFixed(2)}` },
                { label: 'Budget', value: `$${budget}` },
                { label: 'Active', value: `${activeSubs.length} subs` },
                { label: 'Paused', value: `${pausedSubs.length} subs` },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 dark:bg-slate-700/40 rounded-xl px-3 py-2.5">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{item.label}</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {DIMENSION_META.map((meta, i) => (
                <div key={meta.key} className="flex items-center gap-2.5">
                  <span className="text-base">{meta.emoji}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">{meta.label}</span>
                      <span className={`text-[11px] font-black ${scoreText(dimensionScores[i])}`}>{dimensionScores[i]}/100</span>
                    </div>
                    <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${scoreColor(dimensionScores[i])}`} style={{ width: `${dimensionScores[i]}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Detail Overlay ─── */}
      {selectedDetail && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-8">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={handleClose} />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1e2330] rounded-[32px] p-7 shadow-2xl animate-slide-up border border-slate-100 dark:border-slate-800">
            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="animate-fade-in">{renderDetail()}</div>
            <button
              onClick={handleClose}
              className="w-full mt-8 h-12 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded-2xl active:scale-[0.98] transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.38s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.25s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Report;
