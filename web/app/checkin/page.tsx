'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useSubscriptions } from '@/lib/contexts/SubscriptionContext';
import {
  generateReviewQuestions,
  generateLoveQuestions,
  generateUnsureQuestions,
  FALLBACK_REVIEW_QUESTIONS,
  FALLBACK_LOVE_QUESTIONS,
  FALLBACK_UNSURE_QUESTIONS,
  type ReviewQuestions,
  type LoveQuestions,
} from '@/lib/utils/checkinLLM';
import {
  generateSessionSummary,
  buildSubSummaries,
  type SessionSummary,
} from '@/lib/utils/checkinSummary';
import {
  getRecentAuditSignals,
  getSubCheckinHistory,
  getUserAppState,
  getWeeklyCheckinState,
  removeUserAppState,
  resetWeeklyCheckinComplete,
  setUserAppState,
  setWeeklyCheckinComplete,
  type CheckinHistoryEntry,
  type RecentAuditSignal,
} from '@/lib/utils/database';
import type { CheckInAction, SetupPreferences, Subscription } from '@/lib/types';

// ---- Types ----
type CardMode = 'card' | 'question' | 'ignore';
type QuestionFlow = 'love' | 'unsure' | 'review';

interface QuestionCacheEntry {
  love?: LoveQuestions;
  review?: ReviewQuestions;
  unsure?: ReviewQuestions;
}

interface IgnoredSub {
  subId: string;
  subName: string;
  iconEmoji: string;
  color: string;
  ignoredAt: string;
  durationLabel: string;
  expiresAt: string | null;
}

interface CheckinStreakState {
  count: number;
  lastWeekKey: string;
}

// ---- Constants ----
const SWIPE_THRESHOLD = 120;

const IGNORE_DURATIONS: Array<{ label: string; days: number | null }> = [
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: 'Forever', days: null },
];

const DEFAULT_PERSONA: SetupPreferences = {
  budget_tightness: 0.5,
  price_sensitivity: 0.5,
  waste_tolerance: 0.5,
  exploration_tendency: 0.5,
  quality_preference: 0.5,
  decision_style: 'moderate',
  favorite_categories: [],
};

