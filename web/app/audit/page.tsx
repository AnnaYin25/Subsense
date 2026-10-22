'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSubscriptions } from '@/lib/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase/client';
import { startAuditConversation, continueAuditConversation, runAdjuster } from '@/lib/utils/claude';
import type { AuditContext, ClaudeAuditResponse } from '@/lib/utils/claude';
import { computeScore, getDecisionResult, recommendationToStatus } from '@/lib/utils/auditScorer';
import { buildAuditPersona } from '@/lib/utils/personaGenerator';
import { generateAlternatives } from '@/lib/utils/alternativesGenerator';
import type { Alternative } from '@/lib/utils/alternativesGenerator';
import { getRecentCheckinResponses, type CheckinResponseRecord } from '@/lib/utils/database';
import type {
  ChatMessage,
  AuditReport,
  AuditStage,
  AuditSlots,
  AuditOption,
  AuditRecommendationType,
  AuditPersona,
  DecisionResult,
  AdjusterResult,
} from '@/lib/types';

// ---- Color tokens ----
const colors = {
  primary: '#3B82F6',
  success: '#34C759',
  warning: '#FF9F0A',
  danger: '#FF3B30',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',
  backgroundLight: '#F9FAFB',
  gray100: '#F2F2F7',
  gray200: '#E5E5EA',
  gray400: '#C7C7CC',
  successLight: '#E8F8ED',
  warningLight: '#FFF8EC',
};

// ---- FSM constants ----

type ViewMode = 'home' | 'chat' | 'finalizing' | 'report';

const STAGE_ORDER: AuditStage[] = [
  'service_id',
  'motivation',
  'history_check',
  'expected_usage',
  'overlap_check',
  'budget_feel',
  'risk',
];

const STAGE_LABELS: Record<AuditStage, string> = {
  service_id: 'Service',
  motivation: 'Motivation',
  history_check: 'History',
  expected_usage: 'Usage',
  overlap_check: 'Overlap',
  budget_feel: 'Budget',
  risk: 'Risk',
};

const USAGE_SLIDER_STOPS = [
  { value: 0, label: 'Rarely', frequency: 'rarely' },
  { value: 1, label: 'Weekly', frequency: 'weekly' },
  { value: 2.5, label: '2-3x/wk', frequency: 'few_times' },
  { value: 4.5, label: 'Most days', frequency: 'most_days' },
  { value: 7, label: 'Daily', frequency: 'daily' },
] as const;

function getNearestUsageStop(value: number) {
  return USAGE_SLIDER_STOPS.reduce((best, stop) =>
    Math.abs(stop.value - value) < Math.abs(best.value - value) ? stop : best
  );
}

const REQUIRED_SLOTS_PER_STAGE: Record<AuditStage, (keyof AuditSlots)[]> = {
  service_id: ['service_name', 'price', 'billing_cycle', 'price_monthly'],
  motivation: ['primary_motivation', 'motivation_clarity', 'motivation_text'],
  history_check: ['history_status'],
  expected_usage: ['expected_frequency'],
  overlap_check: ['overlap_level'],
  budget_feel: ['budget_feel'],
  risk: ['top_risk'],
};

const AHA_COOLDOWN_TURNS = 3;

type RecoveryEntry = {
  question: string;
  options?: AuditOption[];
  inputMode: 'options' | 'text';
};

type PersistedAssessmentRow = {
  id: string;
  user_id: string;
  service_name: string;
  service_cost: number | string;
  service_category: AuditReport['category'];
  overall_score: number;
  ai_recommendation: string;
  conversation_transcript?: ChatMessage[];
  dimension_scores?: Partial<AuditReport> & {
    billing_cycle?: AuditReport['billing_cycle'];
    status?: AuditReport['status'];
    recommendation_type?: AuditRecommendationType;
  };
  created_at: string;
};

const RECOVERY_QUESTIONS: Record<string, RecoveryEntry> = {
  service_name: {
    question: "What's the name of the service you're considering?",
    inputMode: 'text',
  },
  price: {
    question: "What's the cost? (e.g. '15/month', '120/year')",
    inputMode: 'text',
  },
  price_monthly: {
    question: "What's the monthly cost?",
    inputMode: 'text',
  },
  billing_cycle: {
    question: "Just to confirm — is that per month or per year?",
    options: [
      { id: 'monthly', label: 'Per month', value: 'monthly' },
      { id: 'yearly',  label: 'Per year',  value: 'yearly' },
    ],
    inputMode: 'options',
  },
  price_cycle_unclear: {
    question: "Just to confirm — is that per month or per year?",
    options: [
      { id: 'monthly', label: 'Per month', value: 'monthly' },
      { id: 'yearly',  label: 'Per year',  value: 'yearly' },
    ],
    inputMode: 'options',
  },
  primary_motivation: {
    question: "What's making you think about getting this?",
    inputMode: 'text',
  },
  motivation_clarity: {
    question: "Can you give me a quick example of when you'd actually use it?",
    inputMode: 'text',
  },
  motivation_text: {
    question: "What's the main reason you want it?",
    inputMode: 'text',
  },
  history_status: {
    question: "Have you used this service before?",
    options: [
      { id: 'new',      label: 'Never tried it',                                value: 'first_time' },
      { id: 'familiar', label: "Haven't tried it, but I've seen/heard about it", value: 'familiar' },
      { id: 'cancel',   label: 'Tried it, cancelled',                           value: 'cancelled' },
      { id: 'upgrade',  label: 'Currently using, want to upgrade',              value: 'upgrading' },
      { id: 'trial',    label: 'Used a free trial',                             value: 'free_trial' },
    ],
    inputMode: 'options',
  },
  expected_frequency: {
    question: "How often would you realistically use it?",
    options: [
      { id: 'daily',  label: 'Daily or almost daily', value: 'daily' },
      { id: 'few',    label: 'A few times a week',    value: 'few_times' },
      { id: 'weekly', label: 'About once a week',     value: 'weekly' },
      { id: 'less',   label: 'Less than weekly',      value: 'monthly' },
      { id: 'ns',     label: 'Not sure',              value: 'not_sure' },
    ],
    inputMode: 'options',
  },
  overlap_level: {
    question: "How much does it overlap with your current subscriptions?",
    options: [
      { id: 'diff',   label: 'Mostly different — they cover different things', value: 'none' },
      { id: 'some',   label: "Some overlap — but I'd use both differently",    value: 'some' },
      { id: 'sig',    label: 'Pretty similar — lots of overlap',               value: 'significant' },
      { id: 'unsure', label: 'Honestly not sure',                              value: 'not_sure' },
    ],
    inputMode: 'options',
  },
  budget_feel: {
    question: "How does the price feel relative to your budget?",
    options: [
      { id: 'ok',    label: 'Feels fine',                          value: 'comfortable' },
      { id: 'tight', label: "A stretch — but I'd make it work",    value: 'tight' },
      { id: 'steep', label: "Pretty steep — I'd have to justify it", value: 'steep' },
      { id: 'noway', label: "Honestly can't justify it",           value: 'no_way' },
      { id: 'ns',    label: 'Not sure',                            value: 'not_sure' },
    ],
    inputMode: 'options',
  },
  top_risk: {
    question: "What's your biggest concern about subscribing?",
    options: [
      { id: 'none',  label: 'No real concerns',  value: 'none' },
      { id: 'ns',    label: 'Not sure',           value: 'not_sure' },
      { id: 'other', label: 'Something else...',  value: 'other' },
    ],
    inputMode: 'options',
  },
};

