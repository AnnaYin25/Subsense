'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSubscriptions } from '@/lib/contexts/SubscriptionContext';
import { getRecentCheckinResponses, type CheckinResponseRecord } from '@/lib/utils/database';
import type { Subscription, User } from '@/lib/types';

// ── types ─────────────────────────────────────────────────────────────────────
type DimensionKey = 'budget_health' | 'usage_efficiency' | 'subscription_health' | 'cancellation_timeliness' | 'cost_optimization';
interface DimensionScore { key: DimensionKey; label: string; weight: number; score: number; }
interface WastedSub { id: string; name: string; icon: string; costMonthly: number; usage: number; wasteScore: number; indicator: string; }
interface MonthlyReport {
  monthKey: string; monthLabel: string; overallScore: number;
  totalSpend: number; budgetDelta: number; budgetStatusText: string;
  activeCount: number; subsAdded: number; subsCancelled: number;
  dimensions: DimensionScore[]; topWasted: WastedSub[]; suggestions: string[];
}

// ── constants ─────────────────────────────────────────────────────────────────
const DIMENSION_LABELS: Record<DimensionKey, string> = {
  budget_health: '💰 Budget vs Spend', usage_efficiency: '😊 Satisfaction',
  subscription_health: '✅ Sub Health', cancellation_timeliness: '🧹 Cleanup Speed',
  cost_optimization: '💡 Cost Optimization',
};
const DIMENSION_DESC: Record<DimensionKey, string> = {
  budget_health: 'Are you within your monthly limit?',
  usage_efficiency: 'How satisfied are you with your subscriptions?',
  subscription_health: 'Healthy ratio of active to paused subs',
  cancellation_timeliness: 'Did you cancel low-use subs in time?',
  cost_optimization: 'Catching trials, down-swipes & cancellations',
};
const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  budget_health: 25, usage_efficiency: 25, subscription_health: 25,
  cancellation_timeliness: 15, cost_optimization: 10,
};
const CATEGORY_TARGETS: Record<string, number> = { Entertainment: 25, Productivity: 25, Utilities: 25, Health: 25 };