// ---- Week helpers ----
// reminderDay: 0=Sun, 1=Mon, ..., 6=Sat — matches user.reminder_day
function getWeekStartKey(reminderDay = 0): string {
  const now = new Date();
  const diff = (now.getDay() - reminderDay + 7) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff);
  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, '0');
  const d = String(weekStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPrevWeekKey(reminderDay = 0): string {
  const now = new Date();
  const diff = (now.getDay() - reminderDay + 7) % 7;
  const prevStart = new Date(now);
  prevStart.setDate(now.getDate() - diff - 7);
  const y = prevStart.getFullYear();
  const m = String(prevStart.getMonth() + 1).padStart(2, '0');
  const d = String(prevStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Safe localStorage helpers
function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}
function lsRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

// ---- Inline SVG icons ----
const IconClose = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
const IconHeart = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);
const IconArrowBack = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M20 12H4M4 12l6-6M4 12l6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconArrowForward = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 12h16M16 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconArrowDown = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 4v16M6 16l6 6 6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconArchive = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z" fill={color} />
  </svg>
);
const IconCheckmark = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCalendar = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2" />
    <path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconTime = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <path d="M12 7v5l3 3" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconBulb = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.22-1.21 4.16-3 5.2V17H9v-2.8C7.21 13.16 6 11.22 6 9a6 6 0 0 1 6-6z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconTrendingDown = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M22 17l-9.5-9.5-5 5L2 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 17h6v-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconHandLeft = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconList = ({ size = 40, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconPerson = ({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" />
    <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconFlame = ({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-4-2-6-3-8-1 2-1.5 3-1.5 5 0-4-1.5-9-1.5-11z" />
  </svg>
);
const IconCheckCircle = ({ size = 32, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <path d="M8 12l3 3 5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconChevronForward = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCheckmarkCircleOutline = ({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <path d="M8 12l3 3 5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconAddCircle = ({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <path d="M12 8v8M8 12h8" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

function getQIcon(iconName: string, size: number, color: string) {
  switch (iconName) {
    case 'heart': return <IconHeart size={size} color={color} />;
    case 'trending-down': return <IconTrendingDown size={size} color={color} />;
    case 'bulb-outline': return <IconBulb size={size} color={color} />;
    case 'time-outline': return <IconTime size={size} color={color} />;
    case 'hand-left-outline': return <IconHandLeft size={size} color={color} />;
    default: return <IconBulb size={size} color={color} />;
  }
}

function getSubPlanName(sub: Subscription): string {
  return sub.planName || sub.plan_name || 'Standard';
}

function getSubBillingCycle(sub: Subscription): string {
  return sub.billingCycle || sub.billing_cycle || 'monthly';
}

function getSubIcon(sub: Subscription): string {
  return sub.iconEmoji || sub.icon_emoji || '📱';
}

function getSubUsageScore(sub: Subscription): number | undefined {
  return sub.usageScore ?? sub.usage_score;
}

// ---- CSS spinner ----
const Spinner = ({ color = '#3B82F6', size = 32 }: { color?: string; size?: number }) => (
  <div
    style={{
      width: size, height: size,
      border: `3px solid ${color}33`,
      borderTop: `3px solid ${color}`,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }}
  />
);

export default function CheckInPage() {
  const router = useRouter();
  const { subscriptions, user, persona, submitCheckInFeedback } = useSubscriptions();
  const [mounted, setMounted] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Ignore feature
  const [ignoredSubs, setIgnoredSubs] = useState<IgnoredSub[]>([]);
  const [loveStreaks, setLoveStreaks] = useState<Record<string, number>>({});
  const [showArchive, setShowArchive] = useState(false);

  const activeSubs = useMemo(() => {
    const now = new Date();
    const ignoredIds = new Set(
      ignoredSubs
        .filter(ig => ig.expiresAt === null || new Date(ig.expiresAt) > now)
        .map(ig => ig.subId)
    );
    return subscriptions.filter(s => s.status === 'active' && !ignoredIds.has(s.id));
  }, [subscriptions, ignoredSubs]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardMode, setCardMode] = useState<CardMode>('card');
  const [questionFlow, setQuestionFlow] = useState<QuestionFlow | null>(null);
  const [questionStep, setQuestionStep] = useState(0);
  const [q1Answer, setQ1Answer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestions | null>(null);
  const [loveQuestions, setLoveQuestions] = useState<LoveQuestions | null>(null);
  const [unsureQuestions, setUnsureQuestions] = useState<ReviewQuestions | null>(null);
  const [loadingReviewQ, setLoadingReviewQ] = useState(false);
  const [loadingLoveQ, setLoadingLoveQ] = useState(false);
  const [loadingUnsureQ, setLoadingUnsureQ] = useState(false);
  const [questionNotice, setQuestionNotice] = useState('');

  const [sessionResults, setSessionResults] = useState<
    Record<string, { action: CheckInAction; q1: string | null; q2: string | null; diveNote: string | null }>
  >({});
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [q2AnswerPending, setQ2AnswerPending] = useState<string | null>(null);
  const [diveMode, setDiveMode] = useState<'prompt' | 'input' | null>(null);
  const [diveText, setDiveText] = useState('');

  const [completedWeekKey, setCompletedWeekKey] = useState<string | null>(null);
  const [weekStatusLoaded, setWeekStatusLoaded] = useState(false);
  const [streak, setStreak] = useState(1);
  const [savedSummary, setSavedSummary] = useState<SessionSummary | null>(null);
  const [recentAudits, setRecentAudits] = useState<RecentAuditSignal[]>([]);

  const questionCache = useRef<Record<string, QuestionCacheEntry>>({});

  const getStateKey = useCallback((name: string) => `checkin:${name}`, []);

  const findAuditSignalForSub = useCallback((subName: string) => {
    const normalized = subName.toLowerCase();
    return recentAudits.find(a => {
      const auditName = a.service_name.toLowerCase();
      return auditName === normalized || auditName.includes(normalized) || normalized.includes(auditName);
    });
  }, [recentAudits]);

  const formatAuditSignal = useCallback((signal?: RecentAuditSignal) => {
    if (!signal) return '';
    const rec = signal.recommendation_type === 'delay' ? 'delay' : signal.recommendation_type;
    return `${signal.service_name}: audit score ${signal.overall_score}, recommendation ${rec}`;
  }, []);

  // Framer Motion values
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const rightOpacity = useTransform(x, [50, 150], [0, 1]);
  const leftOpacity = useTransform(x, [-150, -50], [1, 0]);
  const downOpacity = useTransform(y, [50, 150], [0, 1]);

  // Avatar animated scale on swipe
  const avatarScale = useTransform(
    x,
    [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.2, 0, SWIPE_THRESHOLD * 0.2, SWIPE_THRESHOLD],
    [0.88, 1, 1, 1.05, 1.25]
  );
  const avatarY = useTransform(
    x,
    [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.2, 0, SWIPE_THRESHOLD * 0.2, SWIPE_THRESHOLD],
    [8, 0, 0, -3, -12]
  );

  const currentSub = activeSubs[currentIndex];
  const nextSub = activeSubs[currentIndex + 1];
  const nextNextSub = activeSubs[currentIndex + 2];
  const isDone = currentIndex >= activeSubs.length;

  // Mount guard
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    const loadTutorialState = async () => {
      if (!user?.id) {
        setShowTutorial(lsGet('checkin_tutorial_seen') !== 'true');
        return;
      }
      const dbState = await getUserAppState<{ seen: boolean }>(user.id, getStateKey('tutorial'));
      const legacySeen = lsGet('checkin_tutorial_seen') === 'true';
      if (!cancelled) setShowTutorial(!(dbState?.seen ?? legacySeen));
      if (!dbState && legacySeen) void setUserAppState(user.id, getStateKey('tutorial'), { seen: true });
    };

    void loadTutorialState();
    return () => { cancelled = true; };
  }, [getStateKey, mounted, user?.id]);

  const dismissTutorial = () => {
    if (user?.id) void setUserAppState(user.id, getStateKey('tutorial'), { seen: true });
    lsSet('checkin_tutorial_seen', 'true');
    setShowTutorial(false);
  };

  // Load week status, saved summary, ignored subs, love streaks from DB first, localStorage fallback
  useEffect(() => {
    if (!mounted) return;
    if (!user?.id) { setWeekStatusLoaded(true); return; }
    let cancelled = false;

    const loadState = async () => {
      const weekKey = getWeekStartKey(user?.reminder_day ?? 0);
      const [weeklyState, summaryState, ignoredState, loveStreakState, auditSignals] = await Promise.all([
        getWeeklyCheckinState(user.id, weekKey),
        getUserAppState<SessionSummary>(user.id, getStateKey(`summary:${weekKey}`)),
        getUserAppState<IgnoredSub[]>(user.id, getStateKey('ignored')),
        getUserAppState<Record<string, number>>(user.id, getStateKey('loveStreaks')),
        getRecentAuditSignals(user.id, 10),
      ]);
      if (cancelled) return;

      const legacyWeek = lsGet(`checkin_week_${user.id}`);
      const completedKey = weeklyState?.completed ? weekKey : legacyWeek;
      setCompletedWeekKey(completedKey);
      setRecentAudits(auditSignals);

      if (completedKey) {
        const legacySummaryRaw = lsGet(`checkin_summary_${user.id}_${completedKey}`);
        const legacySummary = legacySummaryRaw ? JSON.parse(legacySummaryRaw) as SessionSummary : null;
        setSavedSummary(summaryState ?? legacySummary);
        if (!summaryState && legacySummary) void setUserAppState(user.id, getStateKey(`summary:${completedKey}`), legacySummary);
      }

      const now = new Date();
      const legacyIgnoredRaw = lsGet(`checkin_ignored_${user.id}`);
      const legacyIgnored = legacyIgnoredRaw ? JSON.parse(legacyIgnoredRaw) as IgnoredSub[] : [];
      const parsedIgnored = ignoredState ?? legacyIgnored;
      const activeIgnored = parsedIgnored.filter(ig => ig.expiresAt === null || new Date(ig.expiresAt) > now);
      setIgnoredSubs(activeIgnored);
      if (activeIgnored.length !== parsedIgnored.length || (!ignoredState && legacyIgnored.length > 0)) {
        void setUserAppState(user.id, getStateKey('ignored'), activeIgnored);
        lsSet(`checkin_ignored_${user.id}`, JSON.stringify(activeIgnored));
      }

      const legacyLoveRaw = lsGet(`checkin_love_streak_${user.id}`);
      const legacyLove = legacyLoveRaw ? JSON.parse(legacyLoveRaw) as Record<string, number> : {};
      const resolvedLove = loveStreakState ?? legacyLove;
      setLoveStreaks(resolvedLove);
      if (!loveStreakState && Object.keys(legacyLove).length > 0) {
        void setUserAppState(user.id, getStateKey('loveStreaks'), legacyLove);
      }

      setWeekStatusLoaded(true);
    };

    loadState().catch(() => setWeekStatusLoaded(true));
    return () => { cancelled = true; };
  }, [getStateKey, user?.id, mounted]);

  // Move to next card
  const nextCard = useCallback(() => {
    setCardMode('card');
    setQuestionFlow(null);
    setQuestionStep(0);
    setQ1Answer(null);
    setReviewQuestions(null);
    setLoveQuestions(null);
    setUnsureQuestions(null);
    setLoadingReviewQ(false);
    setLoadingLoveQ(false);
    setLoadingUnsureQ(false);
    setQuestionNotice('');
    setQ2AnswerPending(null);
    setDiveMode(null);
    setDiveText('');
    setCurrentIndex(prev => prev + 1);
    x.set(0);
    y.set(0);
  }, [x, y]);

  // Enter question mode
  const enterQuestionMode = useCallback((flow: QuestionFlow) => {
    if (flow === 'love') {
      const subId = activeSubs[currentIndex]?.id;
      if (subId && (loveStreaks[subId] ?? 0) >= 3) {
        setCardMode('ignore');
        setQuestionFlow('love');
        setQuestionStep(0);
        setQ1Answer(null);
        return;
      }
    }
    setQuestionFlow(flow);
    setQuestionStep(0);
    setQ1Answer(null);
    setQuestionNotice('');
    setCardMode('question');
  }, [activeSubs, currentIndex, loveStreaks]);

  // Drag end handler
  const handleDragEnd = useCallback((_event: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) {
      enterQuestionMode('love');
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      enterQuestionMode('review');
    } else if (info.offset.y > SWIPE_THRESHOLD) {
      enterQuestionMode('unsure');
    }
    x.set(0);
    y.set(0);
  }, [enterQuestionMode, x, y]);

  // Session summary generation when all cards done
  useEffect(() => {
    if (!isDone || Object.keys(sessionResults).length === 0) return;
    if (sessionSummary !== null || loadingSummary) return;

    if (user?.id) {
      const weekKey = getWeekStartKey(user.reminder_day);
      void setWeeklyCheckinComplete(user.id, weekKey, Object.keys(sessionResults).length);
      lsSet(`checkin_week_${user.id}`, weekKey);
      setCompletedWeekKey(weekKey);

      const streakRaw = lsGet(`checkin_streak_${user.id}`);
      let newCount = 1;
      if (streakRaw) {
        try {
          const { count, lastWeekKey } = JSON.parse(streakRaw) as { count: number; lastWeekKey: string };
          if (lastWeekKey === getPrevWeekKey(user.reminder_day)) newCount = count + 1;
        } catch { /* noop */ }
      }
      setStreak(newCount);
      lsSet(`checkin_streak_${user.id}`, JSON.stringify({ count: newCount, lastWeekKey: weekKey }));
      void setUserAppState(user.id, getStateKey('weekStreak'), { count: newCount, lastWeekKey: weekKey } satisfies CheckinStreakState);
    }

    // Update love streaks
    const updatedStreaks = { ...loveStreaks };
    Object.entries(sessionResults).forEach(([subId, result]) => {
      updatedStreaks[subId] = result.action === 'love' ? (updatedStreaks[subId] ?? 0) + 1 : 0;
    });
    setLoveStreaks(updatedStreaks);
    if (user?.id) {
      lsSet(`checkin_love_streak_${user.id}`, JSON.stringify(updatedStreaks));
      void setUserAppState(user.id, getStateKey('loveStreaks'), updatedStreaks);
    }

    setLoadingSummary(true);
    const summaries = buildSubSummaries(sessionResults, activeSubs);
    const personaPrefs = persona?.setup_preferences ?? DEFAULT_PERSONA;

    generateSessionSummary(summaries, personaPrefs).then(summary => {
      setSessionSummary(summary);
      setSavedSummary(summary);
      setLoadingSummary(false);
      if (user?.id) {
        const weekKey = getWeekStartKey(user.reminder_day);
        lsSet(`checkin_summary_${user.id}_${weekKey}`, JSON.stringify(summary));
        void setUserAppState(user.id, getStateKey(`summary:${weekKey}`), summary);
      }
    });
  }, [isDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Serve questions from cache or fetch on demand
  useEffect(() => {
    if (cardMode !== 'question' || !questionFlow || !currentSub) return;

    const subInfo = {
      name: currentSub.name,
      cost: currentSub.cost,
      billingCycle: getSubBillingCycle(currentSub),
      category: currentSub.category,
    };
    const personaPrefs = persona?.setup_preferences ?? DEFAULT_PERSONA;
    const cache = questionCache.current[currentSub.id] ?? {};
    const auditSignal = findAuditSignalForSub(currentSub.name);
    const auditContext = formatAuditSignal(auditSignal);

    if (questionFlow === 'review') {
      if (cache.review) { setReviewQuestions(cache.review); return; }
      setLoadingReviewQ(true);
      setReviewQuestions(null);
      const historyPromise = user?.id
        ? getSubCheckinHistory(user.id, currentSub.id, 6)
        : Promise.resolve([] as CheckinHistoryEntry[]);
      historyPromise.then(history =>
        generateReviewQuestions(
          subInfo,
          personaPrefs,
          history.map(h => ({ action: h.action, q1Answer: h.q1Answer })),
          auditContext,
        )
      ).then(questions => {
        if (questions === FALLBACK_REVIEW_QUESTIONS) {
          setQuestionNotice('Using quick fallback questions for now.');
        }
        setReviewQuestions(questions);
        setLoadingReviewQ(false);
      });
    } else if (questionFlow === 'love') {
      if (cache.love) { setLoveQuestions(cache.love); return; }
      setLoadingLoveQ(true);
      setLoveQuestions(null);
      generateLoveQuestions(subInfo, personaPrefs, auditContext).then(questions => {
        if (questions === FALLBACK_LOVE_QUESTIONS) {
          setQuestionNotice('Using quick fallback questions for now.');
        }
        setLoveQuestions(questions);
        setLoadingLoveQ(false);
      });
    } else if (questionFlow === 'unsure') {
      if (cache.unsure) { setUnsureQuestions(cache.unsure); return; }
      setLoadingUnsureQ(true);
      setUnsureQuestions(null);
      generateUnsureQuestions(subInfo, personaPrefs, auditContext).then(questions => {
        if (questions === FALLBACK_UNSURE_QUESTIONS) {
          setQuestionNotice('Using quick fallback questions for now.');
        }
        setUnsureQuestions(questions);
        setLoadingUnsureQ(false);
      });
    }
  }, [questionFlow, cardMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Submit feedback and advance
  const submitFeedback = useCallback(async (
    action: CheckInAction,
    step1: string | null,
    step2: string | null,
    diveNote: string | null,
  ) => {
    if (!currentSub) return;
    const subId = currentSub.id;
    setIsSubmitting(true);
    try {
      await submitCheckInFeedback({ subId, action, step1Reason: step1, step2Reason: step2, diveDeeperNote: diveNote });
    } catch { /* silent */ } finally {
      setIsSubmitting(false);
    }
    setSessionResults(prev => ({ ...prev, [subId]: { action, q1: step1, q2: step2, diveNote } }));
    nextCard();
  }, [currentSub, submitCheckInFeedback, nextCard]);

  const handleQ1Select = async (key: string) => {
    if (isSubmitting || !questionFlow) return;
    if (questionFlow === 'love') {
      await submitFeedback('love', key, null, null);
    } else {
      setQ1Answer(key);
      setQuestionStep(1);
    }
  };

  const handleQ2Select = (key: string) => {
    if (isSubmitting || !questionFlow) return;
    setQ2AnswerPending(key);
    setDiveMode('prompt');
  };

  const handleNextSub = () => {
    if (isSubmitting || !questionFlow) return;
    void submitFeedback(questionFlow as CheckInAction, q1Answer, q2AnswerPending, null);
  };

  const handleDiveDeeperOpen = () => { setDiveMode('input'); };

  const handleDiveSubmit = () => {
    if (isSubmitting || !questionFlow) return;
    void submitFeedback(questionFlow as CheckInAction, q1Answer, q2AnswerPending, diveText.trim() || null);
  };

  const handleIgnoreSelect = async (durationDays: number | null, durationLabel: string) => {
    if (!currentSub || isSubmitting) return;
    const now = new Date();
    const newIgnored: IgnoredSub = {
      subId: currentSub.id,
      subName: currentSub.name,
      iconEmoji: getSubIcon(currentSub),
      color: currentSub.color,
      ignoredAt: now.toISOString(),
      durationLabel,
      expiresAt: durationDays !== null
        ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()
        : null,
    };
    const updated = [...ignoredSubs.filter(ig => ig.subId !== currentSub.id), newIgnored];
    setIgnoredSubs(updated);
    if (user?.id) {
      lsSet(`checkin_ignored_${user.id}`, JSON.stringify(updated));
      void setUserAppState(user.id, getStateKey('ignored'), updated);
    }
    await submitFeedback('love', null, null, null);
  };

  const handleKeepAsking = () => { setCardMode('question'); };
  const handleSkipIgnore = () => { void submitFeedback('love', null, null, null); };

  const handleResumeIgnore = (subId: string) => {
    const updated = ignoredSubs.filter(ig => ig.subId !== subId);
    setIgnoredSubs(updated);
    if (user?.id) {
      lsSet(`checkin_ignored_${user.id}`, JSON.stringify(updated));
      void setUserAppState(user.id, getStateKey('ignored'), updated);
    }
  };

  const isAlreadyDoneThisWeek = weekStatusLoaded && completedWeekKey === getWeekStartKey(user?.reminder_day ?? 0);

  // Question content computation
  const qContent = useMemo(() => {
    if (!questionFlow) return null;
    if (questionFlow === 'love') {
      const lq = loveQuestions ?? FALLBACK_LOVE_QUESTIONS;
      return {
        icon: 'heart',
        iconColor: '#34C759',
        bgColor: '#34C75920',
        title: lq.q1.text,
        subtitle: currentSub?.name ?? '',
        options: lq.q1.options,
      };
    }
    if (questionFlow === 'review') {
      const rq = reviewQuestions ?? FALLBACK_REVIEW_QUESTIONS;
      if (questionStep === 0) {
        return {
          icon: 'trending-down',
          iconColor: '#FF3B30',
          bgColor: '#FF3B3020',
          title: rq.q1.text,
          subtitle: currentSub?.name ?? '',
          options: rq.q1.options,
        };
      } else {
        const q2 = q1Answer ? rq.q2Map[q1Answer] : null;
        if (!q2) return null;
        return {
          icon: 'bulb-outline',
          iconColor: '#FF9F0A',
          bgColor: '#FF9F0A20',
          title: q2.text,
          subtitle: currentSub?.name ?? '',
          options: q2.options,
        };
      }
    }
    if (questionFlow === 'unsure') {
      const uq = unsureQuestions ?? FALLBACK_UNSURE_QUESTIONS;
      if (questionStep === 0) {
        return {
          icon: 'time-outline',
          iconColor: '#3B82F6',
          bgColor: '#3B82F620',
          title: uq.q1.text,
          subtitle: currentSub?.name ?? '',
          options: uq.q1.options,
        };
      } else {
        const q2 = q1Answer ? uq.q2Map[q1Answer] : null;
        if (!q2) return null;
        return {
          icon: 'hand-left-outline',
          iconColor: '#3B82F6',
          bgColor: '#3B82F620',
          title: q2.text,
          subtitle: currentSub?.name ?? '',
          options: q2.options,
        };
      }
    }
    return null;
  }, [questionFlow, questionStep, q1Answer, reviewQuestions, loveQuestions, unsureQuestions, currentSub]);

  // Signal badge
  const signalInfo = useMemo(() => {
    if (!currentSub) return null;
    const usageScore = getSubUsageScore(currentSub);
    if (usageScore === undefined || usageScore === null) return { label: 'No signals yet', color: '#C7C7CC', bg: '#F2F2F7' };
    if (usageScore >= 70) return { label: '♥  Loving it', color: '#34C759', bg: '#34C75918' };
    if (usageScore >= 45) return { label: '◐  Mixed signals', color: '#FF9F0A', bg: '#FF9F0A18' };
    return { label: '○  On the fence', color: '#FF3B30', bg: '#FF3B3018' };
  }, [currentSub]);

  const currentAuditSignal = useMemo(() => {
    if (!currentSub) return undefined;
    return findAuditSignalForSub(currentSub.name);
  }, [currentSub, findAuditSignalForSub]);

  // Summary cards renderer
  const renderSummaryCards = (summary: SessionSummary) => (
    <div className="w-full flex flex-col gap-3">
      {summary.personaChanges.length > 0 && (
        <div className="w-full bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1 mb-2">
            <IconPerson size={12} color="#3B82F6" />
            <span className="text-[10px] font-black text-[#C7C7CC] uppercase tracking-wider">Your Profile Updated</span>
          </div>
          {summary.personaChanges.map((line, i) => (
            <div key={i} className="flex items-start gap-1 mt-1.5">
              <span className="text-sm text-[#3B82F6] font-black leading-[18px] w-2.5">•</span>
              <span className="flex-1 text-sm text-[#8E8E93] leading-[18px]">{line}</span>
            </div>
          ))}
        </div>
      )}

      {(summary.suggestions.length > 0 || summary.healthy.length > 0) && (
        <div className="w-full bg-white rounded-2xl p-4 shadow-sm">
          {summary.suggestions.length > 0 && (
            <>
              <div className="flex items-center gap-1 mb-2">
                <IconBulb size={12} color="#FF9F0A" />
                <span className="text-[10px] font-black text-[#C7C7CC] uppercase tracking-wider">This Week</span>
              </div>
              {summary.suggestions.map(item => {
                const note = summary.flagged.find(f => f.subId === item.subId)?.note ?? '';
                const actionLabel = item.action === 'watch' ? 'Consider watching 👀' : `Consider ${item.action}ing`;
                return (
                  <button
                    key={item.subId}
                    className="w-full flex items-center py-3 border-t border-[#F2F2F7] first:border-t-0 text-left"
                    onClick={() => router.push(`/subscription/${item.subId}`)}
                  >
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-base font-bold text-[#1C1C1E]">{item.name}</span>
                      {!!note && <span className="text-sm text-[#8E8E93] leading-[18px]">{note}</span>}
                      <span className="text-sm text-[#3B82F6] font-semibold">{actionLabel}</span>
                    </div>
                    <IconChevronForward size={14} color="#C7C7CC" />
                  </button>
                );
              })}
            </>
          )}
          {summary.healthy.length > 0 && (
            <div className={summary.suggestions.length > 0 ? 'border-t border-[#F2F2F7] mt-0 pt-3' : ''}>
              <div className="flex items-center gap-1 mb-2">
                <IconCheckmarkCircleOutline size={12} color="#34C759" />
                <span className="text-[10px] font-black text-[#C7C7CC] uppercase tracking-wider">Looking Good</span>
              </div>
              {summary.healthy.map((name, i) => (
                <div key={i} className="flex items-center gap-1 py-0.5">
                  <span className="text-sm text-[#34C759] font-bold">✓</span>
                  <span className="flex-1 text-sm text-[#8E8E93] leading-5">{name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ---- Render states ----

  // Loading (not yet read localStorage)
  if (!mounted || !weekStatusLoaded) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center pb-20">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <Spinner size={40} />
      </div>
    );
  }

  // Empty
  if (activeSubs.length === 0) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center pb-20">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-[#3B82F615] flex items-center justify-center">
            <IconList size={40} color="#3B82F6" />
          </div>
          <h2 className="text-xl font-black text-[#1C1C1E]">Nothing to review yet</h2>
          <p className="text-sm text-[#8E8E93] leading-relaxed max-w-xs">
            Add your subscriptions in Manager first, then come back to check in.
          </p>
          <button
            className="flex items-center gap-2 px-6 py-3 bg-[#3B82F6] text-white rounded-2xl font-bold text-sm"
            onClick={() => router.push('/dashboard')}
          >
            <IconAddCircle size={18} color="white" />
            Go to Manager
          </button>
        </div>
      </div>
    );
  }

  // Already done this week
  if (isAlreadyDoneThisWeek) {
    const nextSunday = new Date();
    const daysUntil = ((7 - nextSunday.getDay()) % 7) || 7;
    nextSunday.setDate(nextSunday.getDate() + daysUntil);
    const nextWeekStr = nextSunday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const handleResetWeek = () => {
      if (user?.id) {
        const weekKey = getWeekStartKey(user.reminder_day);
        lsRemove(`checkin_week_${user.id}`);
        void resetWeeklyCheckinComplete(user.id, weekKey);
        void removeUserAppState(user.id, getStateKey(`summary:${weekKey}`));
      }
      setCompletedWeekKey(null);
      setCurrentIndex(0);
      setSessionResults({});
      setSessionSummary(null);
    };

    return (
      <div className="min-h-screen bg-[#F9FAFB] pb-20">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div className="max-w-lg mx-auto px-4 py-10 flex flex-col items-center gap-4">
          <div className="w-18 h-18 rounded-full bg-[#3B82F6] flex items-center justify-center" style={{ width: 72, height: 72 }}>
            <IconCalendar size={40} color="white" />
          </div>
          <h2 className="text-xl font-black text-[#1C1C1E]">Week Complete</h2>
          <div className="flex items-center gap-1 bg-[#F2F2F7] px-3 py-1.5 rounded-full">
            <IconTime size={14} color="#C7C7CC" />
            <span className="text-xs font-black text-[#C7C7CC] tracking-wide">Next check-in on {nextWeekStr}</span>
          </div>
          {savedSummary && renderSummaryCards(savedSummary)}
        </div>
      </div>
    );
  }

  // Done screen
  if (isDone) {
    const handleDoneReset = () => {
      setCurrentIndex(0);
      setSessionResults({});
      setSessionSummary(null);
      setLoadingSummary(false);
    };

    if (loadingSummary) {
      return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center gap-4 pb-20">
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <Spinner size={40} />
          <span className="text-sm text-[#8E8E93]">Generating report...</span>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#F9FAFB] pb-20">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div className="max-w-lg mx-auto px-4 py-10 flex flex-col items-center gap-4">
          <div className="w-18 h-18 rounded-full bg-[#34C759] flex items-center justify-center" style={{ width: 72, height: 72 }}>
            <IconCheckmark size={40} color="white" />
          </div>
          <h2 className="text-xl font-black text-[#1C1C1E] text-center">Week {streak} Complete! 🎉</h2>
          {streak > 1 && (
            <div className="flex items-center gap-1 bg-[#FF9F0A18] px-3 py-1.5 rounded-full">
              <IconFlame size={13} color="#FF9F0A" />
              <span className="text-sm font-bold text-[#FF9F0A]">{streak} weeks in a row</span>
            </div>
          )}
          {sessionSummary
            ? renderSummaryCards(sessionSummary)
            : <p className="text-sm text-[#8E8E93] text-center leading-6">All subscriptions reviewed.{'\n'}See you next week!</p>
          }
          <button
            className="w-full h-[52px] bg-[#1C1C1E] text-white rounded-2xl font-bold text-base tracking-tight mt-2"
            onClick={handleDoneReset}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Main check-in UI
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col pb-20">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        {ignoredSubs.length > 0 ? (
          <button
            className="relative flex items-center gap-0.5 w-8"
            onClick={() => setShowArchive(true)}
          >
            <IconArchive size={22} color="#8E8E93" />
            <span className="absolute -top-1 -right-1 bg-[#3B82F6] text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {ignoredSubs.length}
            </span>
          </button>
        ) : (
          <div className="w-8" />
        )}
        <span className="text-sm font-black tracking-[0.15em] text-gray-900">CHECK-IN</span>
        <div className="w-8 h-8 flex items-center justify-end">
          <div className="px-2 py-0.5 bg-[#3B82F615] rounded-full flex items-center">
            <span className="text-xs font-black text-[#3B82F6] tracking-wide">
              {currentIndex + 1}/{activeSubs.length}
            </span>
          </div>
        </div>
      </header>

      {/* Card + Buttons — treated as one unit, centered in remaining space */}
      <div
        className="flex-1 max-w-lg mx-auto w-full flex flex-col items-center justify-center gap-6 pt-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
      >

        {/* Fixed-ratio inner container — cards always 3:4 regardless of screen height */}
        <div className="relative" style={{ width: 'min(85%, 340px)', aspectRatio: '3/4' }}>

        {/* Ghost cards */}
        {nextNextSub && (
          <div
            className="absolute inset-0 bg-white border border-[#F2F2F7] rounded-[28px] shadow-sm"
            style={{
              transform: 'scale(0.85) translateY(12px)',
              opacity: 0.4,
              zIndex: 1,
            }}
          />
        )}
        {nextSub && (
          <div
            className="absolute inset-0 bg-white border border-[#F2F2F7] rounded-[28px] shadow-sm overflow-hidden"
            style={{
              transform: 'scale(0.92) translateY(6px)',
              opacity: 0.7,
              zIndex: 2,
            }}
          >
            <div className="w-full h-24 bg-[#F9FAFB] rounded-tl-[28px] rounded-tr-[28px]" />
          </div>
        )}

        {/* Main draggable card */}
        <motion.div
          drag={cardMode === 'card' ? 'x' : false}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.7}
          onDragEnd={handleDragEnd}
          className="absolute inset-0 bg-white border border-[#F2F2F7] rounded-[28px] overflow-hidden cursor-grab active:cursor-grabbing"
          whileDrag={{ scale: 1.02 }}
          animate={{ x: 0, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          dragMomentum={false}
          onDrag={(_, info) => {
            x.set(info.offset.x);
            y.set(info.offset.y);
          }}
          style={{
            x, y, rotate,
            zIndex: 10,
            boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          }}
        >

          {cardMode === 'card' && currentSub && signalInfo && (
            <>
              {/* Accent band */}
              <div
                className="absolute top-0 left-0 right-0 h-24 rounded-t-[28px]"
                style={{ backgroundColor: currentSub.color + '22' }}
              />

              {/* Swipe indicators */}
              <motion.div
                className="absolute top-12 left-4 px-3 py-1.5 border-[3px] border-[#34C759] rounded-lg bg-white/90 z-50"
                style={{ opacity: rightOpacity, rotate: -15 }}
              >
                <span className="text-base font-black text-[#34C759] uppercase tracking-wide">♥ LOVE IT</span>
              </motion.div>
              <motion.div
                className="absolute top-12 right-4 px-3 py-1.5 border-[3px] border-[#FF3B30] rounded-lg bg-white/90 z-50"
                style={{ opacity: leftOpacity, rotate: 15 }}
              >
                <span className="text-base font-black text-[#FF3B30] uppercase tracking-wide">✕ REVIEW</span>
              </motion.div>
              <motion.div
                className="absolute bottom-16 left-1/2 -translate-x-1/2 px-3 py-1.5 border-[3px] border-[#3B82F6] rounded-lg bg-white/90 z-50"
                style={{ opacity: downOpacity }}
              >
                <span className="text-base font-black text-[#3B82F6] uppercase tracking-wide">? UNSURE</span>
              </motion.div>

              {/* Avatar */}
              <motion.div
                className="absolute top-6 left-0 right-0 flex justify-center z-40"
                style={{ scale: avatarScale, y: avatarY }}
              >
                <div
                  className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center shadow-lg"
                  style={{ border: `3px solid ${currentSub.color}` }}
                >
                  <span className="text-4xl leading-none">
                    {getSubIcon(currentSub)}
                  </span>
                </div>
              </motion.div>

              {/* Card content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-28 px-6 pb-4">
                <span className="text-3xl font-black text-[#1C1C1E] text-center tracking-tight mb-1 leading-tight">
                  {currentSub.name}
                </span>
                <span className="text-xs font-black text-[#C7C7CC] uppercase tracking-wider mb-4">
                  {getSubPlanName(currentSub).toUpperCase()}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-[#1C1C1E] tracking-tight">${currentSub.cost}</span>
                  <span className="text-sm font-bold text-[#8E8E93]">/{getSubBillingCycle(currentSub)}</span>
                </div>
                {currentAuditSignal && (
                  <div className="mt-4 px-3 py-2 rounded-xl bg-[#F9FAFB] border border-[#F2F2F7]">
                    <p className="text-[10px] font-black text-[#3B82F6] uppercase tracking-[1.5px] text-center">Audit Memory</p>
                    <p className="text-xs font-bold text-[#8E8E93] text-center mt-0.5">
                      Score {currentAuditSignal.overall_score} · {currentAuditSignal.recommendation_type}
                    </p>
                  </div>
                )}
              </div>

              {/* Signal badge */}
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
                <span className="text-[10px] font-black text-[#C7C7CC] uppercase tracking-widest">LAST SIGNAL</span>
                <div className="inline-flex mt-1 px-3 py-1 rounded-full" style={{ backgroundColor: signalInfo.bg }}>
                  <span className="text-xs font-bold tracking-wide" style={{ color: signalInfo.color }}>
                    {signalInfo.label}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Ignore mode */}
          {cardMode === 'ignore' && currentSub && (
            <div className="flex flex-col h-full p-5">
              <div className="flex items-center justify-between mb-3">
                <button
                  className="w-10 h-10 rounded-full bg-[#F9FAFB] flex items-center justify-center"
                  onClick={() => setCardMode('card')}
                >
                  <IconArrowBack size={18} color="#1C1C1E" />
                </button>
                <div className="flex-1" />
                <div className="w-10" />
              </div>
              <div className="flex flex-col items-center flex-1">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#34C75920' }}>
                  <IconHeart size={32} color="#34C759" />
                </div>
                <h3 className="text-xl font-black text-[#1C1C1E] text-center mb-1 leading-tight">
                  You&apos;ve loved this<br />for weeks!
                </h3>
                <p className="text-xs font-black text-[#C7C7CC] uppercase tracking-wide text-center mb-4">
                  {currentSub.name}
                </p>
                <div className="w-full flex flex-col gap-2">
                  {IGNORE_DURATIONS.map(opt => (
                    <button
                      key={opt.label}
                      className="w-full flex items-center justify-between px-5 py-3 bg-[#F9FAFB] rounded-2xl border border-[#F2F2F7] disabled:opacity-50"
                      disabled={isSubmitting}
                      onClick={() => void handleIgnoreSelect(opt.days, opt.label)}
                    >
                      <span className="text-sm font-bold text-[#1C1C1E]">Skip for {opt.label}</span>
                      <IconArrowForward size={18} color="#3B82F6" />
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between w-full mt-3">
                  <button
                    className="px-4 py-2 text-sm font-semibold text-[#8E8E93]"
                    onClick={handleKeepAsking}
                  >
                    Keep asking me
                  </button>
                  <button
                    className="px-4 py-2 text-sm font-semibold text-[#C7C7CC] disabled:opacity-50"
                    disabled={isSubmitting}
                    onClick={handleSkipIgnore}
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Question mode */}
          {cardMode === 'question' && (
            <div className="flex flex-col h-full p-5">
              {(loadingReviewQ || loadingLoveQ || loadingUnsureQ) ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-3">
                  <Spinner
                    color={questionFlow === 'love' ? '#34C759' : questionFlow === 'review' ? '#FF3B30' : '#3B82F6'}
                    size={32}
                  />
                  <span className="text-sm text-[#8E8E93]">Generating questions...</span>
                </div>
              ) : qContent ? (
                <>
                  {/* Question header */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      className="w-10 h-10 rounded-full bg-[#F9FAFB] flex items-center justify-center"
                      onClick={() => {
                        if (diveMode === 'input') { setDiveMode('prompt'); }
                        else if (diveMode === 'prompt') { setDiveMode(null); setQ2AnswerPending(null); }
                        else if (questionStep > 0) { setQuestionStep(0); setQ1Answer(null); }
                        else { setCardMode('card'); setQuestionFlow(null); }
                      }}
                    >
                      <IconArrowBack size={18} color="#1C1C1E" />
                    </button>
                    <div className="flex items-center gap-1">
                      <div className={`h-1.5 rounded-full transition-all ${questionStep === 0 ? 'w-4 bg-[#3B82F6]' : 'w-1.5 bg-[#E5E5EA]'}`} />
                      {questionFlow !== 'love' && (
                        <div className={`h-1.5 rounded-full transition-all ${questionStep === 1 ? 'w-4 bg-[#3B82F6]' : 'w-1.5 bg-[#E5E5EA]'}`} />
                      )}
                    </div>
                    <div className="w-10" />
                  </div>

                  {/* Question content */}
                  <div className="flex flex-col items-center flex-1">
                    {diveMode === 'prompt' ? (
                      <>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#34C75920' }}>
                          <IconCheckCircle size={32} color="#34C759" />
                        </div>
                        <h3 className="text-xl font-black text-[#1C1C1E] text-center mb-1">Got it!</h3>
                        <p className="text-xs font-black text-[#C7C7CC] uppercase tracking-wide text-center mb-4">
                          Anything specific you&apos;d like to add?
                        </p>
                        <div className="w-full flex flex-col gap-2 mt-1">
                          <button
                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#3B82F6] rounded-2xl disabled:opacity-50"
                            disabled={isSubmitting}
                            onClick={handleNextSub}
                          >
                            <span className="text-sm font-bold text-white">Next subscription</span>
                            <IconArrowForward size={16} color="white" />
                          </button>
                          <button
                            className="w-full py-3 text-center text-sm font-semibold text-[#8E8E93] border border-[#E5E5EA] rounded-2xl disabled:opacity-50"
                            disabled={isSubmitting}
                            onClick={handleDiveDeeperOpen}
                          >
                            Tell me more...
                          </button>
                        </div>
                      </>
                    ) : diveMode === 'input' ? (
                      <>
                        <textarea
                          className="w-full min-h-[100px] border border-[#E5E5EA] rounded-xl p-3 text-base text-[#1C1C1E] bg-[#F9FAFB] resize-none focus:outline-none focus:border-[#3B82F6]"
                          placeholder="Anything specific? (optional)"
                          maxLength={500}
                          value={diveText}
                          onChange={e => setDiveText(e.target.value)}
                          autoFocus
                        />
                        <div className="self-end text-[10px] text-[#8E8E93] mt-1 mb-3">{diveText.length} / 500</div>
                        <div className="w-full flex gap-2">
                          <button
                            className="flex-1 py-3 bg-[#3B82F6] rounded-2xl flex items-center justify-center disabled:opacity-50"
                            disabled={isSubmitting}
                            onClick={handleDiveSubmit}
                          >
                            {isSubmitting
                              ? <Spinner color="white" size={18} />
                              : <span className="text-sm font-bold text-white">Submit</span>
                            }
                          </button>
                          <button
                            className="px-5 py-3 border border-[#E5E5EA] rounded-2xl text-sm font-semibold text-[#8E8E93] disabled:opacity-50"
                            disabled={isSubmitting}
                            onClick={handleNextSub}
                          >
                            Skip
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: qContent.bgColor }}>
                          {getQIcon(qContent.icon, 32, qContent.iconColor)}
                        </div>
                        <h3 className="text-xl font-black text-[#1C1C1E] text-center mb-1 leading-snug px-2">
                          {qContent.title}
                        </h3>
                        <p className="text-xs font-black text-[#C7C7CC] uppercase tracking-wide text-center mb-3 px-4">
                          {qContent.subtitle}
                        </p>
                        {questionNotice && (
                          <p className="text-[11px] font-semibold text-[#8E8E93] text-center mb-2 px-4">
                            {questionNotice}
                          </p>
                        )}
                        <div className="w-full flex flex-col gap-2">
                          {qContent.options.map((opt, optIdx) => (
                            <button
                              key={`${opt.key}_${optIdx}`}
                              className="w-full flex items-center justify-between px-5 py-3 bg-[#F9FAFB] rounded-2xl border border-[#F2F2F7] disabled:opacity-50"
                              disabled={isSubmitting}
                              onClick={() => {
                                if (questionStep === 0) void handleQ1Select(opt.key);
                                else handleQ2Select(opt.key);
                              }}
                            >
                              <span className="text-sm font-bold text-[#1C1C1E]">{opt.label}</span>
                              <IconArrowForward size={18} color="#3B82F6" />
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </motion.div>
        </div>{/* end fixed-ratio inner container */}

        {/* Footer Controls — fixed distance below card */}
        <div className="w-full px-8">
        <div className="flex items-end justify-between">
          {/* Review */}
          <button
            className="flex flex-col items-center gap-2"
            onClick={() => enterQuestionMode('review')}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg border"
              style={{ backgroundColor: '#FF3B3010', borderColor: '#FF3B3030' }}
            >
              <IconClose size={32} color="#FF3B30" />
            </div>
            <span className="text-[10px] font-black text-[#C7C7CC] uppercase tracking-widest">Review</span>
          </button>

          {/* Maybe */}
          <button
            className="flex flex-col items-center gap-2 mb-2"
            onClick={() => enterQuestionMode('unsure')}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-md border border-[#F2F2F7] bg-white"
            >
              <IconArrowDown size={20} color="#8E8E93" />
            </div>
            <span className="text-[10px] font-black text-[#C7C7CC] uppercase tracking-widest">Maybe</span>
          </button>

          {/* Keep It */}
          <button
            className="flex flex-col items-center gap-2"
            onClick={() => enterQuestionMode('love')}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: '#3B82F6', boxShadow: '0 8px 24px #3B82F640' }}
            >
              <IconHeart size={32} color="white" />
            </div>
            <span className="text-[10px] font-black text-[#C7C7CC] uppercase tracking-widest">Keep It</span>
          </button>
        </div>
        </div>{/* end footer controls */}
      </div>{/* end card+buttons container */}

      {showTutorial && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center px-5" onClick={dismissTutorial}>
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-[10px] font-black tracking-widest text-[#3B82F6] mb-1">5 SECOND TOUR</p>
            <h2 className="text-2xl font-black text-[#1C1C1E] mb-2">Swipe your subscriptions</h2>
            <p className="text-sm text-[#8E8E93] leading-5 mb-5">
              A quick check-in keeps your spending honest without turning it into homework.
            </p>
            <div className="space-y-2 mb-5">
              {[
                ['→', 'Love it', 'Worth keeping'],
                ['←', 'Review', 'Question the value'],
                ['↓', 'Unsure', 'Need more signal'],
              ].map(([arrow, title, body]) => (
                <div key={title} className="flex items-center gap-3 bg-[#F9FAFB] rounded-2xl border border-[#F2F2F7] p-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl font-black text-[#3B82F6]">{arrow}</div>
                  <div>
                    <p className="text-sm font-black text-[#1C1C1E]">{title}</p>
                    <p className="text-xs font-semibold text-[#8E8E93]">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={dismissTutorial} className="w-full h-12 rounded-2xl bg-[#3B82F6] text-white text-sm font-black">
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchive && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowArchive(false)}
        >
          <div
            className="bg-white rounded-t-[28px] w-full max-w-lg max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F2F2F7]">
              <span className="text-base font-black text-[#1C1C1E]">Ignored Subscriptions</span>
              <button onClick={() => setShowArchive(false)}>
                <IconClose size={22} color="#1C1C1E" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-2">
              {ignoredSubs.map(ig => {
                const daysLeft = ig.expiresAt
                  ? Math.max(0, Math.ceil((new Date(ig.expiresAt).getTime() - Date.now()) / 86400000))
                  : null;
                return (
                  <div key={ig.subId} className="flex items-center py-3 border-b border-[#F9FAFB] last:border-0">
                    <div
                      className="w-10 h-10 rounded-full bg-white flex items-center justify-center mr-3 shrink-0"
                      style={{ border: `2px solid ${ig.color}` }}
                    >
                      <span className="text-xl">{ig.iconEmoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1C1C1E] truncate">{ig.subName}</p>
                      <p className="text-xs text-[#8E8E93]">
                        {daysLeft === null ? 'Permanent' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
                      </p>
                    </div>
                    <button
                      className="ml-3 px-3 py-1.5 rounded-full border border-[#E5E5EA] text-xs font-bold text-[#3B82F6]"
                      onClick={() => handleResumeIgnore(ig.subId)}
                    >
                      Resume
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