// ---- Price normalization ----

function normalizePriceToMonthly(rawPrice: number, cycle: 'monthly' | 'yearly'): number {
  switch (cycle) {
    case 'yearly':  return Math.round((rawPrice / 12) * 100) / 100;
    case 'monthly':
    default:        return rawPrice;
  }
}

// ---- Helper: next ISO date 30 days from now ----
function nextMonthISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

// ---- Helpers ----

function detectCategory(motivation?: string): AuditReport['category'] {
  if (!motivation) return 'Productivity';
  const m = motivation.toLowerCase();
  if (m.includes('entert') || m.includes('movie') || m.includes('music') || m.includes('game')) return 'Entertainment';
  if (m.includes('health') || m.includes('fitness') || m.includes('workout')) return 'Health';
  if (m.includes('work') || m.includes('productivity') || m.includes('tool') || m.includes('learn')) return 'Productivity';
  return 'Utilities';
}

function buildRecommendationText(decision: DecisionResult, uncertainty: 'low' | 'medium' | 'high'): string {
  if (decision.delay_triggered && decision.timing_suggestion) {
    return decision.timing_suggestion;
  }
  const map: Record<AuditRecommendationType, string> = {
    subscribe: "This looks like a solid fit. Go ahead and subscribe!",
    trial: uncertainty === 'high'
      ? "There's some uncertainty here. Start with a free trial and set a reminder to cancel."
      : "Looks promising, but start with a trial to confirm it fits your routine.",
    watchlist: "Not quite ready. Save it and re-evaluate when you have a clearer use case.",
    alternative: "There may be cheaper or free options that serve the same need.",
  };
  return map[decision.primary_decision];
}

function buildFactors(
  slots: AuditSlots,
  scoreResult: ReturnType<typeof computeScore>,
  adjuster?: AdjusterResult,
): AuditReport['factors'] {
  const factors: AuditReport['factors'] = [];

  if (slots.expected_frequency && slots.expected_frequency !== 'not_sure') {
    const highFreq = ['daily', 'most_days', 'few_times'];
    const isHigh = highFreq.includes(slots.expected_frequency);
    factors.push({
      title: 'Expected Usage',
      description: isHigh ? 'High usage frequency — good value per use.' : 'Lower usage frequency increases risk of waste.',
      type: isHigh ? 'pass' : 'risk',
    });
  }

  if (slots.budget_feel && slots.budget_feel !== 'not_sure') {
    const desc: Record<string, string> = {
      comfortable: 'Price feels comfortable within your budget.',
      tight: 'This will stretch your budget a bit.',
      steep: 'Price feels steep — hard to justify the value.',
      no_way: 'Price feels too high for your current budget.',
    };
    factors.push({
      title: 'Budget Comfort',
      description: desc[slots.budget_feel] ?? '',
      type: slots.budget_feel === 'comfortable' || slots.budget_feel === 'tight' ? 'pass' : 'risk',
    });
  }

  if (slots.overlap_level && slots.overlap_level !== 'not_sure') {
    const isRisk = slots.overlap_level === 'significant' || slots.overlap_level === 'high';
    factors.push({
      title: 'Overlap with Existing Subs',
      description: isRisk ? 'High overlap with what you already pay for.' : 'Low overlap — this adds unique value.',
      type: isRisk ? 'risk' : 'pass',
    });
  }

  if (slots.top_risk && slots.top_risk !== 'not_sure' && slots.top_risk !== 'none') {
    const riskLabels: Record<string, string> = {
      forget_cancel: "Risk: Auto-renewing subscriptions are easy to forget.",
      interest_decay: "Risk: Interest may fade over time.",
      impulse: "Risk: This may be an impulse decision.",
      free_enough: "Risk: A free version might cover your needs.",
      timeline_limited: "Timing: This may not fit your current schedule.",
      mandatory_use: "This is required — lower cancellation risk.",
      other: slots.additional_risk_note ? `Concern: ${slots.additional_risk_note}` : "Some concerns identified.",
    };
    const label = riskLabels[slots.top_risk];
    if (label) {
      factors.push({
        title: 'Identified Risk',
        description: label,
        type: slots.top_risk === 'mandatory_use' ? 'pass' : 'risk',
      });
    }
  }

  if (slots.history_status === 'cancelled' && slots.cancel_reason === 'low_usage') {
    factors.push({
      title: 'Previous Cancellation',
      description: "You've cancelled this before due to low usage — same pattern may repeat.",
      type: 'risk',
    });
  }

  if (slots.forcing_function) {
    factors.push({
      title: 'External Requirement',
      description: `This is required for ${slots.forcing_function} purposes — strong need signal.`,
      type: 'pass',
    });
  }

  if (scoreResult.uncertainty_level !== 'low') {
    factors.push({
      title: 'Uncertainty',
      description: 'Some answers were unclear or skipped — recommendation is conservative.',
      type: 'risk',
    });
  }

  if (adjuster && adjuster.narrative_insight) {
    factors.push({
      title: 'AI Insight',
      description: adjuster.narrative_insight,
      type: adjuster.total_delta >= 0 ? 'pass' : 'risk',
    });
  }

  return factors;
}

function getCTAConfig(type: AuditRecommendationType | 'delay'): { label: string; color: string } {
  switch (type) {
    case 'subscribe':   return { label: 'Track This Subscription', color: colors.primary };
    case 'trial':       return { label: 'Start Trial + Set Reminder', color: colors.warning };
    case 'delay':       return { label: 'Set Reminder to Revisit', color: colors.warning };
    case 'watchlist':   return { label: 'Save to Watchlist', color: colors.primary };
    case 'alternative': return { label: 'See 3 Alternatives', color: colors.danger };
    default:            return { label: 'Save to Watchlist', color: colors.primary };
  }
}

// ---- SVG Icons ----

