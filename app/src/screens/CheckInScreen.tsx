import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSubscriptions } from '@/contexts/SubscriptionContext';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles';
import type { CheckInAction, SetupPreferences } from '@/types';
import {
  generateReviewQuestions,
  generateLoveQuestions,
  generateUnsureQuestions,
  FALLBACK_REVIEW_QUESTIONS,
  FALLBACK_LOVE_QUESTIONS,
  FALLBACK_UNSURE_QUESTIONS,
  type ReviewQuestions,
  type LoveQuestions,
} from '@/utils/checkinLLM';
import {
  generateSessionSummary,
  buildSubSummaries,
  type SessionSummary,
} from '@/utils/checkinSummary';
interface QuestionCacheEntry {
  love?: LoveQuestions;
  review?: ReviewQuestions;
  unsure?: ReviewQuestions;
}
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';

const { width, height } = Dimensions.get('window');

// Scale factor so card content looks proportionally identical on all screen sizes.
// 1.0 on iPhone 16 Pro Max (440pt), ~0.91 on iPhone 16 Pro (402pt).
const CARD_SCALE = Math.min(1, width / 440);

// True for screens shorter than Pro Max (e.g. iPhone 16 Pro at 874pt).
const IS_COMPACT = height < 900;

// Returns the ISO date string of the most-recent Sunday (start of current week).
function getWeekStartKey(): string {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, '0');
  const d = String(weekStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Returns the ISO date of the Sunday before last week's Sunday.
function getPrevWeekKey(): string {
  const now = new Date();
  const prevSunday = new Date(now);
  prevSunday.setDate(now.getDate() - now.getDay() - 7);
  const y = prevSunday.getFullYear();
  const m = String(prevSunday.getMonth() + 1).padStart(2, '0');
  const d = String(prevSunday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
const SWIPE_THRESHOLD = 120;
const CARD_WIDTH = width * 0.85;
const CARD_HEIGHT = IS_COMPACT ? height * 0.54 : height * 0.6;

type CardMode = 'card' | 'question' | 'ignore';
type QuestionFlow = 'love' | 'unsure' | 'review';

const IGNORE_DURATIONS: Array<{ label: string; days: number | null }> = [
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: 'Forever', days: null },
];

interface IgnoredSub {
  subId: string;
  subName: string;
  iconEmoji: string;
  color: string;
  ignoredAt: string;
  durationLabel: string;
  expiresAt: string | null; // null = forever
}

const DEFAULT_PERSONA: SetupPreferences = {
  budget_tightness: 0.5,
  price_sensitivity: 0.5,
  waste_tolerance: 0.5,
  exploration_tendency: 0.5,
  quality_preference: 0.5,
  decision_style: 'moderate',
};

interface QContent {
  icon: string;
  iconColor: string;
  bgColor: string;
  title: string;
  subtitle: string;
  options: { key: string; label: string }[];
}


export const CheckInScreen: React.FC = () => {
  const insets = useScreenInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { subscriptions, user, persona, submitCheckInFeedback } = useSubscriptions();

  // Ignore feature — declared before activeSubs useMemo so they're available in the closure
  const [ignoredSubs, setIgnoredSubs] = useState<IgnoredSub[]>([]);
  const [loveStreaks, setLoveStreaks] = useState<Record<string, number>>({});
  const [showArchive, setShowArchive] = useState(false);

  // Filter only active subscriptions (excluding ignored ones)
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
  // Phase 4: LLM-generated questions per flow
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestions | null>(null);
  const [loveQuestions, setLoveQuestions] = useState<LoveQuestions | null>(null);
  const [unsureQuestions, setUnsureQuestions] = useState<ReviewQuestions | null>(null);
  const [loadingReviewQ, setLoadingReviewQ] = useState(false);
  const [loadingLoveQ, setLoadingLoveQ] = useState(false);
  const [loadingUnsureQ, setLoadingUnsureQ] = useState(false);

  // Phase 5: Session summary
  const [sessionResults, setSessionResults] = useState<
    Record<string, { action: CheckInAction; q1: string | null; q2: string | null; diveNote: string | null }>
  >({});
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Phase 7: Dive deeper
  const [q2AnswerPending, setQ2AnswerPending] = useState<string | null>(null);
  const [diveMode, setDiveMode] = useState<'prompt' | 'input' | null>(null);
  const [diveText, setDiveText] = useState('');

  // Weekly gate: track which week the user last completed a full session
  const [completedWeekKey, setCompletedWeekKey] = useState<string | null>(null);
  const [weekStatusLoaded, setWeekStatusLoaded] = useState(false);

  // Streak: consecutive weeks completed
  const [streak, setStreak] = useState(1);

  // Saved summary from a previously completed session (for revisit)
  const [savedSummary, setSavedSummary] = useState<SessionSummary | null>(null);

  // Pre-fetch cache: subId → { love, review, unsure }
  const questionCache = useRef<Record<string, QuestionCacheEntry>>({});

  // Animated values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const currentSub = activeSubs[currentIndex];
  const nextSub = activeSubs[currentIndex + 1];
  const nextNextSub = activeSubs[currentIndex + 2];
  const isDone = currentIndex >= activeSubs.length;

  // Move to next card
  const nextCard = () => {
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
    setQ2AnswerPending(null);
    setDiveMode(null);
    setDiveText('');
    setCurrentIndex(prev => prev + 1);
    translateX.value = 0;
    translateY.value = 0;
  };

  // Enter question mode (called from JS context or runOnJS)
  const enterQuestionMode = (flow: QuestionFlow) => {
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
    setCardMode('question');
  };

  // Phase 5: Generate session summary when all cards are done, and save week completion
  useEffect(() => {
    if (!isDone || Object.keys(sessionResults).length === 0) return;
    if (sessionSummary !== null || loadingSummary) return;

    // Mark this week as done + update streak
    if (user?.id) {
      const weekKey = getWeekStartKey();
      AsyncStorage.setItem(`checkin_week_${user.id}`, weekKey).catch(() => {});
      setCompletedWeekKey(weekKey);

      // Read previous streak and increment if last session was exactly last week
      AsyncStorage.getItem(`checkin_streak_${user.id}`)
        .then(raw => {
          let newCount = 1;
          if (raw) {
            const { count, lastWeekKey } = JSON.parse(raw) as { count: number; lastWeekKey: string };
            if (lastWeekKey === getPrevWeekKey()) newCount = count + 1;
          }
          setStreak(newCount);
          return AsyncStorage.setItem(
            `checkin_streak_${user.id}`,
            JSON.stringify({ count: newCount, lastWeekKey: weekKey }),
          );
        })
        .catch(() => {});
    }

    // Update love streaks: increment for love, reset to 0 for anything else
    const updatedStreaks = { ...loveStreaks };
    Object.entries(sessionResults).forEach(([subId, result]) => {
      updatedStreaks[subId] = result.action === 'love'
        ? (updatedStreaks[subId] ?? 0) + 1
        : 0;
    });
    setLoveStreaks(updatedStreaks);
    if (user?.id) {
      AsyncStorage.setItem(`checkin_love_streak_${user.id}`, JSON.stringify(updatedStreaks)).catch(() => {});
    }

    setLoadingSummary(true);
    const summaries = buildSubSummaries(sessionResults, activeSubs);
    const personaPrefs = persona?.setup_preferences ?? DEFAULT_PERSONA;

    generateSessionSummary(summaries, personaPrefs).then(summary => {
      setSessionSummary(summary);
      setSavedSummary(summary); // available immediately when user returns next time
      setLoadingSummary(false);
      // Persist so it survives app restarts
      if (user?.id) {
        const weekKey = getWeekStartKey();
        AsyncStorage.setItem(
          `checkin_summary_${user.id}_${weekKey}`,
          JSON.stringify(summary),
        ).catch(() => {});
      }
    });
  }, [isDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load last completed week key + saved summary from AsyncStorage
  useEffect(() => {
    if (!user?.id) return;
    AsyncStorage.getItem(`checkin_week_${user.id}`)
      .then(stored => {
        setCompletedWeekKey(stored);
        setWeekStatusLoaded(true);
        // Load saved summary for this week if it exists
        if (stored) {
          AsyncStorage.getItem(`checkin_summary_${user.id}_${stored}`)
            .then(raw => { if (raw) setSavedSummary(JSON.parse(raw)); })
            .catch(() => {});
        }
      })
      .catch(() => setWeekStatusLoaded(true));
  }, [user?.id]);

  // Load ignored subs and love streaks; auto-clean expired ignores
  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      AsyncStorage.getItem(`checkin_ignored_${user.id}`),
      AsyncStorage.getItem(`checkin_love_streak_${user.id}`),
    ]).then(([ignoredRaw, streakRaw]) => {
      if (ignoredRaw) {
        const parsed: IgnoredSub[] = JSON.parse(ignoredRaw);
        const now = new Date();
        const active = parsed.filter(ig => ig.expiresAt === null || new Date(ig.expiresAt) > now);
        setIgnoredSubs(active);
        if (active.length !== parsed.length) {
          AsyncStorage.setItem(`checkin_ignored_${user.id}`, JSON.stringify(active)).catch(() => {});
        }
      }
      if (streakRaw) {
        setLoveStreaks(JSON.parse(streakRaw));
      }
    }).catch(() => {});
  }, [user?.id]);

  // Phase 4: Trigger LLM question generation when entering any question flow
  // Pre-fetch questions for current + next card in background as soon as card appears
  useEffect(() => {
    if (isDone) return;
    const personaPrefs = persona?.setup_preferences ?? DEFAULT_PERSONA;
    const targets = [activeSubs[currentIndex], activeSubs[currentIndex + 1]].filter(Boolean);

    for (const sub of targets) {
      if (!sub) continue;
      const id = sub.id;
      if (!questionCache.current[id]) questionCache.current[id] = {};
      const cache = questionCache.current[id];
      const subInfo = {
        name: sub.name,
        cost: sub.cost,
        billingCycle: (sub as any).billingCycle || (sub as any).billing_cycle || 'monthly',
        category: sub.category,
      };
      if (!cache.love) {
        generateLoveQuestions(subInfo, personaPrefs)
          .then(q => { questionCache.current[id] = { ...questionCache.current[id], love: q }; })
          .catch(() => {});
      }
      if (!cache.review) {
        generateReviewQuestions(subInfo, personaPrefs, [])
          .then(q => { questionCache.current[id] = { ...questionCache.current[id], review: q }; })
          .catch(() => {});
      }
      if (!cache.unsure) {
        generateUnsureQuestions(subInfo, personaPrefs)
          .then(q => { questionCache.current[id] = { ...questionCache.current[id], unsure: q }; })
          .catch(() => {});
      }
    }
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Serve questions from cache (instant) or fetch on demand (fallback)
  useEffect(() => {
    if (cardMode !== 'question' || !questionFlow || !currentSub) return;

    const subInfo = {
      name: currentSub.name,
      cost: currentSub.cost,
      billingCycle: (currentSub as any).billingCycle || (currentSub as any).billing_cycle || 'monthly',
      category: currentSub.category,
    };
    const personaPrefs = persona?.setup_preferences ?? DEFAULT_PERSONA;
    const cache = questionCache.current[currentSub.id] ?? {};

    if (questionFlow === 'review') {
      if (cache.review) { setReviewQuestions(cache.review); return; }
      setLoadingReviewQ(true);
      setReviewQuestions(null);
      generateReviewQuestions(subInfo, personaPrefs, []).then(questions => {
        setReviewQuestions(questions);
        setLoadingReviewQ(false);
      });
    } else if (questionFlow === 'love') {
      if (cache.love) { setLoveQuestions(cache.love); return; }
      setLoadingLoveQ(true);
      setLoveQuestions(null);
      generateLoveQuestions(subInfo, personaPrefs).then(questions => {
        setLoveQuestions(questions);
        setLoadingLoveQ(false);
      });
    } else if (questionFlow === 'unsure') {
      if (cache.unsure) { setUnsureQuestions(cache.unsure); return; }
      setLoadingUnsureQ(true);
      setUnsureQuestions(null);
      generateUnsureQuestions(subInfo, personaPrefs).then(questions => {
        setUnsureQuestions(questions);
        setLoadingUnsureQ(false);
      });
    }
  }, [questionFlow, cardMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle swipe completion — all directions enter question mode
  const handleSwipeComplete = (direction: 'left' | 'right' | 'down') => {
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    if (direction === 'right') {
      runOnJS(enterQuestionMode)('love');
    } else if (direction === 'left') {
      runOnJS(enterQuestionMode)('review');
    } else {
      runOnJS(enterQuestionMode)('unsure');
    }
  };

  // Pan gesture
  const panGesture = Gesture.Pan()
    .enabled(cardMode === 'card')
    .onUpdate(e => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd(e => {
      if (e.translationX > SWIPE_THRESHOLD) {
        runOnJS(handleSwipeComplete)('right');
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        runOnJS(handleSwipeComplete)('left');
      } else if (e.translationY > SWIPE_THRESHOLD) {
        runOnJS(handleSwipeComplete)('down');
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  // Animated card style
  const animatedCardStyle = useAnimatedStyle(() => {
    const rotation = interpolate(translateX.value, [-width, 0, width], [-15, 0, 15]);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  // Avatar animated style
  const animatedAvatarStyle = useAnimatedStyle(() => {
    const progressX = translateX.value / SWIPE_THRESHOLD;
    const progressY = translateY.value / SWIPE_THRESHOLD;

    let scale = 1;
    let translateYValue = 0;

    if (progressX < -0.2) {
      const severity = Math.abs(progressX);
      scale = 1 - severity * 0.15;
      translateYValue = severity * 8;
    } else if (progressX > 0.2) {
      const severity = progressX;
      scale = 1 + severity * 0.25;
      translateYValue = -severity * 12;
    } else if (progressY > 0.3) {
      const severity = progressY;
      scale = 1 - severity * 0.05;
      translateYValue = severity * 4;
    }

    return {
      transform: [{ scale }, { translateY: translateYValue }],
    };
  });

  // Swipe indicator opacity
  const rightIndicatorOpacity = useAnimatedStyle(() => ({
    opacity: Math.max(0, (translateX.value - 50) / 100),
  }));
  const leftIndicatorOpacity = useAnimatedStyle(() => ({
    opacity: Math.max(0, (-translateX.value - 50) / 100),
  }));
  const downIndicatorOpacity = useAnimatedStyle(() => ({
    opacity: Math.max(0, (translateY.value - 50) / 100),
  }));

  // Trigger action from footer buttons
  const triggerAction = (action: 'review' | 'unsure' | 'love') => {
    enterQuestionMode(action);
  };

  // Submit feedback to backend and advance to next card
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
      await submitCheckInFeedback({
        subId,
        action,
        step1Reason: step1,
        step2Reason: step2,
        diveDeeperNote: diveNote,
      });
    } catch (e) {
      // silent fail — check-in data is best-effort
    } finally {
      setIsSubmitting(false);
    }
    // Track for session summary regardless of backend success
    setSessionResults(prev => ({
      ...prev,
      [subId]: { action, q1: step1, q2: step2, diveNote },
    }));
    nextCard();
  }, [currentSub, submitCheckInFeedback]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Q1 option selection
  const handleQ1Select = async (key: string) => {
    if (isSubmitting || !questionFlow) return;
    if (questionFlow === 'love') {
      // 1-step flow: submit and advance (no dive deeper for love)
      await submitFeedback('love', key, null, null);
    } else {
      // 2-step flow: advance to Q2
      setQ1Answer(key);
      setQuestionStep(1);
    }
  };

  // Handle Q2 option selection — show dive deeper prompt instead of submitting immediately
  const handleQ2Select = (key: string) => {
    if (isSubmitting || !questionFlow) return;
    setQ2AnswerPending(key);
    setDiveMode('prompt');
  };

  // Skip dive deeper — submit with no note
  const handleNextSub = () => {
    if (isSubmitting || !questionFlow) return;
    void submitFeedback(questionFlow as CheckInAction, q1Answer, q2AnswerPending, null);
  };

  // Expand text input
  const handleDiveDeeperOpen = () => {
    setDiveMode('input');
  };

  // Submit with free-text note
  const handleDiveSubmit = () => {
    if (isSubmitting || !questionFlow) return;
    void submitFeedback(questionFlow as CheckInAction, q1Answer, q2AnswerPending, diveText.trim() || null);
  };

  // Ignore: user picks a duration — save to ignored list and record love feedback
  const handleIgnoreSelect = async (durationDays: number | null, durationLabel: string) => {
    if (!currentSub || isSubmitting) return;
    const now = new Date();
    const newIgnored: IgnoredSub = {
      subId: currentSub.id,
      subName: currentSub.name,
      iconEmoji: (currentSub as any).iconEmoji || (currentSub as any).icon_emoji || '📱',
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
      AsyncStorage.setItem(`checkin_ignored_${user.id}`, JSON.stringify(updated)).catch(() => {});
    }
    await submitFeedback('love', null, null, null);
  };

  // Ignore: user chooses "Keep asking me" — fall back to normal love question
  const handleKeepAsking = () => {
    setCardMode('question');
  };

  // Ignore: user skips the ignore screen entirely — record love and move on
  const handleSkipIgnore = () => {
    void submitFeedback('love', null, null, null);
  };

  // Archive: resume a subscription from ignore list
  const handleResumeIgnore = (subId: string) => {
    const updated = ignoredSubs.filter(ig => ig.subId !== subId);
    setIgnoredSubs(updated);
    if (user?.id) {
      AsyncStorage.setItem(`checkin_ignored_${user.id}`, JSON.stringify(updated)).catch(() => {});
    }
  };

  // True once AsyncStorage is loaded and confirms this week is already done
  const isAlreadyDoneThisWeek = weekStatusLoaded && completedWeekKey === getWeekStartKey();

  // Compute question content for current flow/step — all flows use LLM questions with static fallbacks
  const qContent = useMemo(() => {
    if (!questionFlow) return null;

    if (questionFlow === 'love') {
      const lq = loveQuestions ?? FALLBACK_LOVE_QUESTIONS;
      return {
        icon: 'heart',
        iconColor: colors.success,
        bgColor: colors.success + '20',
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
          iconColor: colors.danger,
          bgColor: colors.danger + '20',
          title: rq.q1.text,
          subtitle: currentSub?.name ?? '',
          options: rq.q1.options,
        };
      } else {
        const q2 = q1Answer ? rq.q2Map[q1Answer] : null;
        if (!q2) return null;
        return {
          icon: 'bulb-outline',
          iconColor: colors.warning,
          bgColor: colors.warning + '20',
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
          iconColor: colors.primary,
          bgColor: colors.primary + '20',
          title: uq.q1.text,
          subtitle: currentSub?.name ?? '',
          options: uq.q1.options,
        };
      } else {
        const q2 = q1Answer ? uq.q2Map[q1Answer] : null;
        if (!q2) return null;
        return {
          icon: 'hand-left-outline',
          iconColor: colors.primary,
          bgColor: colors.primary + '20',
          title: q2.text,
          subtitle: currentSub?.name ?? '',
          options: q2.options,
        };
      }
    }

    return null;
  }, [questionFlow, questionStep, q1Answer, reviewQuestions, loveQuestions, unsureQuestions, currentSub]);

  // Renders the post-session summary cards (used in done screen + already-done screen)
  const renderSummaryCards = (summary: SessionSummary) => (
    <>
      {/* Profile updated */}
      {summary.personaChanges.length > 0 && (
        <View style={styles.reportCard}>
          <View style={styles.cardLabel}>
            <Ionicons name="person-circle-outline" size={12} color={colors.primary} />
            <Text style={styles.cardLabelText}>Your Profile Updated</Text>
          </View>
          {summary.personaChanges.map((line, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Insights + Looking Good in one card */}
      {(summary.suggestions.length > 0 || summary.healthy.length > 0) && (
        <View style={styles.reportCard}>
          {summary.suggestions.length > 0 && (
            <>
              <View style={styles.cardLabel}>
                <Ionicons name="bulb-outline" size={12} color={colors.warning} />
                <Text style={styles.cardLabelText}>This Week</Text>
              </View>
              {summary.suggestions.map(item => {
                const note = summary.flagged.find(f => f.subId === item.subId)?.note ?? '';
                const actionLabel = item.action === 'watch' ? 'Consider watching 👀' : `Consider ${item.action}ing`;
                return (
                  <Pressable
                    key={item.subId}
                    style={styles.insightRow}
                    onPress={() => navigation.navigate('SubscriptionDetail', { subscriptionId: item.subId })}
                  >
                    <View style={styles.insightRowBody}>
                      <Text style={styles.insightRowName}>{item.name}</Text>
                      {!!note && <Text style={styles.insightRowNote}>{note}</Text>}
                      <Text style={styles.insightRowAction}>{actionLabel}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                  </Pressable>
                );
              })}
            </>
          )}

          {summary.healthy.length > 0 && (
            <View style={summary.suggestions.length > 0 ? styles.cardSection : undefined}>
              <View style={styles.cardLabel}>
                <Ionicons name="checkmark-circle-outline" size={12} color={colors.success} />
                <Text style={styles.cardLabelText}>Looking Good</Text>
              </View>
              {summary.healthy.map((name, i) => (
                <View key={i} style={styles.healthyRow}>
                  <Text style={styles.healthyDot}>✓</Text>
                  <Text style={styles.healthyText}>{name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </>
  );

  // No active subscriptions — prompt user to add some
  if (activeSubs.length === 0) {
    return (
      <View style={[styles.container, styles.containerCenter, { paddingTop: insets.top }]}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="list-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Nothing to review yet</Text>
        <Text style={styles.emptySubtitle}>
          Add your subscriptions in Manager first, then come back to check in.
        </Text>
        <Pressable
          style={styles.emptyButton}
          onPress={() => (navigation as any).navigate('Manager')}
        >
          <Ionicons name="add-circle-outline" size={18} color="white" />
          <Text style={styles.emptyButtonText}>Go to Manager</Text>
        </Pressable>
      </View>
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
        <View style={[styles.container, styles.containerCenter]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyText, { marginTop: spacing.md }]}>Generating report...</Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={styles.doneScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Celebration header */}
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={48} color="white" />
          </View>
          <Text style={styles.doneTitle}>Week {streak} Complete! 🎉</Text>
          {streak > 1 && (
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={13} color={colors.warning} />
              <Text style={styles.streakText}>{streak} weeks in a row</Text>
            </View>
          )}

          {sessionSummary
            ? renderSummaryCards(sessionSummary)
            : <Text style={styles.doneText}>All subscriptions reviewed.{'\n'}See you next week!</Text>
          }

          <Pressable style={styles.doneButton} onPress={handleDoneReset}>
            <Text style={styles.doneButtonText}>Back to Home</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // Already completed this week — show "come back next week" screen
  if (isAlreadyDoneThisWeek) {
    const nextSunday = new Date();
    const daysUntil = ((7 - nextSunday.getDay()) % 7) || 7;
    nextSunday.setDate(nextSunday.getDate() + daysUntil);
    const nextWeekStr = nextSunday.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

    const handleResetWeek = async () => {
      if (user?.id) {
        await AsyncStorage.removeItem(`checkin_week_${user.id}`).catch(() => {});
      }
      setCompletedWeekKey(null);
      setCurrentIndex(0);
      setSessionResults({});
      setSessionSummary(null);
    };

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.doneScrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.doneIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="calendar-outline" size={48} color="white" />
          </View>
          <Text style={styles.doneTitle}>Week Complete</Text>
          <View style={styles.weekDoneNextRow}>
            <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.weekDoneNextText}>Next check-in on {nextWeekStr}</Text>
          </View>

          {savedSummary && renderSummaryCards(savedSummary)}

          <Pressable style={styles.devResetButton} onPress={handleResetWeek}>
            <Text style={styles.devResetText}>🛠 Reset for testing</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (!currentSub) {
    return (
      <View style={[styles.container, styles.containerCenter]}>
        <Text style={styles.emptyText}>No active subscriptions to review</Text>
      </View>
    );
  }

  const usageScore = (currentSub as any).usageScore ?? (currentSub as any).usage_score;
  const signalInfo = (() => {
    if (usageScore === undefined || usageScore === null) {
      return { label: 'No signals yet', color: colors.gray400, bg: colors.gray100 };
    }
    if (usageScore >= 70) return { label: '♥  Loving it', color: colors.success, bg: colors.success + '18' };
    if (usageScore >= 45) return { label: '◐  Mixed signals', color: colors.warning, bg: colors.warning + '18' };
    return { label: '○  On the fence', color: colors.danger, bg: colors.danger + '18' };
  })();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        {ignoredSubs.length > 0 ? (
          <Pressable style={styles.archiveButton} onPress={() => setShowArchive(true)}>
            <Ionicons name="archive-outline" size={22} color={colors.textSecondary} />
            <View style={styles.archiveBadge}>
              <Text style={styles.archiveBadgeText}>{ignoredSubs.length}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Text style={styles.headerTitle}>CHECK-IN</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>
            {currentIndex + 1} / {activeSubs.length}
          </Text>
        </View>
      </View>

      {/* Card Stack Area */}
      <View style={styles.cardArea}>
        {/* Background cards */}
        {nextNextSub && (
          <View style={[styles.cardStack, styles.cardStackFar]} />
        )}
        {nextSub && (
          <View style={[styles.cardStack, styles.cardStackNear]}>
            <View style={styles.cardStackHeader} />
          </View>
        )}

        {/* Current card */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.card, animatedCardStyle]}>
            {cardMode === 'card' ? (
              <>
                {/* Avatar — shows subscription emoji */}
                <Animated.View style={[styles.avatarContainer, animatedAvatarStyle]}>
                  <View style={[styles.avatar, { borderColor: currentSub.color }]}>
                    <Text style={styles.avatarText}>
                      {(currentSub as any).iconEmoji || (currentSub as any).icon_emoji || '📱'}
                    </Text>
                  </View>
                </Animated.View>

                {/* Colored accent band at card top */}
                <View style={[styles.cardAccentBand, { backgroundColor: currentSub.color + '22' }]} />

                {/* Swipe indicators */}
                <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorRight, rightIndicatorOpacity]}>
                  <Text style={[styles.swipeIndicatorText, { color: colors.success }]}>♥ LOVE IT</Text>
                </Animated.View>
                <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorLeft, leftIndicatorOpacity]}>
                  <Text style={[styles.swipeIndicatorText, { color: colors.danger }]}>✕ REVIEW</Text>
                </Animated.View>
                <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorDown, downIndicatorOpacity]}>
                  <Text style={[styles.swipeIndicatorText, { color: colors.primary }]}>? UNSURE</Text>
                </Animated.View>

                {/* Card content */}
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{currentSub.name}</Text>
                  <Text style={styles.cardPlanLabel}>
                    {((currentSub as any).planName || (currentSub as any).plan_name || 'Standard').toUpperCase()}
                  </Text>
                  <View style={styles.cardPriceRow}>
                    <Text style={styles.cardPrice}>${currentSub.cost}</Text>
                    <Text style={styles.cardPricePeriod}>
                      /{(currentSub as any).billingCycle || (currentSub as any).billing_cycle || 'mo'}
                    </Text>
                  </View>
                </View>

                {/* Signal badge */}
                <View style={styles.cardFooter}>
                  <Text style={styles.trendLabel}>LAST SIGNAL</Text>
                  <View style={[styles.signalBadge, { backgroundColor: signalInfo.bg }]}>
                    <Text style={[styles.signalBadgeText, { color: signalInfo.color }]}>
                      {signalInfo.label}
                    </Text>
                  </View>
                </View>
              </>
            ) : cardMode === 'ignore' ? (
              // Ignore mode: offer skip durations
              <View style={styles.questionContainer}>
                <View style={styles.questionHeader}>
                  <Pressable
                    style={styles.questionBackButton}
                    onPress={() => setCardMode('card')}
                  >
                    <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
                  </Pressable>
                  <View style={{ flex: 1 }} />
                  <View style={{ width: 40 }} />
                </View>
                <View style={styles.questionContent}>
                  <View style={styles.questionStepContainer}>
                    <View style={[styles.questionIcon, { backgroundColor: colors.success + '20' }]}>
                      <Ionicons name="heart" size={32} color={colors.success} />
                    </View>
                    <Text style={styles.questionTitle}>You've loved this{'\n'}for weeks!</Text>
                    <Text style={styles.questionSubtitle}>{currentSub?.name}</Text>
                    <View style={styles.questionOptions}>
                      {IGNORE_DURATIONS.map(opt => (
                        <Pressable
                          key={opt.label}
                          style={[styles.questionOption, isSubmitting && styles.questionOptionDisabled]}
                          disabled={isSubmitting}
                          onPress={() => void handleIgnoreSelect(opt.days, opt.label)}
                        >
                          <Text style={styles.questionOptionText}>Skip for {opt.label}</Text>
                          <Ionicons name="arrow-forward" size={18} color={colors.primary} />
                        </Pressable>
                      ))}
                    </View>
                    <View style={styles.ignoreFooterRow}>
                      <Pressable style={styles.keepAskingButton} onPress={handleKeepAsking}>
                        <Text style={styles.keepAskingText}>Keep asking me</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.keepAskingButton, isSubmitting && styles.questionOptionDisabled]}
                        disabled={isSubmitting}
                        onPress={handleSkipIgnore}
                      >
                        <Text style={[styles.keepAskingText, { color: colors.textTertiary }]}>Skip</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              // Question mode
              (loadingReviewQ || loadingLoveQ || loadingUnsureQ) ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator
                    size="large"
                    color={
                      questionFlow === 'love' ? colors.success
                      : questionFlow === 'review' ? colors.danger
                      : colors.primary
                    }
                  />
                  <Text style={styles.loadingText}>Generating questions...</Text>
                </View>
              ) : qContent && (
                <View style={styles.questionContainer}>
                  {/* Header: back button + stepper */}
                  <View style={styles.questionHeader}>
                    <Pressable
                      style={styles.questionBackButton}
                      onPress={() => {
                        if (diveMode === 'input') {
                          setDiveMode('prompt');
                        } else if (diveMode === 'prompt') {
                          setDiveMode(null);
                          setQ2AnswerPending(null);
                        } else if (questionStep > 0) {
                          setQuestionStep(0);
                          setQ1Answer(null);
                        } else {
                          setCardMode('card');
                          setQuestionFlow(null);
                        }
                      }}
                    >
                      <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
                    </Pressable>
                    <View style={styles.questionStepper}>
                      <View style={[styles.questionDot, questionStep === 0 && styles.questionDotActive]} />
                      {questionFlow !== 'love' && (
                        <View style={[styles.questionDot, questionStep === 1 && styles.questionDotActive]} />
                      )}
                    </View>
                    <View style={{ width: 40 }} />
                  </View>

                  {/* Question content */}
                  <View style={styles.questionContent}>
                    <View style={styles.questionStepContainer}>
                      {diveMode === 'prompt' ? (
                        // Dive deeper prompt: two-button choice
                        <>
                          <View style={[styles.questionIcon, { backgroundColor: colors.success + '20' }]}>
                            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
                          </View>
                          <Text style={styles.questionTitle}>Got it!</Text>
                          <Text style={styles.questionSubtitle}>Anything specific you'd like to add?</Text>
                          <View style={styles.diveButtonGroup}>
                            <Pressable
                              style={[styles.diveNextButton, isSubmitting && styles.questionOptionDisabled]}
                              disabled={isSubmitting}
                              onPress={handleNextSub}
                            >
                              <Text style={styles.diveNextText}>Next subscription</Text>
                              <Ionicons name="arrow-forward" size={16} color="white" />
                            </Pressable>
                            <Pressable
                              style={styles.diveTellMoreButton}
                              disabled={isSubmitting}
                              onPress={handleDiveDeeperOpen}
                            >
                              <Text style={styles.diveTellMoreText}>Tell me more...</Text>
                            </Pressable>
                          </View>
                        </>
                      ) : diveMode === 'input' ? (
                        // Dive deeper text input
                        <>
                          <TextInput
                            style={styles.diveTextInput}
                            placeholder="Anything specific? (optional)"
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            maxLength={500}
                            value={diveText}
                            onChangeText={setDiveText}
                            autoFocus
                          />
                          <Text style={styles.diveCharCount}>{diveText.length} / 500</Text>
                          <View style={styles.diveInputButtons}>
                            <Pressable
                              style={[styles.diveSubmitButton, isSubmitting && styles.questionOptionDisabled]}
                              disabled={isSubmitting}
                              onPress={handleDiveSubmit}
                            >
                              {isSubmitting
                                ? <ActivityIndicator size="small" color="white" />
                                : <Text style={styles.diveSubmitText}>Submit</Text>
                              }
                            </Pressable>
                            <Pressable
                              style={styles.diveSkipButton}
                              disabled={isSubmitting}
                              onPress={handleNextSub}
                            >
                              <Text style={styles.diveSkipText}>Skip</Text>
                            </Pressable>
                          </View>
                        </>
                      ) : (
                        // Normal question options
                        <>
                          <View style={[styles.questionIcon, { backgroundColor: qContent.bgColor }]}>
                            <Ionicons
                              name={qContent.icon as any}
                              size={32}
                              color={qContent.iconColor}
                            />
                          </View>
                          <Text style={styles.questionTitle} numberOfLines={3} adjustsFontSizeToFit>{qContent.title}</Text>
                          <Text style={styles.questionSubtitle}>{qContent.subtitle}</Text>
                          <View style={styles.questionOptions}>
                            {qContent.options.map((opt, optIdx) => (
                              <Pressable
                                key={`${opt.key}_${optIdx}`}
                                style={[styles.questionOption, isSubmitting && styles.questionOptionDisabled]}
                                disabled={isSubmitting}
                                onPress={() => {
                                  if (questionStep === 0) {
                                    void handleQ1Select(opt.key);
                                  } else {
                                    handleQ2Select(opt.key);
                                  }
                                }}
                              >
                                <Text style={styles.questionOptionText}>{opt.label}</Text>
                                <Ionicons name="arrow-forward" size={18} color={colors.primary} />
                              </Pressable>
                            ))}
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              )
            )}
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Footer Controls */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.controlsContainer}>
          <Pressable style={styles.controlButton} onPress={() => triggerAction('review')}>
            <View style={[styles.controlButtonCircle, styles.controlButtonDanger]}>
              <Ionicons name="close" size={32} color={colors.danger} />
            </View>
            <Text style={styles.controlButtonLabel}>Review</Text>
          </Pressable>

          <Pressable style={[styles.controlButton, styles.controlButtonSmall]} onPress={() => triggerAction('unsure')}>
            <View style={[styles.controlButtonCircle, styles.controlButtonSmallCircle]}>
              <Ionicons name="arrow-down" size={20} color={colors.textSecondary} />
            </View>
            <Text style={styles.controlButtonLabel}>Maybe</Text>
          </Pressable>

          <Pressable style={styles.controlButton} onPress={() => triggerAction('love')}>
            <View style={[styles.controlButtonCircle, styles.controlButtonPrimary]}>
              <Ionicons name="heart" size={32} color="white" />
            </View>
            <Text style={styles.controlButtonLabel}>Keep It</Text>
          </Pressable>
        </View>
      </View>

      {/* Archive Modal */}
      <Modal
        visible={showArchive}
        animationType="slide"
        transparent
        onRequestClose={() => setShowArchive(false)}
      >
        <View style={styles.archiveOverlay}>
          <View style={styles.archiveSheet}>
            <View style={styles.archiveSheetHeader}>
              <Text style={styles.archiveSheetTitle}>Ignored Subscriptions</Text>
              <Pressable onPress={() => setShowArchive(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ignoredSubs.map(ig => {
                const daysLeft = ig.expiresAt
                  ? Math.max(0, Math.ceil((new Date(ig.expiresAt).getTime() - Date.now()) / 86400000))
                  : null;
                return (
                  <View key={ig.subId} style={styles.archiveItem}>
                    <View style={[styles.archiveItemAvatar, { borderColor: ig.color }]}>
                      <Text style={styles.archiveItemEmoji}>{ig.iconEmoji}</Text>
                    </View>
                    <View style={styles.archiveItemInfo}>
                      <Text style={styles.archiveItemName}>{ig.subName}</Text>
                      <Text style={styles.archiveItemMeta}>
                        {daysLeft === null
                          ? 'Permanent'
                          : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.resumeButton}
                      onPress={() => handleResumeIgnore(ig.subId)}
                    >
                      <Text style={styles.resumeButtonText}>Resume</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  containerCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerSpacer: {
    width: 64,
    height: 40,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    letterSpacing: 1.6,
  },
  headerBadge: {
    minWidth: 64,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.full,
  },
  headerBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black as any,
    color: colors.primary,
    letterSpacing: 0.5,
  },

  // Card Area
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card Stack
  cardStack: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: 'white',
    borderRadius: borderRadius.xxl,
    borderWidth: 1,
    borderColor: colors.gray[100],
    ...shadows.sm,
  },
  cardStackFar: {
    transform: [{ scale: 0.85 }, { translateY: 12 }],
    opacity: 0.4,
  },
  cardStackNear: {
    transform: [{ scale: 0.92 }, { translateY: 6 }],
    opacity: 0.7,
  },
  cardStackHeader: {
    width: '100%',
    height: 96,
    backgroundColor: colors.gray[50],
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
  },

  // Card
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: 'white',
    borderRadius: borderRadius.xxl,
    borderWidth: 1,
    borderColor: colors.gray[100],
    ...shadows.xl,
    overflow: 'hidden',
  },
  cardAccentBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 96,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
  },

  // Avatar
  avatarContainer: {
    position: 'absolute',
    top: spacing.xl,
    alignSelf: 'center',
    zIndex: 40,
  },
  avatar: {
    width: Math.round(72 * CARD_SCALE),
    height: Math.round(72 * CARD_SCALE),
    borderRadius: Math.round(36 * CARD_SCALE),
    backgroundColor: 'white',
    borderWidth: 3,
    borderColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  avatarText: {
    fontSize: Math.round(36 * CARD_SCALE),
  },

  // Swipe Indicators
  swipeIndicator: {
    position: 'absolute',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 3,
    borderRadius: borderRadius.md,
    zIndex: 50,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  swipeIndicatorRight: {
    top: spacing.xl * 2,
    left: spacing.lg,
    borderColor: colors.success,
    transform: [{ rotate: '-15deg' }],
  },
  swipeIndicatorLeft: {
    top: spacing.xl * 2,
    right: spacing.lg,
    borderColor: colors.danger,
    transform: [{ rotate: '15deg' }],
  },
  swipeIndicatorDown: {
    bottom: spacing.xl * 2,
    alignSelf: 'center',
    borderColor: colors.primary,
  },
  swipeIndicatorText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.black as any,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Card Content
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Math.round(spacing.xl * 3 * CARD_SCALE),
    paddingHorizontal: spacing.lg,
  },
  cardTitle: {
    fontSize: Math.round(fontSize.xxxl * CARD_SCALE),
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  cardPlanLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black as any,
    color: colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: Math.round(spacing.lg * CARD_SCALE),
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  cardPrice: {
    fontSize: Math.round(fontSize.xxxxl * CARD_SCALE),
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    letterSpacing: -2,
  },
  cardPricePeriod: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },

  // Card Footer
  cardFooter: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  trendLabel: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.black as any,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  signalBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  signalBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as any,
    letterSpacing: 0.3,
  },

  // Loading (review LLM generation)
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Question Mode
  questionContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  questionBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionStepper: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  questionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray[200],
  },
  questionDotActive: {
    width: 16,
    backgroundColor: colors.primary,
  },
  questionContent: {
    flex: 1,
  },
  questionStepContainer: {
    alignItems: 'center',
  },
  questionIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  questionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  questionSubtitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black as any,
    color: colors.textTertiary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  questionOptions: {
    width: '100%',
    gap: spacing.sm,
  },
  questionOption: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  questionOptionDisabled: {
    opacity: 0.5,
  },
  questionOptionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
  },

  // Dive Deeper
  diveButtonGroup: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  diveNextButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
  },
  diveNextText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: 'white',
  },
  diveTellMoreButton: {
    width: '100%',
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  diveTellMoreText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  diveTextInput: {
    width: '100%',
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    backgroundColor: colors.gray[50],
  },
  diveCharCount: {
    alignSelf: 'flex-end',
    fontSize: fontSize.xxs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  diveInputButtons: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  diveSubmitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
  },
  diveSubmitText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: 'white',
  },
  diveSkipButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  diveSkipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Footer Controls
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  controlButton: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  controlButtonSmall: {
    marginTop: spacing.md,
  },
  controlButtonCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  controlButtonSmallCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  controlButtonDanger: {
    backgroundColor: colors.danger + '10',
    borderColor: colors.danger + '30',
  },
  controlButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.primaryShadow,
  },
  controlButtonLabel: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.black as any,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // Done Screen
  // ── Done screen layout ──────────────────────────────────────────
  doneScrollContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  doneText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  doneButton: {
    width: '100%',
    height: 52,
    backgroundColor: colors.textPrimary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  doneButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold as any,
    color: 'white',
    letterSpacing: 0.2,
  },

  // ── Streak badge ────────────────────────────────────────────────
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.warning + '18',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  streakText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
    color: colors.warning,
  },

  // ── Unified report card ─────────────────────────────────────────
  reportCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.sm,
  },
  cardLabelText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black as any,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  cardSection: {
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    marginTop: 0,
    paddingTop: spacing.md,
  },

  // ── Profile updated bullets ─────────────────────────────────────
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: 6,
  },
  bulletDot: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.black as any,
    lineHeight: 18,
    width: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // ── Insight rows (This Week) ────────────────────────────────────
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  insightRowBody: {
    flex: 1,
    gap: 4,
  },
  insightRowName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
  },
  insightRowNote: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  insightRowAction: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold as any,
  },

  // ── Looking Good ────────────────────────────────────────────────
  healthyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  healthyDot: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: fontWeight.bold as any,
  },
  healthyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },


  // Week Done Screen
  weekDoneSubtitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  weekDoneNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  weekDoneNextText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black as any,
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  devResetButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderStyle: 'dashed',
  },
  devResetText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },

  // Archive button (header left)
  archiveButton: {
    width: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  archiveBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  archiveBadgeText: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.black as any,
    color: 'white',
  },

  // Keep asking me / Skip row (ignore mode)
  ignoreFooterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  keepAskingButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  keepAskingText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },

  // Archive Modal
  archiveOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  archiveSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    maxHeight: '70%',
  },
  archiveSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    marginBottom: spacing.sm,
  },
  archiveSheetTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  archiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: spacing.md,
  },
  archiveItemAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  archiveItemEmoji: {
    fontSize: 22,
  },
  archiveItemInfo: {
    flex: 1,
    gap: 2,
  },
  archiveItemName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
    color: colors.textPrimary,
  },
  archiveItemMeta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium as any,
  },
  resumeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  resumeButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as any,
    color: colors.primary,
  },

  // Empty State
  emptyText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    ...shadows.primaryShadow,
  },
  emptyButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
    color: 'white',
  },
});