// ── helpers ───────────────────────────────────────────────────────────────────
const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const toMonthKey = (s: string) => { const d = new Date(s); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const formatMonth = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
const formatShortMonth = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);
const getSubCreatedAt = (s: Subscription) => s.created_at ?? s.createdAt;
const getSubUpdatedAt = (s: Subscription) => s.updated_at ?? s.updatedAt ?? s.created_at ?? s.createdAt;
const getSubIcon = (s: Subscription): string => String(s.icon_emoji ?? s.iconEmoji ?? '🧾');
const getSubBillingCycle = (s: Subscription): string => String(s.billing_cycle ?? s.billingCycle ?? 'monthly');
const getSubReminderFlag = (s: Subscription): boolean => Boolean(s.is_reminder ?? s.isReminder);
const normalizeMonthlyCost = (sub: Subscription): number => {
  const c = Number(sub.cost) || 0;
  switch (getSubBillingCycle(sub)) {
    case 'daily': return c * 30; case 'weekly': return c * 4;
    case 'quarterly': return c / 3; case 'yearly': return c / 12;
    default: return c;
  }
};
const dimColor = (s: number) => s >= 80 ? '#34C759' : s >= 60 ? '#FF9F0A' : s >= 40 ? '#F97316' : '#FF3B30';
const getMonthlyBudget = (user: User | null) => { const b = Number(user?.monthly_budget ?? 100); return Number.isFinite(b) && b > 0 ? b : 100; };
const getOptimizationLabel = (s: number) => s < 50 ? 'Needs Attention' : s < 80 ? 'Moderately Optimized' : 'Well Optimized';
const humanizeInsight = (text: string) => {
  const plain = text.trim();
  if (!plain) return plain;
  const lower = plain.toLowerCase();
  if (lower.includes('entertainment is')) return "You're spending heavily on entertainment.\nTry balancing with productivity or utility tools.";
  if (lower.includes('lower usage relative to its monthly cost')) return 'Usage is low relative to cost.\nReview this subscription before the next billing cycle.';
  if (lower.includes('canceled')) return 'You took action on low-value subscriptions.\nKeep doing this to protect your budget.';
  if (lower.includes('below your target budget mix')) return 'This category still has room in your budget.\nOnly add tools that clearly support your routine.';
  return plain.replace('. ', '.\n');
};

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const splitSvgLine = (value: string, max = 32) => {
  const words = value.split(' ');
  const lines: string[] = [];
  let current = '';
  words.forEach(word => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines.slice(0, 3);
};

const makeShareSvg = (
  report: MonthlyReport,
  scoreLabel: string,
  focusLabel: string,
  budgetDeltaText: string,
) => {
  const review = report.topWasted[0]?.name ?? 'No urgent reviews';
  const reviewReason = report.topWasted[0]?.indicator ?? 'Your subscriptions look steady right now.';
  const titleLines = splitSvgLine(`${report.overallScore}/100 ${scoreLabel}`, 26);
  const reviewLines = splitSvgLine(reviewReason, 42);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="#F9FAFB"/>
  <rect x="70" y="70" width="940" height="1210" rx="54" fill="#FFFFFF" stroke="#E5E5EA" stroke-width="3"/>
  <text x="120" y="155" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="900" fill="#3B82F6" letter-spacing="4">SUBSENSE HEALTH</text>
  <text x="120" y="205" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="700" fill="#6E6E73">${escapeXml(report.monthLabel.replace(' Report', ''))}</text>
  <circle cx="540" cy="410" r="150" fill="#EFF6FF" stroke="#3B82F6" stroke-width="16"/>
  <text x="540" y="398" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="112" font-weight="900" fill="#111827">${report.overallScore}</text>
  <text x="540" y="455" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="800" fill="#3B82F6">/ 100</text>
  ${titleLines.map((line, i) => `<text x="540" y="${620 + i * 42}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="900" fill="#111827">${escapeXml(line)}</text>`).join('')}
  <text x="540" y="760" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700" fill="#6E6E73">Focus area: ${escapeXml(focusLabel)}</text>
  <rect x="120" y="830" width="400" height="150" rx="28" fill="#F9FAFB" stroke="#E5E5EA"/>
  <text x="155" y="885" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900" fill="#6E6E73">BUDGET</text>
  <text x="155" y="935" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="900" fill="#111827">${escapeXml(report.budgetStatusText)}</text>
  <text x="155" y="965" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="#6E6E73">${escapeXml(budgetDeltaText)}</text>
  <rect x="560" y="830" width="400" height="150" rx="28" fill="#F9FAFB" stroke="#E5E5EA"/>
  <text x="595" y="885" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900" fill="#6E6E73">THIS MONTH</text>
  <text x="595" y="935" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="900" fill="#111827">$${report.totalSpend.toFixed(2)}</text>
  <text x="595" y="965" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="#6E6E73">${report.activeCount} active subscriptions</text>
  <text x="120" y="1060" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="900" fill="#111827">Subscription to review</text>
  <text x="120" y="1108" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="900" fill="#3B82F6">${escapeXml(review)}</text>
  ${reviewLines.map((line, i) => `<text x="120" y="${1150 + i * 34}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" fill="#6E6E73">${escapeXml(line)}</text>`).join('')}
  <text x="120" y="1230" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="900" fill="#111827">SubSense</text>
</svg>`;
};

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const size = 208; const sw = 7; const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - clamp(score) / 100);
  const color = score < 50 ? '#FF3B30' : score < 80 ? '#FF9F0A' : '#34C759';
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E5EA" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.68s cubic-bezier(0.16,1,0.3,1)' }} />
      </svg>
      <div className="absolute flex items-center justify-center">
        <span style={{ fontSize: 60, lineHeight: '64px', fontWeight: 700, color: '#000', letterSpacing: -1.2 }}>{score}</span>
      </div>
    </div>
  );
}

// ── SVG trend line ────────────────────────────────────────────────────────────
function TrendChart({ points }: { points: number[] }) {
  const w = 320; const h = 140; const pad = 16;
  const uw = w - pad * 2; const uh = h - 20;
  const xStep = points.length > 1 ? uw / (points.length - 1) : 0;
  const circles = points.map((s, i) => ({ x: pad + i * xStep, y: 10 + ((100 - clamp(s)) / 100) * uh }));
  const path = circles.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <svg width={w} height={h} style={{ alignSelf: 'center', display: 'block', margin: '0 auto' }}>
      {path && <path d={path} stroke="#3B82F6" strokeWidth={3} fill="none" />}
      {circles.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={4} fill="#3B82F6" />)}
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const router = useRouter();
  const { subscriptions, user } = useSubscriptions();
  const [checkinResponses, setCheckinResponses] = useState<CheckinResponseRecord[]>([]);
  const [checkinLoading, setCheckinLoading] = useState(false);

  const monthlyBudget  = useMemo(() => getMonthlyBudget(user), [user]);
  const activeSubs     = useMemo(() => subscriptions.filter(s => s.status === 'active'), [subscriptions]);
  const cancelledSubs  = useMemo(() => subscriptions.filter(s => s.status === 'cancelled'), [subscriptions]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let cancelled = false;
    window.setTimeout(() => {
      if (cancelled) return;
      setCheckinLoading(true);
      getRecentCheckinResponses(userId, 6)
        .then(responses => {
          if (!cancelled) setCheckinResponses(responses);
        })
        .finally(() => {
          if (!cancelled) setCheckinLoading(false);
        });
    }, 0);
    return () => { cancelled = true; };
  }, [user?.id]);

  const reportHistory = useMemo<MonthlyReport[]>(() => {
    const now = new Date();
    const createdDates = subscriptions.map(getSubCreatedAt).map(s => s ? new Date(s) : null).filter((d): d is Date => !!d && !isNaN(d.getTime()));
    const checkinDates = checkinResponses.map(r => new Date(r.checkin_date)).filter(d => !isNaN(d.getTime()));
    const oldest = [...createdDates, ...checkinDates].length > 0
      ? [...createdDates, ...checkinDates].reduce((m, d) => d < m ? d : m) : now;
    const span  = (now.getFullYear() - oldest.getFullYear()) * 12 + (now.getMonth() - oldest.getMonth());
    const count = clamp(span + 1, 1, 6);
    const currentMonthlySpend = activeSubs.reduce((s, sub) => s + normalizeMonthlyCost(sub), 0);

    const wasActiveInMonth = (sub: Subscription, start: Date, end: Date) => {
      const created = new Date(getSubCreatedAt(sub) || now);
      if (created > end) return false;
      if (sub.status === 'cancelled') { const c = new Date(getSubUpdatedAt(sub) || now); return c >= start; }
      return sub.status === 'active';
    };

    const byMonth = new Map<string, CheckinResponseRecord[]>();
    const bySub   = new Map<string, CheckinResponseRecord[]>();
    checkinResponses.forEach(r => {
      const mk = toMonthKey(r.checkin_date);
      byMonth.set(mk, [...(byMonth.get(mk) || []), r]);
      bySub.set(r.subscription_id, [...(bySub.get(r.subscription_id) || []), r]);
    });
    bySub.forEach(l => l.sort((a, b) => new Date(a.checkin_date).getTime() - new Date(b.checkin_date).getTime()));

    const zombieSignal = new Map<string, Date>();
    bySub.forEach((list, id) => {
      for (let i = 1; i < list.length; i++) {
        if (list[i-1].swipe_direction === 'left' && list[i].swipe_direction === 'left') {
          zombieSignal.set(id, new Date(list[i].checkin_date)); break;
        }
      }
    });

    return Array.from({ length: count }, (_, idx) => {
      const i = count - 1 - idx;
      const monthDate  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = monthDate;
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const mk         = toMonthKey(monthDate.toISOString());
      const monthResps = byMonth.get(mk) || [];

      const monthSpend = i === 0 ? currentMonthlySpend
        : subscriptions.filter(s => wasActiveInMonth(s, monthStart, monthEnd)).reduce((s, sub) => s + normalizeMonthlyCost(sub), 0);

      const bySubMonth = new Map<string, CheckinResponseRecord[]>();
      monthResps.forEach(r => bySubMonth.set(r.subscription_id, [...(bySubMonth.get(r.subscription_id) || []), r]));

      const usageBySub = new Map<string, number>();
      const lowUsageIds: string[] = [];
      bySubMonth.forEach((list, sid) => {
        const right = list.filter(r => r.swipe_direction === 'right').length;
        const left  = list.filter(r => r.swipe_direction === 'left').length;
        const down  = list.filter(r => r.swipe_direction === 'down').length;
        usageBySub.set(sid, list.length > 0 ? (right + down * 0.5) / list.length : 0.5);
        if (left >= 2 && right === 0) lowUsageIds.push(sid);
      });

      const uv = activeSubs.map(s => usageBySub.get(s.id) ?? 0.5);
      const highC = uv.filter(v => v >= 0.7).length;
      const lowC  = uv.filter(v => v <= 0.3).length;
      const midC  = Math.max(uv.length - highC - lowC, 0);
      const br    = monthSpend / Math.max(monthlyBudget, 1);
      const budgetHealth       = clamp(br < 1 ? 100 : 75 * Math.exp(-(br - 1) * 3.6));
      const usageEfficiency    = uv.length > 0 ? clamp(((highC + midC * 0.5) / uv.length) * 100 - (lowC / uv.length) * 20) : 50;
      const subscriptionHealth = subscriptions.length > 0 ? (activeSubs.length / subscriptions.length) * 100 : 50;

      const cancelledThisMonth = cancelledSubs.filter(s => { const u = getSubUpdatedAt(s); return u && toMonthKey(new Date(u).toISOString()) === mk; });
      const timelyCancelled = cancelledThisMonth.filter(s => {
        const sig = zombieSignal.get(s.id); if (!sig) return false;
        const cdate = new Date(getSubUpdatedAt(s) || now);
        return (cdate.getTime() - sig.getTime()) / 86400000 >= 0 && (cdate.getTime() - sig.getTime()) / 86400000 <= 30;
      }).length;
      const zombieOpen = lowUsageIds.filter(id => !cancelledThisMonth.some(s => s.id === id)).length;
      const cancellationTimeliness = timelyCancelled === 0 && zombieOpen === 0 ? 100
        : clamp((timelyCancelled / Math.max(timelyCancelled + zombieOpen, 1)) * 100 + (timelyCancelled > 0 ? 10 : 0));

      const catSpend = activeSubs.reduce<Record<string, number>>((acc, s) => { acc[s.category] = (acc[s.category] || 0) + normalizeMonthlyCost(s); return acc; }, {});
      const tSafe    = Math.max(monthSpend, 1);
      const trialUse = activeSubs.filter(s => (normalizeMonthlyCost(s) === 0 || getSubReminderFlag(s)) && (bySubMonth.get(s.id) || []).length > 0).length;
      const thoughtDown = monthResps.filter(r => r.swipe_direction === 'down').length;
      const optPts   = Math.min(10, trialUse * 3 + Math.min(3, thoughtDown) * 2 + timelyCancelled * 5);

      const dimensions: DimensionScore[] = [
        { key: 'budget_health',           label: DIMENSION_LABELS.budget_health,           weight: DIMENSION_WEIGHTS.budget_health,           score: Math.round(budgetHealth) },
        { key: 'usage_efficiency',        label: DIMENSION_LABELS.usage_efficiency,        weight: DIMENSION_WEIGHTS.usage_efficiency,        score: Math.round(usageEfficiency) },
        { key: 'subscription_health',     label: DIMENSION_LABELS.subscription_health,     weight: DIMENSION_WEIGHTS.subscription_health,     score: Math.round(subscriptionHealth) },
        { key: 'cancellation_timeliness', label: DIMENSION_LABELS.cancellation_timeliness, weight: DIMENSION_WEIGHTS.cancellation_timeliness, score: Math.round(cancellationTimeliness) },
        { key: 'cost_optimization',       label: DIMENSION_LABELS.cost_optimization,       weight: DIMENSION_WEIGHTS.cost_optimization,       score: Math.round(clamp((optPts / 10) * 100)) },
      ];
      const overall     = Math.round(dimensions.reduce((s, d) => s + (d.score * d.weight) / 100, 0));
      const budgetDelta = monthlyBudget - monthSpend;

      const wastedSubs = activeSubs.map(s => {
        const usage = usageBySub.get(s.id) ?? 0.5;
        const costMonthly = normalizeMonthlyCost(s);
        const leftCount = (bySubMonth.get(s.id) || []).filter(r => r.swipe_direction === 'left').length;
        return { id: s.id, name: s.name, icon: getSubIcon(s), costMonthly, usage, wasteScore: costMonthly * (1 - usage),
          indicator: leftCount >= 2 ? `Low usage this month (${leftCount} low-usage check-ins)` : 'Usage trend is soft compared to cost' };
      }).sort((a, b) => b.wasteScore - a.wasteScore).slice(0, 3);

      const suggestions: string[] = [];
      const entPct  = tSafe > 0 ? ((catSpend.Entertainment || 0) / tSafe) * 100 : 0;
      const prodPct = tSafe > 0 ? ((catSpend.Productivity  || 0) / tSafe) * 100 : 0;
      if (entPct > CATEGORY_TARGETS.Entertainment + 10) suggestions.push(`Entertainment is ${Math.round(entPct)}% of your spend, above your target mix. Consider optimizing this category.`);
      if (wastedSubs.length > 0) suggestions.push(`${wastedSubs[0].name} shows lower usage relative to its monthly cost. Review fit before the next renewal.`);
      if (timelyCancelled > 0) suggestions.push(`You canceled ${timelyCancelled} low-usage subscription${timelyCancelled > 1 ? 's' : ''} within 30 days of signal.`);
      if (prodPct < CATEGORY_TARGETS.Productivity - 10) suggestions.push(`Productivity tools are below your target budget mix, so you still have room if a high-value tool appears.`);
      if (suggestions.length === 0) suggestions.push('Spending and usage are balanced this month. Keep monitoring renewals to maintain momentum.');

      return {
        monthKey: monthDate.toISOString(), monthLabel: `${formatMonth(monthDate)} Report`,
        overallScore: overall, totalSpend: monthSpend, budgetDelta,
        budgetStatusText: Math.abs(budgetDelta) < 1 ? 'At Budget' : budgetDelta > 0 ? 'Under Budget' : 'Over Budget',
        activeCount: activeSubs.length, subsAdded: subscriptions.filter(s => { const c = getSubCreatedAt(s); return c && toMonthKey(new Date(c).toISOString()) === mk; }).length,
        subsCancelled: cancelledThisMonth.length,
        dimensions, topWasted: wastedSubs, suggestions: suggestions.slice(0, 5),
      };
    });
  }, [subscriptions, activeSubs, cancelledSubs, monthlyBudget, checkinResponses]);

  const current   = reportHistory[reportHistory.length - 1];
  const previous  = reportHistory.length > 1 ? reportHistory[reportHistory.length - 2] : null;
  const spendPoints  = reportHistory.map(r => r.totalSpend);
  const maxSpend     = Math.max(...spendPoints, 1);
  const trendPoints  = reportHistory.map(r => r.overallScore);
  const trendMonths  = reportHistory.map(r => formatShortMonth(new Date(r.monthKey)));
  const recentTrend  = reportHistory.slice(-3);
  const spendDiff    = previous && current ? current.totalSpend - previous.totalSpend : 0;
  const completedCheckinsCount = new Set(checkinResponses.map(r => r.checkin_id)).size;
  const shareBudgetDeltaText =
    current.budgetDelta >= 0
      ? `$${current.budgetDelta.toFixed(2)} under budget`
      : `$${Math.abs(current.budgetDelta).toFixed(2)} over budget`;

  const spendTrendInsight = (() => {
    if (reportHistory.length < 2) return null;
    const first = reportHistory[0].totalSpend; const last = reportHistory[reportHistory.length - 1].totalSpend;
    const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
    const months = reportHistory.length;
    if (Math.abs(pct) < 2) return `Spending has been stable over the past ${months} month${months > 1 ? 's' : ''}.`;
    return pct < 0
      ? `Your spending decreased ${Math.abs(pct)}% over the past ${months} months.`
      : `Your spending increased ${pct}% over the past ${months} months.`;
  })();

  if (!current) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <p className="text-sm text-[#6E6E73]">Preparing your health report...</p>
      </div>
    );
  }

  if (subscriptions.length >= 3 && checkinLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <p className="text-sm text-[#6E6E73]">Loading latest check-in signals...</p>
      </div>
    );
  }

  const scoreLabel   = getOptimizationLabel(current.overallScore);
  const lowestDim    = current.dimensions.reduce((m, d) => d.score < m.score ? d : m);
  const conversationalInsights = current.suggestions.map(humanizeInsight);
  const healthSummary = (() => {
    if (current.topWasted.length > 0 && current.budgetDelta < 0) {
      return {
        tone: 'Needs attention',
        title: 'Spending is over budget and a few subscriptions look soft.',
        body: `Start with ${current.topWasted[0].name} before the next renewal.`,
        color: '#FF3B30',
      };
    }
    if (current.topWasted.length > 0) {
      return {
        tone: 'Worth reviewing',
        title: 'Your budget is mostly under control, but one subscription needs a look.',
        body: `${current.topWasted[0].name} has the weakest cost-to-usage signal right now.`,
        color: '#FF9F0A',
      };
    }
    if (current.budgetDelta >= 0 && current.overallScore >= 80) {
      return {
        tone: 'Healthy',
        title: 'Your subscriptions are in good shape this month.',
        body: `You are ${current.budgetStatusText.toLowerCase()} with no high-risk reviews waiting.`,
        color: '#34C759',
      };
    }
    return {
      tone: 'Stable',
      title: 'Your subscription health is steady, with room to tune.',
      body: `${lowestDim.label.replace(/[^\w\s]/g, '').trim()} is the easiest place to improve.`,
      color: dimColor(current.overallScore),
    };
  })();
  const handleShare = async () => {
    const shareMessage = [
      `My SubSense ${current.monthLabel}: ${current.overallScore}/100 (${scoreLabel})`,
      `${current.activeCount} subscriptions managed`,
      shareBudgetDeltaText,
      current.topWasted[0] ? `Review: ${current.topWasted[0].name}` : 'No urgent subscriptions to review right now',
    ].join('\n');

    try {
      const svg = makeShareSvg(current, scoreLabel, lowestDim.label, shareBudgetDeltaText);
      const file = new File([new Blob([svg], { type: 'image/svg+xml' })], 'subsense-health.svg', { type: 'image/svg+xml' });
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };

      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          title: 'SubSense Health Report',
          text: shareMessage,
          files: [file],
        });
        return;
      }

      if (nav.share) {
        await nav.share({ title: 'SubSense Health Report', text: shareMessage });
        return;
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'subsense-health.svg';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[ReportPage] Share failed:', error);
      window.alert('Unable to open share sheet right now.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#F9FAFB]/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="w-8 h-8" />
        <span className="text-sm font-black tracking-[0.15em] text-gray-900">HEALTH</span>
        <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors text-xl">
          ↑
        </button>
      </header>

      <div className="max-w-lg mx-auto px-5 pb-28 flex flex-col gap-4 pt-2">

        {/* Health summary */}
        <div className="bg-white rounded-[18px] border border-gray-200 px-4 py-3 mt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black tracking-widest" style={{ color: healthSummary.color }}>
              {healthSummary.tone.toUpperCase()}
            </p>
            <div className="h-7 px-2.5 rounded-full flex items-center" style={{ backgroundColor: healthSummary.color + '18' }}>
              <span className="text-xs font-black" style={{ color: healthSummary.color }}>{current.overallScore}</span>
            </div>
          </div>
          <h1 className="text-lg font-black text-gray-900 leading-snug">{healthSummary.title}</h1>
          <p className="text-xs text-[#6E6E73] leading-5 mt-1">{healthSummary.body}</p>
        </div>

        {/* Sync banner */}
        {completedCheckinsCount === 0 && (
          <div className="flex items-start gap-2 py-0.5">
            <span className="text-blue-500 text-base shrink-0 mt-0.5">ℹ</span>
            <p className="text-sm text-[#6E6E73] font-medium leading-snug flex-1">
              Do more check-ins to sharpen your score — swipe through your subs to update usage signals.
            </p>
          </div>
        )}

        {/* Score ring section */}
        <div className="flex flex-col items-center pt-9 pb-8 gap-0">
          <ScoreRing score={current.overallScore} />
          <p className="mt-[18px] text-lg font-semibold text-gray-900">{scoreLabel}</p>
          <p className="mt-2 text-sm text-[#6E6E73] text-center">
            {current.overallScore >= 80
              ? 'Your subscriptions are well-optimized.'
              : current.overallScore >= 60
                ? 'Some room to improve — see breakdown below.'
                : 'Several areas need attention.'}
          </p>
        </div>

        {/* Quick stats row */}
        <div className="flex gap-2 mt-1">
          {[
            { label: 'Spend',    value: `$${current.totalSpend.toFixed(0)}`,       sub: current.budgetStatusText,                             color: undefined },
            { label: 'Active',   value: String(current.activeCount),               sub: 'subscriptions',                                      color: '#3B82F6' },
            { label: 'Canceled', value: String(current.subsCancelled),             sub: `${spendDiff >= 0 ? '+' : ''}$${spendDiff.toFixed(0)} vs last`, color: '#34C759' },
          ].map(tile => (
            <div key={tile.label} className="flex-1 bg-gray-50 rounded-[14px] border border-gray-200 py-[10px] px-2 flex flex-col items-center">
              <p className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-[0.05em] mb-1">{tile.label}</p>
              <p className="text-xl font-extrabold leading-6" style={{ color: tile.color ?? '#000' }}>{tile.value}</p>
              <p className="text-[10px] text-[#6E6E73] mt-0.5 text-center">{tile.sub}</p>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-[#E5E5EA] my-2" />

        {/* Wallet section */}
        <div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[28px] leading-9 font-semibold text-gray-900">${current.totalSpend.toFixed(2)}</p>
              <p className="mt-0.5 text-sm text-[#6E6E73]">This month</p>
            </div>
            <div className="text-right">
              <p className="text-base font-semibold" style={{
                color: current.budgetDelta > 0 ? '#34C759' : current.budgetDelta < 0 ? '#FF3B30' : '#6E6E73'
              }}>{current.budgetStatusText}</p>
              <p className="mt-0.5 text-sm text-[#6E6E73]">
                {spendDiff >= 0 ? '+' : '-'}${Math.abs(spendDiff).toFixed(2)} vs last
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-[#6E6E73]">
            {current.subsAdded} added · {current.subsCancelled} canceled
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#E5E5EA] my-2" />

        {/* Spending by Month */}
        {reportHistory.length >= 1 && (
          <div className="bg-white rounded-[18px] border border-gray-200 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-extrabold text-gray-900">Spending by Month</p>
              <p className="text-sm font-semibold text-[#6E6E73]">{reportHistory.length > 1 ? 'Historical comparison' : 'Current month'}</p>
            </div>
            <div className="flex flex-col gap-2">
              {reportHistory.map((report, index) => {
                const barPct = Math.max(spendPoints[index] / maxSpend, 0.02);
                const isLatest = index === reportHistory.length - 1;
                return (
                  <div key={report.monthKey} className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#6E6E73] w-8 shrink-0">{formatShortMonth(new Date(report.monthKey))}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${barPct * 100}%`, backgroundColor: isLatest ? '#3B82F6' : '#D1D5DB' }} />
                    </div>
                    <span className={`text-sm w-12 text-right shrink-0 ${isLatest ? 'font-extrabold text-gray-900' : 'font-semibold text-[#6E6E73]'}`}>
                      ${report.totalSpend.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
            {spendTrendInsight && (
              <div className="flex items-center gap-2">
                <span className="text-base" style={{
                  color: spendTrendInsight.includes('decreased') ? '#34C759' : spendTrendInsight.includes('increased') ? '#FF3B30' : '#6E6E73'
                }}>
                  {spendTrendInsight.includes('decreased') ? '↘' : spendTrendInsight.includes('increased') ? '↗' : '→'}
                </span>
                <p className="text-sm text-[#6E6E73]">{spendTrendInsight}</p>
              </div>
            )}
          </div>
        )}

        {/* Recent Trend */}
        <div className="bg-white rounded-[18px] border border-gray-200 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-base font-extrabold text-gray-900">Recent Trend</p>
            <p className="text-sm font-semibold text-[#6E6E73]">Last {trendPoints.length} month snapshots</p>
          </div>
          <TrendChart points={trendPoints} />
          <div className="flex justify-between px-2">
            {trendMonths.map((m, i) => <span key={i} className="text-sm font-semibold text-[#6E6E73]">{m}</span>)}
          </div>
          <div className="flex gap-2">
            {recentTrend.map(item => (
              <div key={item.monthKey} className="flex-1 rounded-[14px] border border-gray-200 bg-gray-50 py-2 px-2 flex flex-col items-center">
                <p className="text-sm font-semibold text-[#6E6E73]">{formatShortMonth(new Date(item.monthKey))}</p>
                <p className="text-xl font-extrabold text-gray-900">{item.overallScore}</p>
              </div>
            ))}
          </div>
          {trendPoints.length < 6 && (
            <p className="text-sm text-[#6E6E73] leading-5">Trend gets sharper as more months accumulate.</p>
          )}
        </div>

        {/* Score Breakdown */}
        <div className="bg-white rounded-[18px] border border-gray-200 p-5 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-base font-extrabold text-gray-900">Score Breakdown</p>
              <div className="px-2.5 py-1 rounded-full" style={{ backgroundColor: dimColor(current.overallScore) + '22' }}>
                <span className="text-base font-extrabold" style={{ color: dimColor(current.overallScore) }}>{current.overallScore}</span>
              </div>
            </div>
            <p className="text-sm text-[#6E6E73] font-semibold mt-0.5">What builds your health score</p>
          </div>
          <div className="flex flex-col gap-0.5">
            {current.dimensions.map(dim => {
              const isLowest = dim.key === lowestDim.key;
              return (
                <div key={dim.key} className={`flex flex-col gap-1.5 py-1.5 ${isLowest ? 'rounded-lg px-2' : ''}`}
                  style={isLowest ? { backgroundColor: '#FF3B3010' } : {}}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-900" style={{ fontWeight: 500 }}>{dim.label}</span>
                    <span className="text-sm font-semibold" style={{ color: dimColor(dim.score) }}>{dim.score}</span>
                  </div>
                  <p className="text-xs text-[#6E6E73]">{DIMENSION_DESC[dim.key]}</p>
                  <div className="h-1.5 bg-[#E5E5EA] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${dim.score}%`, backgroundColor: dimColor(dim.score) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subscriptions to Review */}
        <div className="bg-white rounded-[18px] border border-gray-200 p-5 flex flex-col gap-4">
          <p className="text-base font-extrabold text-gray-900">Subscriptions to Review</p>
          {current.topWasted.length > 0 ? (
            <div className="flex flex-col gap-2">
              {current.topWasted.map(sub => (
                <div key={sub.id} className="flex items-center justify-between bg-gray-50 rounded-2xl border border-gray-200 p-3 gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-[22px]">{sub.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-extrabold text-gray-900 truncate">{sub.name}</p>
                      <p className="text-sm text-[#6E6E73] leading-5 truncate">Reason: {sub.indicator}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-base font-extrabold text-red-500">${sub.costMonthly.toFixed(2)}</p>
                    <button onClick={() => router.push(`/subscription/${sub.id}`)}
                      className="h-11 min-w-[84px] rounded-xl border border-blue-500 px-3 flex items-center justify-center text-sm font-bold text-blue-500 hover:bg-blue-50 transition-colors"
                      style={{ backgroundColor: '#3B82F612' }}>
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#6E6E73]">Great job. No high-risk subscriptions to review right now.</p>
          )}
        </div>

        {/* Optimization Insights */}
        <div className="bg-white rounded-[18px] border border-gray-200 p-5 flex flex-col gap-4">
          <p className="text-base font-extrabold text-gray-900">Optimization Insights</p>
          <div className="flex flex-col gap-3">
            {conversationalInsights.map((s, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-blue-500 text-base shrink-0 mt-0.5">✦</span>
                <p className="text-base text-gray-900 leading-6 flex-1 whitespace-pre-line">{s}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Share CTA */}
        <button
          onClick={handleShare}
          className="h-[52px] rounded-2xl bg-blue-500 flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
        >
          <span className="text-xl text-white">↑</span>
          <span className="text-base font-extrabold text-white">Share My Health Report</span>
        </button>

      </div>
    </div>
  );
}