const SparklesIcon = ({ size = 14, color = 'white' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill={color} />
    <path d="M19 15L19.75 18.25L23 19L19.75 19.75L19 23L18.25 19.75L15 19L18.25 18.25L19 15Z" fill={color} />
    <path d="M5 3L5.5 5.5L8 6L5.5 6.5L5 9L4.5 6.5L2 6L4.5 5.5L5 3Z" fill={color} />
  </svg>
);

const ChatBubbleIcon = ({ size = 36, color = 'white' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
    <path d="M448 64H64C28.7 64 0 92.7 0 128v192c0 35.3 28.7 64 64 64h96l48 64 48-64h192c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64z" fill={color} />
    <circle cx="160" cy="224" r="28" fill="rgba(0,0,0,0.3)" />
    <circle cx="256" cy="224" r="28" fill="rgba(0,0,0,0.3)" />
    <circle cx="352" cy="224" r="28" fill="rgba(0,0,0,0.3)" />
  </svg>
);

const CloseIcon = ({ size = 22, color = '#1C1C1E' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const SendIcon = ({ size = 18, color = 'white' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronForwardIcon = ({ size = 18, color = '#C7C7CC' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SearchOutlineIcon = ({ size = 48, color = '#E5E5EA' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
    <circle cx="218" cy="218" r="170" stroke={color} strokeWidth="44" />
    <line x1="340" y1="340" x2="464" y2="464" stroke={color} strokeWidth="44" strokeLinecap="round" />
  </svg>
);

const WarningOutlineIcon = ({ size = 18, color = '#FF9F0A' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
    <path d="M256 48L32 464h448L256 48z" stroke={color} strokeWidth="40" strokeLinejoin="round" />
    <line x1="256" y1="208" x2="256" y2="304" stroke={color} strokeWidth="44" strokeLinecap="round" />
    <circle cx="256" cy="368" r="24" fill={color} />
  </svg>
);

const CheckmarkCircleOutlineIcon = ({ size = 18, color = '#34C759' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
    <circle cx="256" cy="256" r="224" stroke={color} strokeWidth="40" />
    <polyline points="160,256 224,320 352,192" stroke={color} strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const InfoCircleOutlineIcon = ({ size = 14, color = '#FF9F0A' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <line x1="12" y1="8" x2="12" y2="8" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="12" y1="12" x2="12" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ArrowForwardIcon = ({ size = 16, color = 'white' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 12h14M12 5l7 7-7 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ---- Main component ----

export default function AuditPage() {
  const router = useRouter();
  const { subscriptions, user, persona, addSubscription } = useSubscriptions();
  const scrollViewRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const finalCommentInputRef = useRef<HTMLInputElement>(null);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [selectedReport, setSelectedReport] = useState<AuditReport | null>(null);
  const [auditReports, setAuditReports] = useState<AuditReport[]>([]);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [options, setOptions] = useState<AuditOption[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uiMode, setUiMode] = useState<'options' | 'text' | 'slider'>('text');
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [usageSliderValue, setUsageSliderValue] = useState(2.5);

  // FSM state
  const [currentStage, setCurrentStage] = useState<AuditStage>('service_id');
  const [auditPersona, setAuditPersona] = useState<AuditPersona | null>(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [collectedSlots, setCollectedSlots] = useState<AuditSlots>({});
  const [recentCheckins, setRecentCheckins] = useState<CheckinResponseRecord[]>([]);

  // Aha / disclosure state
  const [lastAhaTurn, setLastAhaTurn] = useState(-AHA_COOLDOWN_TURNS);
  const [notSureCount, setNotSureCount] = useState(0);
  const [lastFlags, setLastFlags] = useState<ClaudeAuditResponse['flags']>({
    contradiction: false,
    off_topic: false,
    price_cycle_unclear: false,
  });
  const [ahaTriggered, setAhaTriggered] = useState(false);

  // Raw conversation history
  const rawConvoRef = useRef<ChatMessage[]>([]);

  // "Anything to add?" gate before score
  const [awaitingFinalComment, setAwaitingFinalComment] = useState(false);
  const [finalCommentText, setFinalCommentText] = useState('');
  const pendingFinishSlotsRef = useRef<AuditSlots | null>(null);

  // Alternatives modal
  const [showAlternativesModal, setShowAlternativesModal] = useState(false);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  // ---- Load persisted audit reports from Supabase ----

  const loadAuditReports = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data) return;
    const loaded: AuditReport[] = (data as PersistedAssessmentRow[]).map((row) => {
      const extra = row.dimension_scores ?? {};
      return {
        id: row.id,
        user_id: row.user_id,
        service_name: row.service_name,
        cost: `$${Number(row.service_cost).toFixed(2)}/mo`,
        billing_cycle: extra.billing_cycle ?? 'monthly',
        category: row.service_category,
        score: row.overall_score,
        status: extra.status ?? 'Fair',
        recommendation: row.ai_recommendation,
        recommendation_type: extra.recommendation_type ?? 'watchlist',
        factors: extra.factors ?? [],
        slots: extra.slots ?? {},
        uncertainty_level: extra.uncertainty_level ?? 'medium',
        conversation_history: row.conversation_transcript ?? [],
        decision: extra.decision,
        adjuster: extra.adjuster,
        created_at: row.created_at,
      } as AuditReport;
    });
    setAuditReports(loaded);
  }, [user?.id]);

  useEffect(() => {
    loadAuditReports();
  }, [loadAuditReports]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getRecentCheckinResponses(user.id, 3).then(records => {
      if (!cancelled) setRecentCheckins(records);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Hide/show BottomNav — mirrors app's tabBarStyle: { display: 'none' } when not on home
  useEffect(() => {
    if (viewMode === 'home') {
      window.dispatchEvent(new Event('show-bottom-nav'));
    } else {
      window.dispatchEvent(new Event('hide-bottom-nav'));
    }
    return () => { window.dispatchEvent(new Event('show-bottom-nav')); };
  }, [viewMode]);

  // iOS keyboard: only change container height to visualViewport.height
  // No transform, no dynamic top/bottom, just height. Minimal DOM = no flicker.
  useEffect(() => {
    if (viewMode !== 'chat') return;

    const vv = window.visualViewport;
    if (!vv) return;
    const container = document.getElementById('chat-container');
    if (!container) return;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';

    const onResize = () => {
      container.style.height = `${vv.height}px`;
      window.scrollTo(0, 0);
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    onResize();

    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
      container.style.height = '';
      document.body.style.overflow = '';
      document.documentElement.style.height = '';
      document.documentElement.style.overflow = '';
    };
  }, [viewMode]);

  const focusInputWithoutScroll = useCallback((
    event: React.PointerEvent<HTMLInputElement>,
    inputRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    if (document.activeElement === event.currentTarget) return;

    event.preventDefault();

    const vv = window.visualViewport;
    const container = document.getElementById('chat-container');
    if (vv && container) {
      container.style.height = `${vv.height}px`;
    }

    window.scrollTo(0, 0);
    inputRef.current?.focus({ preventScroll: true });
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (viewMode === 'chat' && scrollViewRef.current) {
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTop = scrollViewRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [messages, isTyping, options, viewMode]);


  // ---- FSM helpers ----

  function advanceStageIfReady(stage: AuditStage, slots: AuditSlots): AuditStage {
    const required = REQUIRED_SLOTS_PER_STAGE[stage];
    const allFilled = required.every(k => slots[k] !== undefined);
    if (!allFilled) return stage;
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx >= STAGE_ORDER.length - 1) return stage;

    let nextStage = STAGE_ORDER[idx + 1];

    if (nextStage === 'overlap_check') {
      const hasSameCat = auditPersona && auditPersona.same_cat_subs && auditPersona.same_cat_subs.length > 0;
      if (!hasSameCat || slots.overlap_level !== undefined) {
        const overlapIdx = STAGE_ORDER.indexOf('overlap_check');
        nextStage = STAGE_ORDER[overlapIdx + 1];
      }
    }

    return nextStage;
  }

  function canFinish(turn: number, stage: AuditStage): boolean {
    return turn >= 5 && stage === 'risk';
  }

  function summarizeCheckinsForAudit(serviceCategory?: string): Pick<AuditPersona, 'checkin_sat' | 'usage_trend'> {
    if (recentCheckins.length === 0) return {};
    const activeSubIds = new Set(
      subscriptions
        .filter(sub => {
          if (sub.status !== 'active') return false;
          return !serviceCategory || sub.category.toLowerCase() === serviceCategory.toLowerCase();
        })
        .map(sub => sub.id)
    );
    const relevant = recentCheckins.filter(record => activeSubIds.has(record.subscription_id));
    if (relevant.length === 0) return {};

    const counts = relevant.reduce((acc, record) => {
      acc[record.swipe_direction] += 1;
      return acc;
    }, { left: 0, right: 0, down: 0 });

    const latest = relevant.slice(-5);
    const leftOrDown = counts.left + counts.down;
    const usageTrend = latest.length >= 3 && latest.filter(r => r.swipe_direction === 'left').length >= 2
      ? 'recent check-ins lean toward review'
      : latest.length >= 3 && latest.filter(r => r.swipe_direction === 'right').length >= 2
        ? 'recent check-ins lean positive'
        : 'recent check-ins are mixed';

    return {
      checkin_sat: `${counts.right} love, ${leftOrDown} review/unsure signals in recent check-ins`,
      usage_trend: usageTrend,
    };
  }

  // ---- Aha guard ----

  function shouldShowAha(response: ClaudeAuditResponse, turn: number, stage: AuditStage, slots: AuditSlots, budget: number): boolean {
    if (!response.aha.triggered || response.aha.bubbles.length === 0) return false;
    if (ahaTriggered) return false;
    if (turn - lastAhaTurn < AHA_COOLDOWN_TURNS) return false;
    if (['service_id', 'motivation'].includes(stage)) {
      const price = typeof slots.price_monthly === 'number' ? slots.price_monthly : 0;
      if (price / (budget || 1) < 0.15) return false;
    }
    return true;
  }

  // ---- Chip visibility ----
  const showChips = uiMode === 'options' && options.length > 0 && !isTyping && !awaitingFinalComment;
  const showUsageSlider = uiMode === 'slider' && !isTyping && !awaitingFinalComment;

  // ---- Build Claude context ----

  function getOrBuildPersona(serviceCategory?: string): AuditPersona {
    if (auditPersona) return auditPersona;
    const checkinSignals = summarizeCheckinsForAudit(serviceCategory);
    const prefs = persona?.setup_preferences;
    if (!prefs) {
      return {
        name: user?.name || 'there',
        monthly_budget: user?.monthly_budget || 0,
        persona_alignment: 1.0,
        subscriber_type: 'balanced_user',
        lifecycle_coeff: 1.0,
        same_cat_count: 0,
        same_cat_avg_usage: 0,
        existing_subs_count: subscriptions.filter(s => s.status === 'active').length,
        existing_subs: subscriptions.filter(s => s.status === 'active').map(s => s.name).join(', ') || 'None',
        same_cat_subs: '',
        interest_tags: [],
        ...checkinSignals,
      };
    }
    return {
      ...buildAuditPersona(
        user?.name || 'there',
        user?.monthly_budget || 0,
        prefs,
        subscriptions,
        serviceCategory || 'Productivity',
      ),
      ...checkinSignals,
    };
  }

  function buildContext(stage: AuditStage, turn: number, slots: AuditSlots): AuditContext {
    const p = getOrBuildPersona(
      slots.service_name ? detectCategory(slots.primary_motivation) : undefined,
    );
    return { stage, turn_index: turn, slots, persona: p };
  }

  // ---- Display bubbles with stagger ----

  async function displayBubbles(bubbles: string[], ahaAllowed: boolean, ahaBubbles: string[]) {
    if (ahaAllowed && ahaBubbles.length > 0) {
      await new Promise(r => setTimeout(r, 600));
      setMessages(prev => [...prev, { role: 'assistant', content: ahaBubbles[0] }]);
    }
    for (const bubble of bubbles) {
      await new Promise(r => setTimeout(r, 700));
      setMessages(prev => [...prev, { role: 'assistant', content: bubble }]);
    }
  }

  // ---- Handle Claude response (core FSM logic) ----

  const handleClaudeResponse = useCallback(async (
    response: ClaudeAuditResponse,
    slotsAtTime: AuditSlots,
    stageAtTime: AuditStage,
    turn: number,
  ) => {
    const budget = user?.monthly_budget || 0;

    try {
      setLastFlags(response.flags);

      if (response.flags.off_topic) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "I can only help with subscription decisions. What service are you thinking of subscribing to?",
        }]);
        setUiMode('text');
        return;
      }

      if (response.flags.price_cycle_unclear) {
        const newSlots = { ...slotsAtTime, ...response.slots_delta };
        setCollectedSlots(newSlots);
        const recovery = RECOVERY_QUESTIONS['price_cycle_unclear'];
        await new Promise(r => setTimeout(r, 600));
        setMessages(prev => [...prev, { role: 'assistant', content: recovery.question }]);
        setOptions(recovery.options!);
        setUiMode('options');
        setTurnIndex(turn + 1);
        return;
      }

      const delta = { ...response.slots_delta };
      const newSlots: AuditSlots = { ...slotsAtTime, ...delta };
      const claudeStage = response.stage || stageAtTime;

      const latestUserText = [...rawConvoRef.current].reverse().find(m => m.role === 'user')?.content?.trim();
      if (latestUserText) {
        if (claudeStage === 'motivation') {
          if (!newSlots.primary_motivation) newSlots.primary_motivation = latestUserText;
          if (!newSlots.motivation_text) newSlots.motivation_text = latestUserText;
        }
        if (claudeStage === 'service_id') {
          const priceMatch = latestUserText.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
          if (!newSlots.price && priceMatch) newSlots.price = Number(priceMatch[1]);
          if (!newSlots.billing_cycle && /\b(year|yr|annual|annually)\b/i.test(latestUserText)) {
            newSlots.billing_cycle = 'yearly';
          }
          if (!newSlots.billing_cycle && /\b(month|mo|monthly)\b/i.test(latestUserText)) {
            newSlots.billing_cycle = 'monthly';
          }
        }
      }
      if (newSlots.primary_motivation && !newSlots.motivation_text) {
        newSlots.motivation_text = String(newSlots.primary_motivation);
      }

      if (typeof newSlots.price === 'number' && newSlots.billing_cycle) {
        newSlots.price_monthly = normalizePriceToMonthly(newSlots.price, newSlots.billing_cycle);
      }
      setCollectedSlots(newSlots);

      if (newSlots.service_name && !auditPersona) {
        const category = detectCategory(newSlots.primary_motivation);
        const p = getOrBuildPersona(category);
        setAuditPersona(p);
      }

      const notSures = Object.values(delta).filter(v => v === 'not_sure').length;
      setNotSureCount(prev => prev + notSures);

      const ahaAllowed = shouldShowAha(response, turn, stageAtTime, newSlots, budget);
      if (ahaAllowed) {
        setLastAhaTurn(turn);
        setAhaTriggered(true);
      }

      await displayBubbles(response.bubbles, ahaAllowed, response.aha.bubbles);

      setCurrentStage(claudeStage);

      if (!response.question && response.options.length === 0) {
        const required = REQUIRED_SLOTS_PER_STAGE[claudeStage];
        const actuallyMissing = required ? required.filter(k => newSlots[k] === undefined) : [];
        if (actuallyMissing.length > 0) {
          const slot = actuallyMissing[0];
          const recovery = RECOVERY_QUESTIONS[slot];
          if (recovery) {
            await new Promise(r => setTimeout(r, 400));
            setMessages(prev => [...prev, { role: 'assistant', content: recovery.question }]);
            if (recovery.options) setOptions(recovery.options);
            setUiMode(recovery.inputMode);
            setTurnIndex(turn + 1);
            return;
          }
        }
      }

      if (response.is_finished || canFinish(turn + 1, claudeStage)) {
        pendingFinishSlotsRef.current = newSlots;
        await new Promise(r => setTimeout(r, 900));
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "That's all I need! Anything else you'd like me to factor in before I calculate your score?",
        }]);
        setAwaitingFinalComment(true);
      } else {
        if (response.question) {
          await new Promise(r => setTimeout(r, 400));
          setMessages(prev => [...prev, { role: 'assistant', content: response.question }]);
        }

        if (response.options && response.options.length > 0) {
          setOptions(response.options);
        } else {
          setOptions([]);
        }

        const responseMode = response.ui?.input_mode ?? (response.options?.length > 0 ? 'options' : 'text');
        setUiMode(responseMode);
      }

      setTurnIndex(turn + 1);
    } finally {
      setIsTyping(false);
    }
  }, [user, persona, subscriptions, lastAhaTurn, ahaTriggered, collectedSlots]);

  // ---- Generate report from final slots ----

  const generateAndShowReport = useCallback(async (slotsForReport: AuditSlots) => {
    setIsTyping(false);
    setViewMode('finalizing');

    const p = auditPersona ?? getOrBuildPersona(detectCategory(slotsForReport.primary_motivation));

    const ruleScore = computeScore(slotsForReport, p);

    let adjusterResult: AdjusterResult | undefined;
    try {
      adjusterResult = await runAdjuster(slotsForReport, p, ruleScore, messages);
    } catch {
      console.error('[AuditPage] Adjuster failed, using rule score only');
    }

    const adjusterDelta = adjusterResult?.total_delta ?? 0;
    const finalScore = Math.max(0, Math.min(100, Math.round((ruleScore.total + adjusterDelta) * 10) / 10));

    const decision = getDecisionResult(finalScore, slotsForReport);

    const serviceName = typeof slotsForReport.service_name === 'string' ? slotsForReport.service_name : 'Unknown Service';
    const costMonthly = slotsForReport.price_monthly ?? (typeof slotsForReport.price === 'number' ? slotsForReport.price : 0);
    const category = detectCategory(slotsForReport.primary_motivation);

    const report: AuditReport = {
      id: `audit-${Date.now()}`,
      user_id: user?.id || '',
      service_name: serviceName,
      cost: `$${costMonthly}/mo`,
      billing_cycle: slotsForReport.billing_cycle ?? 'monthly',
      category,
      score: finalScore,
      status: recommendationToStatus(decision.final_recommendation),
      recommendation: buildRecommendationText(decision, ruleScore.uncertainty_level),
      recommendation_type: decision.primary_decision,
      factors: buildFactors(slotsForReport, ruleScore, adjusterResult),
      slots: slotsForReport,
      uncertainty_level: ruleScore.uncertainty_level,
      conversation_history: messages,
      decision,
      adjuster: adjusterResult,
      created_at: new Date().toISOString(),
    };

    setAuditReports(prev => [report, ...prev]);
    setSelectedReport(report);
    setViewMode('report');

    if (user?.id) {
      supabase.from('assessments').insert({
        user_id: user.id,
        service_name: report.service_name,
        service_cost: costMonthly,
        service_category: report.category,
        conversation_transcript: report.conversation_history,
        overall_score: report.score,
        dimension_scores: {
          factors: report.factors,
          slots: report.slots,
          decision: report.decision,
          adjuster: report.adjuster,
          recommendation_type: report.recommendation_type,
          status: report.status,
          uncertainty_level: report.uncertainty_level,
          billing_cycle: report.billing_cycle,
        },
        ai_recommendation: report.recommendation,
        final_action: report.recommendation_type === 'subscribe' ? 'tracked'
          : report.recommendation_type === 'trial' ? 'trial'
          : 'skipped',
      }).then(({ error }) => {
        if (error) console.error('[AuditPage] Failed to save assessment:', error);
      });
    }
  }, [user, persona, subscriptions, messages, auditPersona]);

  // ---- "Anything to add?" gate handlers ----

  const handleSkipToScore = useCallback(() => {
    const slots = pendingFinishSlotsRef.current;
    if (!slots) return;
    setAwaitingFinalComment(false);
    generateAndShowReport(slots);
  }, [generateAndShowReport]);

  const handleSubmitFinalComment = useCallback(() => {
    const slots = pendingFinishSlotsRef.current;
    if (!slots || !finalCommentText.trim()) return;
    const enhanced: AuditSlots = { ...slots, additional_risk_note: finalCommentText.trim() };
    setMessages(prev => [...prev, { role: 'user', content: finalCommentText.trim() }]);
    setFinalCommentText('');
    setAwaitingFinalComment(false);
    generateAndShowReport(enhanced);
  }, [finalCommentText, generateAndShowReport]);

  // ---- Start audit ----

  const handleStartAudit = async () => {
    setViewMode('chat');
    setMessages([]);
    setOptions([]);
    setCollectedSlots({});
    setAiStatusMessage('');
    setCurrentStage('service_id');
    setAuditPersona(null);
    setTurnIndex(0);
    setNotSureCount(0);
    setLastFlags({ contradiction: false, off_topic: false, price_cycle_unclear: false });
    setLastAhaTurn(-AHA_COOLDOWN_TURNS);
    setAhaTriggered(false);
    setAwaitingFinalComment(false);
    setFinalCommentText('');
    pendingFinishSlotsRef.current = null;
    rawConvoRef.current = [];
    setIsTyping(true);
    setUiMode('text');
    setUsageSliderValue(2.5);

    try {
      const ctx = buildContext('service_id', 0, {});
      const { response, rawText, errorMessage } = await startAuditConversation(ctx);
      if (errorMessage) setAiStatusMessage(errorMessage);
      rawConvoRef.current = [
        { role: 'user', content: 'Start the audit. Ask me what service I am thinking of subscribing to.' },
        { role: 'assistant', content: rawText },
      ];
      await handleClaudeResponse(response, {}, 'service_id', 0);
    } catch (error) {
      console.error('[AuditPage] startAudit failed:', error);
      setIsTyping(false);
    }
  };

  // ---- Send message ----

  const handleSendMessage = async (displayText: string, apiText?: string) => {
    const display = String(displayText);
    const api = apiText ?? display;
    if (!display.trim() || isTyping) return;

    setMessages(prev => [...prev, { role: 'user', content: display }]);
    setInputValue('');
    setOptions([]);
    setAiStatusMessage('');
    setIsTyping(true);

    const updatedRawConvo: ChatMessage[] = [...rawConvoRef.current, { role: 'user', content: api }];
    rawConvoRef.current = updatedRawConvo;

    try {
      const ctx = buildContext(currentStage, turnIndex, collectedSlots);
      const { response, rawText, errorMessage } = await continueAuditConversation(updatedRawConvo, ctx);
      if (errorMessage) setAiStatusMessage(errorMessage);
      rawConvoRef.current = [...rawConvoRef.current, { role: 'assistant', content: rawText }];
      await handleClaudeResponse(response, collectedSlots, currentStage, turnIndex);
    } catch (error) {
      console.error('[AuditPage] sendMessage failed:', error);
      setIsTyping(false);
    }
  };

  // ---- Option chip tap ----

  const handleOptionTap = (option: AuditOption) => {
    if (String(option.value).toLowerCase().includes('not_sure') || option.id === 'ns') {
      setNotSureCount(prev => prev + 1);
    }
    handleSendMessage(option.label, String(option.value));
  };

  const handleUsageSliderSubmit = () => {
    const nearest = getNearestUsageStop(usageSliderValue);
    handleSendMessage(nearest.label, nearest.frequency);
  };

  // ---- Reset ----

  const handleReset = () => {
    setViewMode('home');
    setMessages([]);
    setOptions([]);
    setCollectedSlots({});
    setAiStatusMessage('');
    setCurrentStage('service_id');
    setAuditPersona(null);
    setTurnIndex(0);
    setNotSureCount(0);
    setLastFlags({ contradiction: false, off_topic: false, price_cycle_unclear: false });
    setLastAhaTurn(-AHA_COOLDOWN_TURNS);
    setAhaTriggered(false);
    setAwaitingFinalComment(false);
    setFinalCommentText('');
    setUsageSliderValue(2.5);
    pendingFinishSlotsRef.current = null;
    rawConvoRef.current = [];
    setSelectedReport(null);
    setShowAlternativesModal(false);
  };

  // ---- CTA actions ----

  const handlePrimaryCTA = async () => {
    if (!selectedReport) return;
    const finalRec = selectedReport.decision?.final_recommendation ?? selectedReport.recommendation_type;

    switch (finalRec) {
      case 'subscribe':
        router.push(
          `/subscription/new?name=${encodeURIComponent(selectedReport.service_name)}&cost=${parseFloat(selectedReport.cost.replace(/[^0-9.]/g, ''))}&category=${encodeURIComponent(selectedReport.category)}&billing=monthly`
        );
        break;

      case 'trial':
      case 'delay':
        try {
          await addSubscription({
            userId: user?.id || '',
            name: selectedReport.service_name,
            planName: finalRec === 'delay' ? 'Delayed' : 'Trial',
            cost: parseFloat(selectedReport.cost.replace(/[^0-9.]/g, '')),
            billingCycle: 'monthly',
            category: selectedReport.category,
            iconEmoji: finalRec === 'delay' ? '⏰' : '⏳',
            color: colors.warning,
            status: 'paused',
            isReminder: true,
            startDate: new Date().toISOString().split('T')[0],
            nextRenewalDate: nextMonthISO(),
            notes: finalRec === 'delay'
              ? `Delayed — ${selectedReport.decision?.timing_suggestion ?? 'revisit when timing is right.'}`
              : 'Added via Audit — remember to cancel if not using!',
          });
          window.alert(finalRec === 'delay' ? 'Reminder Set — Saved. We\'ll remind you to revisit.' : 'Reminder Set — Saved as a paused reminder.');
          handleReset();
        } catch {
          window.alert('Error: Could not save. Please try again.');
        }
        break;

      case 'watchlist':
        try {
          await addSubscription({
            userId: user?.id || '',
            name: selectedReport.service_name,
            planName: 'Watchlist',
            cost: parseFloat(selectedReport.cost.replace(/[^0-9.]/g, '')),
            billingCycle: 'monthly',
            category: selectedReport.category,
            iconEmoji: '👀',
            color: colors.primary,
            status: 'watchlist',
            isReminder: false,
            startDate: new Date().toISOString().split('T')[0],
            nextRenewalDate: nextMonthISO(),
            notes: selectedReport.decision?.timing_suggestion ?? 'On watchlist — re-evaluate before subscribing.',
          });
          window.alert('Added to Watchlist — Saved for later review.');
          handleReset();
        } catch {
          window.alert('Error: Could not save to watchlist.');
        }
        break;

      case 'alternative':
        setLoadingAlternatives(true);
        setShowAlternativesModal(true);
        const alts = await generateAlternatives(
          selectedReport.service_name,
          selectedReport.category,
          parseFloat(selectedReport.cost.replace(/[^0-9.]/g, ''))
        );
        setAlternatives(alts);
        setLoadingAlternatives(false);
        break;
    }
  };

  // ---- Render: Finalizing ----

  if (viewMode === 'finalizing') {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center gap-6 px-8">
        <div
          className="w-12 h-12 rounded-full border-4 border-[#E5E5EA] border-t-[#3B82F6] animate-spin"
        />
        <p className="text-2xl font-black text-[#1C1C1E] text-center">Crunching the Data...</p>
        <p className="text-sm text-[#8E8E93] text-center leading-5">
          Comparing with <span className="text-[#3B82F6] font-bold">{subscriptions.length} services</span>{' '}
          and your <span className="text-[#3B82F6] font-bold">${user?.monthly_budget || 0}/mo</span> budget...
        </p>
      </div>
    );
  }

  // ---- Render: Home ----

  if (viewMode === 'home') {
    return (
      <div className="min-h-screen bg-[#F9FAFB] pb-20">
        <div className="max-w-lg mx-auto">
          {/* Page title */}
          <div className="px-5 pt-10 pb-5">
            <p className="text-xs font-black text-[#3B82F6] uppercase tracking-[2px] mb-1">
              PRE-SUBSCRIPTION AUDIT
            </p>
            <h1 className="text-3xl font-black text-[#1C1C1E]">Subscription Audit</h1>
          </div>

          {/* Content */}
          <div className="px-5 flex flex-col gap-6">
            {/* New Audit Card */}
            <button
              onClick={handleStartAudit}
              className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4 w-full text-left hover:shadow-md transition-shadow"
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: colors.primary }}
              >
                <ChatBubbleIcon size={32} color="white" />
              </div>
              <div className="flex-1">
                <p className="text-base font-black text-[#1C1C1E]">New Insight Chat</p>
                <p className="text-sm text-[#8E8E93] leading-5 mt-1">
                  5–7 questions to decide if a new subscription is worth it.
                </p>
              </div>
            </button>

            {/* Past Audit Reports */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-black text-[#8E8E93] uppercase tracking-[2px]">
                PAST AUDIT REPORTS
              </p>
              {auditReports.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {auditReports.map(report => {
                    const scoreColor = report.score >= 70 ? colors.success : report.score >= 50 ? colors.warning : colors.danger;
                    const scoreBg = report.score >= 70 ? colors.successLight : report.score >= 50 ? colors.warningLight : colors.danger + '20';
                    return (
                      <button
                        key={report.id}
                        onClick={() => { setSelectedReport(report); setViewMode('report'); }}
                        className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-[#F2F2F7] shadow-sm w-full text-left hover:shadow-md transition-shadow"
                      >
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: scoreBg }}
                        >
                          <span className="text-base font-black" style={{ color: scoreColor }}>
                            {report.score}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-black text-[#1C1C1E] truncate">{report.service_name}</p>
                          <p className="text-xs font-black text-[#8E8E93] uppercase tracking-[1px] mt-0.5">
                            {report.category} • {report.cost}
                          </p>
                        </div>
                        <ChevronForwardIcon size={18} color={colors.gray400} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-16">
                  <SearchOutlineIcon size={48} color={colors.gray200} />
                  <p className="text-xs font-black text-[#8E8E93] uppercase tracking-[2px]">No audits yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: Chat ----

  if (viewMode === 'chat') {
    const currentStepIndex = Math.max(0, STAGE_ORDER.indexOf(currentStage));
    const visibleStepNumber = Math.min(currentStepIndex + 1, STAGE_ORDER.length);
    const progressPercent = `${(visibleStepNumber / STAGE_ORDER.length) * 100}%`;
    const currentUsageStop = getNearestUsageStop(usageSliderValue);

    return (
      <div
        id="chat-container"
        className="bg-[#F9FAFB] flex flex-col"
        style={{ height: '100dvh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, right: 0 }}
      >
        <div className="max-w-lg mx-auto w-full flex flex-col flex-1 min-h-0">
          {/* Chat header */}
          <div className="bg-white/90 border-b border-[#F2F2F7] flex-shrink-0">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <button
                onClick={handleReset}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <CloseIcon size={22} color={colors.textPrimary} />
              </button>
              <div className="flex-1 flex flex-col items-center gap-0.5">
                <p className="text-xs font-black text-[#1C1C1E] uppercase tracking-[2px]">AUDIT CHAT</p>
                <p className="text-[10px] font-bold text-[#8E8E93]">
                  Step {visibleStepNumber} of {STAGE_ORDER.length} · {STAGE_LABELS[currentStage]}
                </p>
              </div>
              <div className="w-10" />
            </div>
            <div className="h-1 bg-[#F2F2F7]">
              <div
                className="h-full rounded-r-full transition-all duration-300"
                style={{ width: progressPercent, backgroundColor: colors.primary }}
              />
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollViewRef}
            className="flex-1 overflow-y-auto bg-[#F2F2F7] px-5 py-4 flex flex-col gap-3"
          >
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={idx}
                  className={`flex items-end gap-2 max-w-[85%] ${isUser ? 'self-end flex-row-reverse' : 'self-start'}`}
                >
                  {!isUser && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <SparklesIcon size={14} color="white" />
                    </div>
                  )}
                  <div
                    className={`px-3 py-2.5 rounded-2xl max-w-full ${
                      isUser
                        ? 'rounded-tr-sm'
                        : 'bg-white border border-[#F2F2F7] rounded-tl-sm'
                    }`}
                    style={isUser ? { backgroundColor: colors.primary } : {}}
                  >
                    <p className={`text-sm leading-5 ${isUser ? 'text-white' : 'text-[#1C1C1E]'}`}>
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-end gap-2 self-start">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: colors.primary }}
                >
                  <SparklesIcon size={14} color="white" />
                </div>
                <div className="px-4 py-3 bg-white rounded-2xl rounded-tl-sm border border-[#F2F2F7]">
                  <div className="flex gap-1 items-center">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-[#C7C7CC] animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Option chips */}
            {showChips && (
              <div className="flex flex-wrap gap-1.5 mt-1 pl-10">
                {options.map(option => (
                  <button
                    key={option.id}
                    onClick={() => handleOptionTap(option)}
                    className="px-3.5 py-2 bg-[#F9FAFB] rounded-full border border-[#E5E5EA] text-sm font-medium hover:bg-[#E5E5EA] transition-colors"
                    style={{ color: colors.primary }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {showUsageSlider && (
              <div className="self-stretch pl-10 mt-1">
                <div className="bg-white rounded-2xl border border-[#E5E5EA] p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-[1.5px]">EXPECTED USAGE</p>
                      <p className="text-lg font-black text-[#1C1C1E] mt-0.5">{currentUsageStop.label}</p>
                    </div>
                    <button
                      onClick={handleUsageSliderSubmit}
                      className="h-10 px-4 rounded-xl text-sm font-black text-white shadow-sm"
                      style={{ backgroundColor: colors.primary }}
                    >
                      Use This
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={7}
                    step={0.5}
                    value={usageSliderValue}
                    onChange={e => setUsageSliderValue(Number(e.target.value))}
                    className="w-full accent-[#3B82F6]"
                    aria-label="Expected usage frequency"
                  />
                  <div className="flex justify-between mt-2 text-[10px] font-bold text-[#8E8E93]">
                    <span>Rare</span>
                    <span>Weekly</span>
                    <span>Daily</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="bg-white border-t border-[#F2F2F7] px-5 pt-3 flex-shrink-0"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)' }}
          >
            {aiStatusMessage && (
              <div className="mb-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
                <p className="text-xs font-semibold leading-4 text-[#92400E]">{aiStatusMessage}</p>
              </div>
            )}
            {awaitingFinalComment ? (
              <div className="flex items-center gap-2 py-1">
                <input
                  ref={finalCommentInputRef}
                  type="text"
                  placeholder="Add context (optional)..."
                  value={finalCommentText}
                  onChange={e => setFinalCommentText(e.target.value)}
                  onPointerDown={e => focusInputWithoutScroll(e, finalCommentInputRef)}
                  onFocus={() => requestAnimationFrame(() => window.scrollTo(0, 0))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (finalCommentText.trim()) {
                        handleSubmitFinalComment();
                      } else {
                        handleSkipToScore();
                      }
                    }
                  }}

                  className="flex-1 h-12 bg-[#F2F2F7] rounded-xl px-4 text-base text-[#1C1C1E] placeholder:text-[#8E8E93] outline-none"
                />
                {finalCommentText.trim() ? (
                  <button
                    onClick={handleSubmitFinalComment}
                    className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <SendIcon size={18} color="white" />
                  </button>
                ) : (
                  <button
                    onClick={handleSkipToScore}
                    className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: colors.textSecondary }}
                  >
                    <span className="text-white text-[10px] font-black">SKIP</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-1">
                <input
                  ref={chatInputRef}
                  type="text"
                  placeholder={showChips ? "Or type your own..." : "Type your answer..."}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onPointerDown={e => focusInputWithoutScroll(e, chatInputRef)}
                  onFocus={() => requestAnimationFrame(() => window.scrollTo(0, 0))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSendMessage(inputValue);
                  }}

                  disabled={isTyping}
                  className="flex-1 h-12 bg-[#F2F2F7] rounded-xl px-4 text-base text-[#1C1C1E] placeholder:text-[#8E8E93] outline-none disabled:opacity-50"
                />
                <button
                  onClick={() => handleSendMessage(inputValue)}
                  disabled={!inputValue.trim() || isTyping}
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-opacity disabled:opacity-30"
                  style={{ backgroundColor: colors.primary }}
                >
                  <SendIcon size={18} color="white" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: Report ----

  if (viewMode === 'report' && selectedReport) {
    const finalRec = selectedReport.decision?.final_recommendation ?? selectedReport.recommendation_type;
    const ctaConfig = getCTAConfig(finalRec);
    const scoreColor = selectedReport.score >= 70 ? colors.success : selectedReport.score >= 50 ? colors.warning : colors.danger;

    // CircularProgress
    const size = 180;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = circumference - (circumference * selectedReport.score) / 100;

    return (
      <>
        <div className="min-h-screen bg-[#F9FAFB] overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
          <div className="max-w-lg mx-auto">
            {/* Report header */}
            <div className="flex items-center justify-between px-5 pt-10 py-3">
              <button
                onClick={handleReset}
                className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center hover:shadow-md transition-shadow"
              >
                <CloseIcon size={22} color={colors.textPrimary} />
              </button>
              <div className="flex-1 flex flex-col items-center px-3">
                <p className="text-xs font-black text-[#8E8E93] uppercase tracking-[2px]">VERDICT READY</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: colors.primary }}>
                  {selectedReport.service_name}
                </p>
              </div>
              <div className="w-11" />
            </div>

            {/* Report body */}
            <div className="px-5 flex flex-col items-center gap-5">
              {/* Circular Progress */}
              <div className="my-3 relative" style={{ width: size, height: size }}>
                <svg
                  width={size}
                  height={size}
                  style={{ transform: 'rotate(-90deg)' }}
                >
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={colors.gray100}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                  />
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={scoreColor}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={progress}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black text-[#1C1C1E]" style={{ letterSpacing: '-2px' }}>
                    {selectedReport.score}
                  </span>
                  <span className="text-xs font-black text-[#8E8E93] uppercase tracking-[2px]">Score</span>
                </div>
              </div>

              {/* Status badge */}
              <div
                className="px-5 py-2 rounded-full"
                style={{ backgroundColor: scoreColor + '20' }}
              >
                <span className="text-xs font-black uppercase tracking-[2px]" style={{ color: scoreColor }}>
                  {selectedReport.status}
                </span>
              </div>

              {/* Uncertainty badge */}
              {selectedReport.uncertainty_level !== 'low' && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: colors.warning + '15' }}
                >
                  <InfoCircleOutlineIcon size={14} color={colors.warning} />
                  <span className="text-xs font-bold" style={{ color: colors.warning }}>
                    {selectedReport.uncertainty_level === 'high' ? 'High uncertainty' : 'Some uncertainty'} — recommendation is conservative
                  </span>
                </div>
              )}

              {/* Recommendation */}
              <div className="w-full bg-[#F2F2F7] p-5 rounded-2xl border border-[#E5E5EA]">
                <p className="text-xs font-bold text-[#8E8E93] italic text-center leading-[18px]">
                  &ldquo;{selectedReport.recommendation}&rdquo;
                </p>
              </div>

              {/* Factors */}
              <p className="text-xs font-black text-[#8E8E93] uppercase tracking-[2px] self-start">
                EVIDENCE & LOGIC
              </p>
              <div className="w-full flex flex-col gap-3">
                {selectedReport.factors.map((factor, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl border flex flex-col gap-2"
                    style={{
                      backgroundColor: factor.type === 'risk' ? colors.warning + '10' : colors.success + '10',
                      borderColor: factor.type === 'risk' ? colors.warning + '30' : colors.success + '30',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {factor.type === 'risk' ? (
                        <WarningOutlineIcon size={18} color={colors.warning} />
                      ) : (
                        <CheckmarkCircleOutlineIcon size={18} color={colors.success} />
                      )}
                      <span className="text-sm font-black text-[#1C1C1E] uppercase flex-1">
                        {factor.title}
                      </span>
                    </div>
                    <p className="text-xs text-[#8E8E93] leading-4 pl-7">
                      {factor.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div className="px-5 pt-5 pb-10 flex flex-col gap-3">
              <button
                onClick={handlePrimaryCTA}
                className="h-15 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: ctaConfig.color, height: '60px' }}
              >
                <span className="text-xs font-black text-white uppercase tracking-[1.5px]">
                  {ctaConfig.label}
                </span>
                <ArrowForwardIcon size={16} color="white" />
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center py-2 hover:opacity-70 transition-opacity"
              >
                <span className="text-xs font-bold text-[#8E8E93]">Start Another Audit</span>
              </button>
            </div>
          </div>
        </div>

        {/* Alternatives modal */}
        {showAlternativesModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
            onClick={() => setShowAlternativesModal(false)}
          >
            <div
              className="bg-white rounded-t-3xl p-6 pb-10 w-full max-w-lg flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-[#1C1C1E] uppercase tracking-[2px]">
                  CHEAPER ALTERNATIVES
                </p>
                <button
                  onClick={() => setShowAlternativesModal(false)}
                  className="hover:opacity-70 transition-opacity"
                >
                  <CloseIcon size={22} color={colors.textPrimary} />
                </button>
              </div>
              {loadingAlternatives ? (
                <div className="flex justify-center py-8">
                  <div
                    className="w-8 h-8 rounded-full border-4 border-[#E5E5EA] border-t-[#3B82F6] animate-spin"
                  />
                </div>
              ) : (
                alternatives.map((alt, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5 p-4 bg-[#F9FAFB] rounded-2xl border border-[#E5E5EA]">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-[#1C1C1E]">{alt.name}</span>
                      <span className="text-xs font-black text-[#34C759] uppercase">{alt.cost}</span>
                    </div>
                    <p className="text-sm text-[#8E8E93] leading-[18px]">{alt.reason}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
