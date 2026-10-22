import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useSubscriptions } from '@/contexts/SubscriptionContext';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles';
import { startAuditConversation, continueAuditConversation, runAdjuster } from '@/utils/claude';
import type { AuditContext, ClaudeAuditResponse } from '@/utils/claude';
import { computeScore, getDecisionResult, recommendationToStatus } from '@/utils/auditScorer';
import { buildAuditPersona } from '@/utils/personaGenerator';
import { supabase } from '@/utils/supabase';
import { generateAlternatives } from '@/utils/alternativesGenerator';
import type { Alternative } from '@/utils/alternativesGenerator';
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
} from '@/types';

// ---- FSM constants ----

type ViewMode = 'home' | 'chat' | 'finalizing' | 'report';

// v2 stage order (overlap_check is conditional — inserted only when same_cat_subs is non-empty)
const STAGE_ORDER: AuditStage[] = [
  'service_id',
  'motivation',
  'history_check',
  'expected_usage',
  'overlap_check',  // skipped if no same-category subs
  'budget_feel',
  'risk',
];

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

// ---- Recovery questions (fired for undefined slots, not 'not_sure') ----

type RecoveryEntry = {
  question: string;
  options?: AuditOption[];
  inputMode: 'options' | 'text';
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

// ---- Main component ----

export const AuditScreen: React.FC = () => {
  const insets = useScreenInsets();
  const navigation = useNavigation<BottomTabNavigationProp<any>>();
  const { subscriptions, user, persona, addSubscription } = useSubscriptions();
  const scrollViewRef = useRef<ScrollView>(null);

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

  // FSM state
  const [currentStage, setCurrentStage] = useState<AuditStage>('service_id');
  const [auditPersona, setAuditPersona] = useState<AuditPersona | null>(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [collectedSlots, setCollectedSlots] = useState<AuditSlots>({});

  // Aha / disclosure state
  const [lastAhaTurn, setLastAhaTurn] = useState(-AHA_COOLDOWN_TURNS);
  const [notSureCount, setNotSureCount] = useState(0);
  // showTextInput removed — text input is now always visible in footer
  const [lastFlags, setLastFlags] = useState<ClaudeAuditResponse['flags']>({
    contradiction: false,
    off_topic: false,
    price_cycle_unclear: false,
  });

  // Aha per-audit guard
  const [ahaTriggered, setAhaTriggered] = useState(false);

  // Raw conversation history — stores Claude's JSON responses verbatim (matches Workbench pattern)
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
    const loaded: AuditReport[] = data.map((row: any) => {
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

  useFocusEffect(useCallback(() => {
    loadAuditReports();
  }, [loadAuditReports]));

  // Hide/show tab bar — call setOptions on the tab navigator directly (this IS the tab nav)
  useEffect(() => {
    if (viewMode === 'home') {
      navigation.setOptions({
        tabBarStyle: {
          backgroundColor: colors.textInverse,
          borderTopWidth: 0,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: spacing.sm,
          paddingLeft: Math.max(insets.left, 12),
          paddingRight: Math.max(insets.right, 12),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
        },
      });
    } else {
      navigation.setOptions({ tabBarStyle: { display: 'none' } });
    }
  }, [viewMode, navigation, insets]);

  // Auto-scroll
  useEffect(() => {
    if (viewMode === 'chat' && scrollViewRef.current) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
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

    // Skip overlap_check if no same-category subs
    if (nextStage === 'overlap_check') {
      const hasSameCat = auditPersona && auditPersona.same_cat_subs && auditPersona.same_cat_subs.length > 0;
      if (!hasSameCat || slots.overlap_level !== undefined) {
        // Skip to budget_feel
        const overlapIdx = STAGE_ORDER.indexOf('overlap_check');
        nextStage = STAGE_ORDER[overlapIdx + 1];
      }
    }

    return nextStage;
  }

  function canFinish(turn: number, stage: AuditStage): boolean {
    return turn >= 5 && stage === 'risk';
  }

  // ---- Aha guard ----

  function shouldShowAha(response: ClaudeAuditResponse, turn: number, stage: AuditStage, slots: AuditSlots, budget: number): boolean {
    if (!response.aha.triggered || response.aha.bubbles.length === 0) return false;
    if (ahaTriggered) return false; // max once per audit
    if (turn - lastAhaTurn < AHA_COOLDOWN_TURNS) return false;
    if (['service_id', 'motivation'].includes(stage)) {
      const price = typeof slots.price_monthly === 'number' ? slots.price_monthly : 0;
      if (price / (budget || 1) < 0.15) return false;
    }
    return true;
  }

  // ---- Chip visibility ----
  // Chips show when Claude says "options" (or slider fallback) and options exist.
  // Text input is ALWAYS visible in the footer — user can tap a chip OR type.
  const showChips = uiMode !== 'text' && options.length > 0 && !isTyping && !awaitingFinalComment;

  // ---- Build Claude context ----

  function getOrBuildPersona(serviceCategory?: string): AuditPersona {
    if (auditPersona) return auditPersona;
    const prefs = persona?.setup_preferences;
    if (!prefs) {
      // Fallback minimal persona
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
      };
    }
    return buildAuditPersona(
      user?.name || 'there',
      user?.monthly_budget || 0,
      prefs,
      subscriptions,
      serviceCategory || 'Productivity',
    );
  }

  function buildContext(stage: AuditStage, turn: number, slots: AuditSlots): AuditContext {
    const p = getOrBuildPersona(
      slots.service_name ? detectCategory(slots.primary_motivation) : undefined,
    );
    return { stage, turn_index: turn, slots, persona: p };
  }

  // ---- Display bubbles with stagger (context only — question shown separately) ----

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
      // 1. Store flags
      setLastFlags(response.flags);

      // 2. Off-topic
      if (response.flags.off_topic) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "I can only help with subscription decisions. What service are you thinking of subscribing to?",
        }]);
        setUiMode('text');
        return;
      }

      // 3. Price cycle unclear — store raw price, ask for cycle
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

      // 4. Merge slots_delta
      const delta = { ...response.slots_delta };
      const newSlots: AuditSlots = { ...slotsAtTime, ...delta };

      // 5. Normalize price → price_monthly
      if (typeof newSlots.price === 'number' && newSlots.billing_cycle) {
        newSlots.price_monthly = normalizePriceToMonthly(newSlots.price, newSlots.billing_cycle);
      }
      setCollectedSlots(newSlots);

      // 5.5. Rebuild persona when service_name is first known (for persona_alignment)
      if (newSlots.service_name && !auditPersona) {
        const category = detectCategory(newSlots.primary_motivation);
        const p = getOrBuildPersona(category);
        setAuditPersona(p);
      }

      // 6. Update not_sure counter
      const notSures = Object.values(delta).filter(v => v === 'not_sure').length;
      setNotSureCount(prev => prev + notSures);

      // 7. Aha control
      const ahaAllowed = shouldShowAha(response, turn, stageAtTime, newSlots, budget);
      if (ahaAllowed) {
        setLastAhaTurn(turn);
        setAhaTriggered(true);
      }

      // 8. Show context bubbles (no question yet)
      await displayBubbles(response.bubbles, ahaAllowed, response.aha.bubbles);

      // 9. Trust Claude's stage as the source of truth — Claude sees its own JSON
      //    history and manages stage transitions naturally (matching Workbench behavior).
      //    Only fall back to client-side advance if Claude didn't report a stage.
      const claudeStage = response.stage || stageAtTime;
      setCurrentStage(claudeStage);

      // 10. Recovery — ONLY when Claude returned NO question AND NO options.
      //    This is a last-resort safety net, not the primary stage-advance mechanism.
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

      // 11. Finish guard — check is_finished from Claude or safety-net canFinish
      if (response.is_finished || canFinish(turn + 1, claudeStage)) {
        pendingFinishSlotsRef.current = newSlots;
        await new Promise(r => setTimeout(r, 900));
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "That's all I need! Anything else you'd like me to factor in before I calculate your score?",
        }]);
        setAwaitingFinalComment(true);
      } else {
        // Always use Claude's question and options — Claude sees its own JSON history
        // and handles stage transitions naturally (matching Workbench behavior)
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
        setUiMode(responseMode === 'slider' ? (response.options?.length > 0 ? 'options' : 'text') : responseMode);
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

    // 1. Rule score
    const ruleScore = computeScore(slotsForReport, p);

    // 2. AI Adjuster (runs in parallel with the finalizing animation)
    let adjusterResult: AdjusterResult | undefined;
    try {
      adjusterResult = await runAdjuster(slotsForReport, p, ruleScore, messages);
    } catch {
      console.error('[AuditScreen] Adjuster failed, using rule score only');
    }

    // 3. Final score
    const adjusterDelta = adjusterResult?.total_delta ?? 0;
    const finalScore = Math.max(0, Math.min(100, Math.round((ruleScore.total + adjusterDelta) * 10) / 10));

    // 4. Decision layer
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

    // Persist to Supabase (best-effort — don't block the UI)
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
        if (error) console.error('[AuditScreen] Failed to save assessment:', error);
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

    try {
      const ctx = buildContext('service_id', 0, {});
      const { response, rawText } = await startAuditConversation(ctx);
      rawConvoRef.current = [
        { role: 'user', content: 'Start the audit. Ask me what service I am thinking of subscribing to.' },
        { role: 'assistant', content: rawText },
      ];
      await handleClaudeResponse(response, {}, 'service_id', 0);
    } catch (error) {
      console.error('[AuditScreen] startAudit failed:', error);
      setIsTyping(false);
    }
  };

  // ---- Send message (from option tap or text input) ----

  const handleSendMessage = async (displayText: string, apiText?: string) => {
    const display = String(displayText);
    const api = apiText ?? display;
    if (!display.trim() || isTyping) return;

    // Add to display messages (UI shows readable text)
    setMessages(prev => [...prev, { role: 'user', content: display }]);
    setInputValue('');
    setOptions([]);
    setIsTyping(true);

    // Add user message to raw conversation (API sees value/text)
    const updatedRawConvo: ChatMessage[] = [...rawConvoRef.current, { role: 'user', content: api }];
    rawConvoRef.current = updatedRawConvo;

    try {
      const ctx = buildContext(currentStage, turnIndex, collectedSlots);
      const { response, rawText } = await continueAuditConversation(updatedRawConvo, ctx);
      // Store Claude's raw JSON response in conversation history
      rawConvoRef.current = [...rawConvoRef.current, { role: 'assistant', content: rawText }];
      await handleClaudeResponse(response, collectedSlots, currentStage, turnIndex);
    } catch (error) {
      console.error('[AuditScreen] sendMessage failed:', error);
      setIsTyping(false);
    }
  };

  // ---- Option chip tap ----

  const handleOptionTap = (option: AuditOption) => {
    if (String(option.value).toLowerCase().includes('not_sure') || option.id === 'ns') {
      setNotSureCount(prev => prev + 1);
    }
    // Display label in UI for readability, send value to API for accuracy
    handleSendMessage(option.label, String(option.value));
  };

  // ---- Reset ----

  const handleReset = () => {
    setViewMode('home');
    setMessages([]);
    setOptions([]);
    setCollectedSlots({});
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
    setSelectedReport(null);
    setShowAlternativesModal(false);
  };

  // ---- CTA actions ----

  const handlePrimaryCTA = async () => {
    if (!selectedReport) return;
    const finalRec = selectedReport.decision?.final_recommendation ?? selectedReport.recommendation_type;

    switch (finalRec) {
      case 'subscribe':
        (navigation as any).navigate('AddSubscription', {
          prefillData: {
            name: selectedReport.service_name,
            cost: parseFloat(selectedReport.cost.replace(/[^0-9.]/g, '')),
            category: selectedReport.category,
            nextRenewalDate: nextMonthISO(),
          },
        });
        break;

      case 'trial':
      case 'delay':
        try {
          await addSubscription({
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
          Alert.alert(
            finalRec === 'delay' ? 'Reminder Set' : 'Reminder Set',
            finalRec === 'delay' ? 'Saved — we\'ll remind you to revisit.' : 'Saved as a paused reminder.',
          );
          handleReset();
        } catch {
          Alert.alert('Error', 'Could not save. Please try again.');
        }
        break;

      case 'watchlist':
        try {
          await addSubscription({
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
          Alert.alert('Added to Watchlist', 'Saved for later review.');
          handleReset();
        } catch {
          Alert.alert('Error', 'Could not save to watchlist.');
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

  // ---- Sub-components ----

  const TypingIndicator = () => (
    <View style={styles.typingContainer}>
      <View style={styles.botAvatar}>
        <Ionicons name="chatbubble-ellipses" size={16} color={colors.primary} />
      </View>
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          {[0, 1, 2].map(i => <View key={i} style={styles.typingDot} />)}
        </View>
      </View>
    </View>
  );

  const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.role === 'user';
    return (
      <View style={[styles.chatBubbleContainer, isUser && styles.chatBubbleContainerUser]}>
        {!isUser && (
          <View style={styles.botAvatar}>
            <Ionicons name="sparkles" size={14} color="white" />
          </View>
        )}
        <View style={[styles.chatBubble, isUser ? styles.chatBubbleUser : styles.chatBubbleBot]}>
          <Text style={[styles.chatBubbleText, isUser && styles.chatBubbleTextUser]}>
            {message.content}
          </Text>
        </View>
      </View>
    );
  };

  const CircularProgress: React.FC<{ score: number; size: number }> = ({ score, size }) => {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = circumference - (circumference * score) / 100;
    const scoreColor = score >= 70 ? colors.success : score >= 50 ? colors.warning : colors.danger;
    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.gray[100]} strokeWidth={strokeWidth} fill="transparent" />
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={scoreColor} strokeWidth={strokeWidth} fill="transparent"
            strokeDasharray={circumference} strokeDashoffset={progress} strokeLinecap="round" />
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.progressCenter}>
            <Text style={styles.progressScore}>{score}</Text>
            <Text style={styles.progressLabel}>Score</Text>
          </View>
        </View>
      </View>
    );
  };

  // ---- Render: Finalizing ----

  if (viewMode === 'finalizing') {
    return (
      <View style={[styles.container, styles.containerCenter]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.finalizingTitle}>Crunching the Data...</Text>
        <Text style={styles.finalizingText}>
          Comparing with <Text style={styles.finalizingBold}>{subscriptions.length} services</Text>{' '}
          and your <Text style={styles.finalizingBold}>${user?.monthly_budget || 0}/mo</Text> budget...
        </Text>
      </View>
    );
  }

  // ---- Render: Home ----

  if (viewMode === 'home') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>PRE-SUBSCRIPTION AUDIT</Text>
          <Text style={styles.headerTitle}>Subscription Audit</Text>
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
          <Pressable style={styles.newAuditCard} onPress={handleStartAudit}>
            <View style={styles.newAuditIcon}>
              <Ionicons name="chatbubble-ellipses" size={36} color="white" />
            </View>
            <View style={styles.newAuditContent}>
              <Text style={styles.newAuditTitle}>New Insight Chat</Text>
              <Text style={styles.newAuditDescription}>
                5–7 questions to decide if a new subscription is worth it.
              </Text>
            </View>
          </Pressable>

          <View style={styles.reportsSection}>
            <Text style={styles.reportsSectionTitle}>PAST AUDIT REPORTS</Text>
            {auditReports.length > 0 ? (
              <View style={styles.reportsList}>
                {auditReports.map(report => (
                  <Pressable key={report.id} style={styles.reportCard} onPress={() => { setSelectedReport(report); setViewMode('report'); }}>
                    <View style={[styles.reportScore, { backgroundColor: report.score >= 70 ? colors.successLight : report.score >= 50 ? colors.warningLight : colors.danger + '20' }]}>
                      <Text style={[styles.reportScoreText, { color: report.score >= 70 ? colors.success : report.score >= 50 ? colors.warning : colors.danger }]}>
                        {report.score}
                      </Text>
                    </View>
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportName}>{report.service_name}</Text>
                      <Text style={styles.reportCategory}>{report.category} • {report.cost}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.gray[400]} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={colors.gray[200]} />
                <Text style={styles.emptyStateText}>No audits yet</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---- Render: Chat ----

  if (viewMode === 'chat') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top}>
        {/* Chat header */}
        <View style={[styles.chatHeader, { paddingTop: insets.top + spacing.md }]}>
          <Pressable style={styles.chatCloseButton} onPress={handleReset}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.chatHeaderContent}>
            <Text style={styles.chatHeaderTitle}>AUDIT CHAT</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Messages */}
        <ScrollView ref={scrollViewRef} style={styles.chatContent} contentContainerStyle={styles.chatContentContainer} showsVerticalScrollIndicator={false}>
          {messages.map((msg, idx) => <ChatBubble key={idx} message={msg} />)}
          {isTyping && <TypingIndicator />}

          {/* Option chips */}
          {showChips && (
            <View style={styles.optionsContainer}>
              {options.map(option => (
                <Pressable key={option.id} style={styles.optionChip} onPress={() => handleOptionTap(option)}>
                  <Text style={styles.optionChipText}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.chatFooter, { paddingBottom: insets.bottom }]}>
          {awaitingFinalComment ? (
            // "Anything to add?" gate
            <View>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Add context (optional)..."
                  placeholderTextColor={colors.textSecondary}
                  value={finalCommentText}
                  onChangeText={setFinalCommentText}
                  returnKeyType="send"
                  onSubmitEditing={finalCommentText.trim() ? handleSubmitFinalComment : handleSkipToScore}
                />
                {finalCommentText.trim() ? (
                  <Pressable style={styles.chatSendButton} onPress={handleSubmitFinalComment}>
                    <Ionicons name="send" size={18} color="white" />
                  </Pressable>
                ) : (
                  <Pressable style={[styles.chatSendButton, { backgroundColor: colors.textSecondary }]} onPress={handleSkipToScore}>
                    <Text style={{ color: 'white', fontSize: fontSize.xxs, fontWeight: '900' }}>SKIP</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            // Always show text input — user can type or tap chips above
            <View style={styles.inputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder={showChips ? "Or type your own..." : "Type your answer..."}
                placeholderTextColor={colors.textSecondary}
                value={inputValue}
                onChangeText={setInputValue}
                onSubmitEditing={() => handleSendMessage(inputValue)}
                editable={!isTyping}
                returnKeyType="send"
              />
              <Pressable
                style={[styles.chatSendButton, (!inputValue.trim() || isTyping) && styles.chatSendButtonDisabled]}
                onPress={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim() || isTyping}
              >
                <Ionicons name="send" size={18} color="white" />
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ---- Render: Report ----

  if (viewMode === 'report' && selectedReport) {
    const finalRec = selectedReport.decision?.final_recommendation ?? selectedReport.recommendation_type;
    const ctaConfig = getCTAConfig(finalRec);
    const scoreColor = selectedReport.score >= 70 ? colors.success : selectedReport.score >= 50 ? colors.warning : colors.danger;

    return (
      <>
        <ScrollView style={styles.container} contentContainerStyle={[styles.reportContainer, { paddingTop: insets.top }]}>
          {/* Report header */}
          <View style={styles.reportHeader}>
            <Pressable style={styles.reportCloseButton} onPress={handleReset}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.reportHeaderContent}>
              <Text style={styles.reportHeaderSubtitle}>VERDICT READY</Text>
              <Text style={styles.reportHeaderTitle}>{selectedReport.service_name}</Text>
            </View>
            <View style={{ width: 48 }} />
          </View>

          <View style={styles.reportBody}>
            {/* Score */}
            <View style={styles.reportScoreContainer}>
              <CircularProgress score={selectedReport.score} size={180} />
            </View>

            {/* Status badge */}
            <View style={[styles.reportStatusBadge, { backgroundColor: scoreColor + '20' }]}>
              <Text style={[styles.reportStatusText, { color: scoreColor }]}>
                {selectedReport.status}
              </Text>
            </View>

            {/* Uncertainty badge (if medium/high) */}
            {selectedReport.uncertainty_level !== 'low' && (
              <View style={styles.uncertaintyBadge}>
                <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
                <Text style={styles.uncertaintyText}>
                  {selectedReport.uncertainty_level === 'high' ? 'High uncertainty' : 'Some uncertainty'} — recommendation is conservative
                </Text>
              </View>
            )}

            {/* Recommendation */}
            <View style={styles.reportRecommendation}>
              <Text style={styles.reportRecommendationText}>"{selectedReport.recommendation}"</Text>
            </View>

            {/* Factors */}
            <Text style={styles.reportFactorsTitle}>EVIDENCE & LOGIC</Text>
            <View style={styles.reportFactors}>
              {selectedReport.factors.map((factor, idx) => (
                <View key={idx} style={[styles.reportFactor, { backgroundColor: factor.type === 'risk' ? colors.warning + '10' : colors.success + '10', borderColor: factor.type === 'risk' ? colors.warning + '30' : colors.success + '30' }]}>
                  <View style={styles.reportFactorHeader}>
                    <Ionicons name={factor.type === 'risk' ? 'warning-outline' : 'checkmark-circle-outline'} size={18} color={factor.type === 'risk' ? colors.warning : colors.success} />
                    <Text style={styles.reportFactorTitle}>{factor.title}</Text>
                  </View>
                  <Text style={styles.reportFactorDescription}>{factor.description}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* CTAs */}
          <View style={[styles.reportFooter, { paddingBottom: insets.bottom + spacing.xl }]}>
            <Pressable style={[styles.reportActionButton, { backgroundColor: ctaConfig.color }]} onPress={handlePrimaryCTA}>
              <Text style={styles.reportActionButtonText}>{ctaConfig.label}</Text>
              <Ionicons name="arrow-forward" size={16} color="white" />
            </Pressable>
            <Pressable style={styles.reportSecondaryButton} onPress={handleReset}>
              <Text style={styles.reportSecondaryButtonText}>Start Another Audit</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Alternatives modal */}
        <Modal visible={showAlternativesModal} transparent animationType="slide" onRequestClose={() => setShowAlternativesModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.xl }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>CHEAPER ALTERNATIVES</Text>
                <Pressable onPress={() => setShowAlternativesModal(false)}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </Pressable>
              </View>
              {loadingAlternatives ? (
                <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
              ) : (
                alternatives.map((alt, idx) => (
                  <View key={idx} style={styles.alternativeCard}>
                    <View style={styles.alternativeHeader}>
                      <Text style={styles.alternativeName}>{alt.name}</Text>
                      <Text style={styles.alternativeCost}>{alt.cost}</Text>
                    </View>
                    <Text style={styles.alternativeReason}>{alt.reason}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return null;
};

// ---- Helpers ----

/**
 * Returns default options for a stage when Claude's response has empty options.
 * This covers the common case where Claude answers for stage N but the FSM has
 * advanced to stage N+1 — Claude's response.options will be empty/wrong for the
 * new stage, so we fill in the well-known defaults.
 */
function getDefaultOptionsForStage(stage: AuditStage): AuditOption[] {
  const slot = REQUIRED_SLOTS_PER_STAGE[stage][0];
  return RECOVERY_QUESTIONS[slot]?.options ?? [];
}

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

  // Usage
  if (slots.expected_frequency && slots.expected_frequency !== 'not_sure') {
    const highFreq = ['daily', 'most_days', 'few_times'];
    const isHigh = highFreq.includes(slots.expected_frequency);
    factors.push({
      title: 'Expected Usage',
      description: isHigh ? 'High usage frequency — good value per use.' : 'Lower usage frequency increases risk of waste.',
      type: isHigh ? 'pass' : 'risk',
    });
  }

  // Budget
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

  // Overlap
  if (slots.overlap_level && slots.overlap_level !== 'not_sure') {
    const isRisk = slots.overlap_level === 'significant' || slots.overlap_level === 'high';
    factors.push({
      title: 'Overlap with Existing Subs',
      description: isRisk ? 'High overlap with what you already pay for.' : 'Low overlap — this adds unique value.',
      type: isRisk ? 'risk' : 'pass',
    });
  }

  // Risk
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

  // History
  if (slots.history_status === 'cancelled' && slots.cancel_reason === 'low_usage') {
    factors.push({
      title: 'Previous Cancellation',
      description: "You've cancelled this before due to low usage — same pattern may repeat.",
      type: 'risk',
    });
  }

  // Forcing function
  if (slots.forcing_function) {
    factors.push({
      title: 'External Requirement',
      description: `This is required for ${slots.forcing_function} purposes — strong need signal.`,
      type: 'pass',
    });
  }

  // Uncertainty
  if (scoreResult.uncertainty_level !== 'low') {
    factors.push({
      title: 'Uncertainty',
      description: 'Some answers were unclear or skipped — recommendation is conservative.',
      type: 'risk',
    });
  }

  // Adjuster insight
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

// ---- Styles ----

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundLight },
  containerCenter: { justifyContent: 'center', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },

  // Header
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerSubtitle: { fontSize: fontSize.xxs, fontWeight: '900', color: colors.primary, textTransform: 'uppercase', letterSpacing: 2, marginBottom: spacing.xs },
  headerTitle: { fontSize: fontSize.xxxl, fontWeight: '900', color: colors.textPrimary },

  // Home
  content: { flex: 1 },
  homeContent: { padding: spacing.lg, gap: spacing.xl },
  newAuditCard: { backgroundColor: 'white', borderRadius: borderRadius.xl, padding: spacing.xl, ...shadows.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  newAuditIcon: { width: 56, height: 56, borderRadius: borderRadius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  newAuditContent: { flex: 1, gap: spacing.xs },
  newAuditTitle: { fontSize: fontSize.lg, fontWeight: '900', color: colors.textPrimary },
  newAuditDescription: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },

  // Reports
  reportsSection: { gap: spacing.md },
  reportsSectionTitle: { fontSize: fontSize.xxs, fontWeight: '900', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 2 },
  reportsList: { gap: spacing.sm },
  reportCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: 'white', borderRadius: borderRadius.xxl, borderWidth: 1, borderColor: colors.gray[100], ...shadows.sm },
  reportScore: { width: 44, height: 44, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  reportScoreText: { fontSize: fontSize.base, fontWeight: '900' },
  reportInfo: { flex: 1, marginLeft: spacing.md },
  reportName: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 2 },
  reportCategory: { fontSize: fontSize.xxs, fontWeight: '900', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },

  // Empty state
  emptyState: { paddingVertical: spacing.xl * 2, alignItems: 'center', gap: spacing.md },
  emptyStateText: { fontSize: fontSize.xxs, fontWeight: '900', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 2 },

  // Chat header
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: 'rgba(255,255,255,0.9)', borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  chatCloseButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chatHeaderContent: { flex: 1, alignItems: 'center' },
  chatHeaderTitle: { fontSize: fontSize.xxs, fontWeight: '900', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 2 },
  chatHeaderStage: { fontSize: fontSize.xxs, fontWeight: 'bold', color: colors.primary, marginTop: 2 },

  // Chat content
  chatContent: { flex: 1, backgroundColor: colors.gray[50] },
  chatContentContainer: { padding: spacing.lg, gap: spacing.md },

  // Chat bubbles
  chatBubbleContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, maxWidth: '85%' },
  chatBubbleContainerUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  botAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  chatBubble: { padding: spacing.md, borderRadius: borderRadius.lg, maxWidth: '100%' },
  chatBubbleBot: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.gray[100], borderTopLeftRadius: 4 },
  chatBubbleUser: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
  chatBubbleText: { fontSize: fontSize.sm, lineHeight: 20, color: colors.textPrimary },
  chatBubbleTextUser: { color: 'white' },

  // Typing indicator
  typingContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  typingBubble: { padding: spacing.md, backgroundColor: 'white', borderRadius: borderRadius.lg, borderTopLeftRadius: 4, borderWidth: 1, borderColor: colors.gray[100] },
  typingDots: { flexDirection: 'row', gap: 4 },
  typingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gray[400] },

  // Options
  optionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm, paddingLeft: 38 },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.gray[50], borderRadius: 20, borderWidth: 1, borderColor: colors.gray[200] },
  optionChipText: { fontSize: 13, fontWeight: '500', color: colors.primary },

  // Chat footer
  chatFooter: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: colors.gray[100] },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.xs },
  chatInput: { flex: 1, height: 48, backgroundColor: colors.gray[50], borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, fontSize: fontSize.sm, color: colors.textPrimary },
  chatSendButton: { width: 48, height: 48, borderRadius: borderRadius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.sm },
  chatSendButtonDisabled: { opacity: 0.3 },

  // Finalizing
  finalizingTitle: { fontSize: fontSize.xxl, fontWeight: '900', color: colors.textPrimary, textAlign: 'center' },
  finalizingText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  finalizingBold: { color: colors.primary, fontWeight: 'bold' },

  // Report
  reportContainer: { paddingBottom: spacing.xl * 2 },
  reportHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  reportCloseButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', ...shadows.sm },
  reportHeaderContent: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.md },
  reportHeaderSubtitle: { fontSize: fontSize.xxs, fontWeight: '900', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 2 },
  reportHeaderTitle: { fontSize: fontSize.sm, fontWeight: 'bold', color: colors.primary, marginTop: 2 },
  reportBody: { paddingHorizontal: spacing.lg, alignItems: 'center', gap: spacing.lg },
  reportScoreContainer: { marginVertical: spacing.md },
  progressCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progressScore: { fontSize: 44, fontWeight: '900', color: colors.textPrimary, letterSpacing: -2 },
  progressLabel: { fontSize: fontSize.xxs, fontWeight: '900', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 2 },
  reportStatusBadge: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full },
  reportStatusText: { fontSize: fontSize.xxs, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 },
  uncertaintyBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.warning + '15', borderRadius: borderRadius.full },
  uncertaintyText: { fontSize: fontSize.xxs, fontWeight: '700', color: colors.warning },
  reportRecommendation: { width: '100%', backgroundColor: colors.gray[50], padding: spacing.lg, borderRadius: borderRadius.xxl, borderWidth: 1, borderColor: colors.gray[100] },
  reportRecommendationText: { fontSize: fontSize.xs, fontWeight: 'bold', color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', lineHeight: 18 },
  reportFactorsTitle: { fontSize: fontSize.xxs, fontWeight: '900', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 2, alignSelf: 'flex-start' },
  reportFactors: { width: '100%', gap: spacing.md },
  reportFactor: { padding: spacing.lg, borderRadius: borderRadius.xxl, borderWidth: 1, gap: spacing.sm },
  reportFactorHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reportFactorTitle: { fontSize: fontSize.sm, fontWeight: '900', color: colors.textPrimary, textTransform: 'uppercase', flex: 1 },
  reportFactorDescription: { fontSize: fontSize.xxs, color: colors.textSecondary, lineHeight: 16, paddingLeft: spacing.xl },
  reportFooter: { padding: spacing.lg, gap: spacing.md },
  reportActionButton: { height: 60, borderRadius: borderRadius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...shadows.sm },
  reportActionButtonText: { fontSize: fontSize.xs, fontWeight: '900', color: 'white', textTransform: 'uppercase', letterSpacing: 1.5 },
  reportSecondaryButton: { alignItems: 'center', paddingVertical: spacing.sm },
  reportSecondaryButtonText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl, padding: spacing.xl, gap: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: fontSize.xxs, fontWeight: '900', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 2 },
  alternativeCard: { backgroundColor: colors.gray[50], padding: spacing.lg, borderRadius: borderRadius.xl, gap: spacing.xs },
  alternativeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alternativeName: { fontSize: fontSize.base, fontWeight: '900', color: colors.textPrimary },
  alternativeCost: { fontSize: fontSize.xxs, fontWeight: '900', color: colors.success, textTransform: 'uppercase' },
  alternativeReason: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 18 },
});
