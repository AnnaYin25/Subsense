import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Share,
  Alert,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { useSubscriptions } from '@/contexts/SubscriptionContext';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/styles';
import type { Subscription } from '@/types';
import {
  getRecentCheckinResponses,
  type CheckinResponseRecord,
} from '@/utils/database';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type StatusLevel = 'Excellent' | 'Good' | 'Needs Improvement' | 'Critical';

type DimensionKey =
  | 'budget_health'
  | 'usage_efficiency'
  | 'subscription_health'
  | 'cancellation_timeliness'
  | 'cost_optimization';

interface DimensionScore {
  key: DimensionKey;
  label: string;
  weight: number;
  score: number;
}

interface WastedSub {
  id: string;
  name: string;
  icon: string;
  costMonthly: number;
  usage: number;
  wasteScore: number;
  indicator: string;
}

interface MonthlyReportView {
  monthKey: string;
  monthLabel: string;
  overallScore: number;
  status: StatusLevel;
  statusColor: string;
  totalSpend: number;
  budgetDelta: number;
  budgetStatusText: string;
  activeCount: number;
  subsAdded: number;
  subsCancelled: number;
  dimensions: DimensionScore[];
  topWasted: WastedSub[];
  suggestions: string[];
}

const CATEGORY_TARGETS: Record<string, number> = {
  Entertainment: 25,
  Productivity: 25,
  Utilities: 25,
  Health: 25,
};

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  budget_health: '💰 Budget vs Spend',
  usage_efficiency: '😊 Satisfaction',
  subscription_health: '✅ Sub Health',
  cancellation_timeliness: '🧹 Cleanup Speed',
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
  budget_health: 25,
  usage_efficiency: 25,
  subscription_health: 25,
  cancellation_timeliness: 15,
  cost_optimization: 10,
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const getMonthlyBudget = (user: any): number => {
  const budget = Number(user?.monthly_budget ?? user?.monthlyBudget ?? 0);
  return Number.isFinite(budget) && budget > 0 ? budget : 100;
};

const getSubCreatedAt = (sub: any): string | undefined => sub?.created_at ?? sub?.createdAt;
const getSubUpdatedAt = (sub: any): string | undefined => sub?.updated_at ?? sub?.updatedAt ?? sub?.created_at ?? sub?.createdAt;
const getSubIcon = (sub: any): string => String(sub?.icon_emoji ?? sub?.iconEmoji ?? '🧾');
const getSubBillingCycle = (sub: any): string => String(sub?.billing_cycle ?? sub?.billingCycle ?? 'monthly');
const getSubReminderFlag = (sub: any): boolean => Boolean(sub?.is_reminder ?? sub?.isReminder);

const normalizeMonthlyCost = (sub: Subscription): number => {
  const cost = Number(sub.cost) || 0;
  switch (getSubBillingCycle(sub)) {
    case 'daily':
      return cost * 30;
    case 'weekly':
      return cost * 4;
    case 'quarterly':
      return cost / 3;
    case 'yearly':
      return cost / 12;
    case 'monthly':
    default:
      return cost;
  }
};

const formatMonth = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);

const formatShortMonth = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);

const toMonthKey = (dateStr: string) => {
  const date = new Date(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const buildTrendPath = (points: number[], width: number, height: number) => {
  if (points.length === 0) return { path: '', circles: [] as Array<{ x: number; y: number }> };

  const minPadding = 16;
  const usableWidth = width - minPadding * 2;
  const usableHeight = height - 20;
  const xStep = points.length > 1 ? usableWidth / (points.length - 1) : 0;

  const circles = points.map((score, index) => {
    const x = minPadding + index * xStep;
    const y = 10 + ((100 - clamp(score)) / 100) * usableHeight;
    return { x, y };
  });

  const path = circles
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return { path, circles };
};

const getDimensionColor = (score: number) => {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  if (score >= 40) return '#F97316';
  return colors.danger;
};

const getOptimizationLabel = (score: number) => {
  if (score < 50) return 'Needs Attention';
  if (score < 80) return 'Moderately Optimized';
  return 'Well Optimized';
};

const getScoreAccent = (score: number) => {
  if (score < 50) return colors.danger;
  if (score < 80) return colors.warning;
  return colors.success;
};

const IOS_COLORS = {
  label: '#000000',
  secondaryLabel: '#6E6E73',
  separator: '#E5E5EA',
  systemGreen: '#34C759',
  systemOrange: '#FF9F0A',
  systemRed: '#FF3B30',
  background: '#FFFFFF',
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const size = 208;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = clamp(score);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: clampedScore,
      duration: 680,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clampedScore, progress]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const ringColor =
    clampedScore < 50
      ? IOS_COLORS.systemRed
      : clampedScore < 80
        ? IOS_COLORS.systemOrange
        : IOS_COLORS.systemGreen;

  return (
    <View style={styles.scoreRingWrap}>
      <Svg width={size} height={size} style={styles.scoreRingSvg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={IOS_COLORS.separator}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </Svg>
      <View style={styles.scoreRingCenter}>
        <Text style={styles.scoreRingValue}>{clampedScore}</Text>
      </View>
    </View>
  );
};

const humanizeInsight = (text: string) => {
  const plain = text.trim();
  if (!plain) return plain;
  const lower = plain.toLowerCase();

  if (lower.includes('entertainment is')) {
    return "You're spending heavily on entertainment.\nTry balancing with productivity or utility tools.";
  }
  if (lower.includes('lower usage relative to its monthly cost')) {
    return 'Usage is low relative to cost.\nReview this subscription before the next billing cycle.';
  }
  if (lower.includes('canceled')) {
    return 'You took action on low-value subscriptions.\nKeep doing this to protect your budget.';
  }
  if (lower.includes('below your target budget mix')) {
    return 'This category still has room in your budget.\nOnly add tools that clearly support your routine.';
  }

  return plain.replace('. ', '.\n');
};

export const ReportScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useScreenInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { subscriptions, user } = useSubscriptions();

  const [checkinResponses, setCheckinResponses] = useState<CheckinResponseRecord[]>([]);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const shareCardRef = useRef<View>(null);

  const monthlyBudget = useMemo(() => getMonthlyBudget(user), [user]);

  const activeSubs = useMemo(
    () => subscriptions.filter(sub => sub.status === 'active'),
    [subscriptions]
  );

  const cancelledSubs = useMemo(
    () => subscriptions.filter(sub => sub.status === 'cancelled'),
    [subscriptions]
  );

  const loadCheckinResponses = useCallback(async () => {
    if (!user?.id) {
      setCheckinResponses([]);
      setCheckinLoading(false);
      return;
    }

    setCheckinLoading(true);
    const rows = await getRecentCheckinResponses(user.id, 6);
    setCheckinResponses(rows);
    setCheckinLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadCheckinResponses().catch(error => {
      console.error('Failed to load check-in responses:', error);
      setCheckinLoading(false);
    });
  }, [loadCheckinResponses]);

  useFocusEffect(
    useCallback(() => {
      loadCheckinResponses().catch(error => {
        console.error('Failed to refresh check-in responses on focus:', error);
        setCheckinLoading(false);
      });
    }, [loadCheckinResponses])
  );

  const completedCheckinsCount = useMemo(
    () => new Set(checkinResponses.map(row => row.checkin_id)).size,
    [checkinResponses]
  );

  const computedReportHistory = useMemo<MonthlyReportView[]>(() => {
    const now = new Date();

    const createdDates = subscriptions
      .map(getSubCreatedAt)
      .map(dateStr => (dateStr ? new Date(dateStr) : null))
      .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()));

    const checkinDates = checkinResponses
      .map(row => new Date(row.checkin_date))
      .filter(date => !Number.isNaN(date.getTime()));

    const oldestSourceDate =
      [...createdDates, ...checkinDates].length > 0
        ? [...createdDates, ...checkinDates].reduce((min, d) => (d < min ? d : min))
        : now;

    const monthSpan =
      (now.getFullYear() - oldestSourceDate.getFullYear()) * 12 +
      (now.getMonth() - oldestSourceDate.getMonth());
    const historyCount = clamp(monthSpan + 1, 1, 6);

    const currentMonthlySpend = activeSubs.reduce((sum, sub) => sum + normalizeMonthlyCost(sub), 0);

    // Helper: was a subscription being paid in a given month?
    const wasActiveInMonth = (sub: Subscription, monthStart: Date, monthEnd: Date): boolean => {
      const createdStr = getSubCreatedAt(sub);
      const created = createdStr ? new Date(createdStr) : now;
      if (created > monthEnd) return false; // not created yet
      if (sub.status === 'cancelled') {
        const cancelledStr = getSubUpdatedAt(sub);
        const cancelled = cancelledStr ? new Date(cancelledStr) : now;
        return cancelled >= monthStart; // cancelled during or after this month
      }
      return sub.status === 'active'; // paused subs excluded (consistent with budget calc)
    };

    const responsesByMonth = new Map<string, CheckinResponseRecord[]>();
    const responsesBySub = new Map<string, CheckinResponseRecord[]>();

    checkinResponses.forEach(response => {
      const monthKey = toMonthKey(response.checkin_date);
      const monthList = responsesByMonth.get(monthKey) || [];
      monthList.push(response);
      responsesByMonth.set(monthKey, monthList);

      const subList = responsesBySub.get(response.subscription_id) || [];
      subList.push(response);
      responsesBySub.set(response.subscription_id, subList);
    });

    responsesBySub.forEach(list => {
      list.sort(
        (a, b) => new Date(a.checkin_date).getTime() - new Date(b.checkin_date).getTime()
      );
    });

    const zombieSignalBySub = new Map<string, Date>();
    responsesBySub.forEach((list, subId) => {
      for (let i = 1; i < list.length; i += 1) {
        if (list[i - 1].swipe_direction === 'left' && list[i].swipe_direction === 'left') {
          zombieSignalBySub.set(subId, new Date(list[i].checkin_date));
          break;
        }
      }
    });

    const history: MonthlyReportView[] = [];

    for (let i = historyCount - 1; i >= 0; i -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = monthDate;
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthKey = toMonthKey(monthDate.toISOString());
      const monthResponses = responsesByMonth.get(monthKey) || [];

      // Per-month spend: use active subs that existed and weren't cancelled yet
      const monthSpend = i === 0
        ? currentMonthlySpend
        : subscriptions
            .filter(sub => wasActiveInMonth(sub, monthStart, monthEnd))
            .reduce((sum, sub) => sum + normalizeMonthlyCost(sub), 0);

      const responsesBySubInMonth = new Map<string, CheckinResponseRecord[]>();
      monthResponses.forEach(response => {
        const list = responsesBySubInMonth.get(response.subscription_id) || [];
        list.push(response);
        responsesBySubInMonth.set(response.subscription_id, list);
      });

      const usageBySub = new Map<string, number>();
      const lowUsageSubIds: string[] = [];

      responsesBySubInMonth.forEach((list, subId) => {
        const right = list.filter(r => r.swipe_direction === 'right').length;
        const left = list.filter(r => r.swipe_direction === 'left').length;
        const down = list.filter(r => r.swipe_direction === 'down').length;
        const total = list.length;

        const weightedUsage = total > 0 ? (right + down * 0.5) / total : 0.5;
        usageBySub.set(subId, weightedUsage);

        if (left >= 2 && right === 0) {
          lowUsageSubIds.push(subId);
        }
      });

      const activeUsageValues = activeSubs.map(sub => usageBySub.get(sub.id) ?? 0.5);
      const highUsageCount = activeUsageValues.filter(value => value >= 0.7).length;
      const lowUsageCount = activeUsageValues.filter(value => value <= 0.3).length;
      const midUsageCount = Math.max(activeUsageValues.length - highUsageCount - lowUsageCount, 0);

      const budgetRatio = monthSpend / Math.max(monthlyBudget, 1);
      const budgetHealth = clamp(
        budgetRatio < 1 ? 100 : budgetRatio === 1 ? 75 : 75 * Math.exp(-(budgetRatio - 1) * 3.6)
      );

      const usageEfficiency =
        activeUsageValues.length > 0
          ? clamp(
              ((highUsageCount + midUsageCount * 0.5) / activeUsageValues.length) * 100 -
                (lowUsageCount / activeUsageValues.length) * 20
            )
          : 50;

      const subscriptionHealth =
        subscriptions.length > 0 ? (activeSubs.length / subscriptions.length) * 100 : 50;

      const cancelledThisMonth = cancelledSubs.filter(sub => {
        const updatedRaw = getSubUpdatedAt(sub);
        if (!updatedRaw) return false;
        const updatedAt = new Date(updatedRaw);
        return toMonthKey(updatedAt.toISOString()) === monthKey;
      });

      const timelyCancelled = cancelledThisMonth.filter(sub => {
        const signal = zombieSignalBySub.get(sub.id);
        if (!signal) return false;
        const updatedRaw = getSubUpdatedAt(sub);
        if (!updatedRaw) return false;
        const cancellationDate = new Date(updatedRaw);
        const diffDays =
          (cancellationDate.getTime() - signal.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 30;
      }).length;

      const zombieStillOpen = lowUsageSubIds.filter(
        id => !cancelledThisMonth.some(sub => sub.id === id)
      ).length;

      const cancellationTimeliness =
        timelyCancelled === 0 && zombieStillOpen === 0
          ? 100
          : clamp(
              (timelyCancelled / Math.max(timelyCancelled + zombieStillOpen, 1)) * 100 +
                (timelyCancelled > 0 ? 10 : 0)
            );

      const categorySpend = activeSubs.reduce<Record<string, number>>((acc, sub) => {
        const amount = normalizeMonthlyCost(sub);
        acc[sub.category] = (acc[sub.category] || 0) + amount;
        return acc;
      }, {});

      const totalSpendSafe = Math.max(monthSpend, 1);
      const categoryDeviation = Object.entries(CATEGORY_TARGETS).reduce((sum, [category, targetPct]) => {
        const actualPct = ((categorySpend[category] || 0) / totalSpendSafe) * 100;
        return sum + Math.abs(actualPct - targetPct);
      }, 0);
      const categoryBalance = clamp(100 - categoryDeviation);

      const trialUsageThisMonth = activeSubs.filter(sub => {
        const responses = responsesBySubInMonth.get(sub.id) || [];
        return (normalizeMonthlyCost(sub) === 0 || getSubReminderFlag(sub)) && responses.length > 0;
      }).length;
      const thoughtfulDownSwipes = monthResponses.filter(r => r.swipe_direction === 'down').length;
      const optimizationPoints = Math.min(
        10,
        trialUsageThisMonth * 3 + Math.min(3, thoughtfulDownSwipes) * 2 + timelyCancelled * 5
      );
      const costOptimization = clamp((optimizationPoints / 10) * 100);

      const dimensions: DimensionScore[] = [
        {
          key: 'budget_health',
          label: DIMENSION_LABELS.budget_health,
          weight: DIMENSION_WEIGHTS.budget_health,
          score: budgetHealth,
        },
        {
          key: 'usage_efficiency',
          label: DIMENSION_LABELS.usage_efficiency,
          weight: DIMENSION_WEIGHTS.usage_efficiency,
          score: usageEfficiency,
        },
        {
          key: 'subscription_health',
          label: DIMENSION_LABELS.subscription_health,
          weight: DIMENSION_WEIGHTS.subscription_health,
          score: subscriptionHealth,
        },
        {
          key: 'cancellation_timeliness',
          label: DIMENSION_LABELS.cancellation_timeliness,
          weight: DIMENSION_WEIGHTS.cancellation_timeliness,
          score: cancellationTimeliness,
        },
        {
          key: 'cost_optimization',
          label: DIMENSION_LABELS.cost_optimization,
          weight: DIMENSION_WEIGHTS.cost_optimization,
          score: costOptimization,
        },
      ];

      const overall = Math.round(dimensions.reduce((sum, d) => sum + (d.score * d.weight) / 100, 0));
      const budgetDelta = monthlyBudget - monthSpend;
      const budgetStatusLabel =
        Math.abs(budgetDelta) < 1 ? 'At Budget' : budgetDelta > 0 ? 'Under Budget' : 'Over Budget';

      const wastedSubs = activeSubs
        .map(sub => {
          const usage = usageBySub.get(sub.id) ?? 0.5;
          const costMonthly = normalizeMonthlyCost(sub);
          const wasteScore = costMonthly * (1 - usage);
          const leftCount = (responsesBySubInMonth.get(sub.id) || []).filter(
            row => row.swipe_direction === 'left'
          ).length;

          return {
            id: sub.id,
            name: sub.name,
            icon: getSubIcon(sub),
            costMonthly,
            usage,
            wasteScore,
            indicator:
              leftCount >= 2
                ? `Low usage this month (${leftCount} low-usage check-ins)`
                : 'Usage trend is soft compared to cost',
          };
        })
        .sort((a, b) => b.wasteScore - a.wasteScore)
        .slice(0, 3);

      const suggestions: string[] = [];
      const entertainmentPct = totalSpendSafe > 0 ? ((categorySpend.Entertainment || 0) / totalSpendSafe) * 100 : 0;
      const productPct = totalSpendSafe > 0 ? ((categorySpend.Productivity || 0) / totalSpendSafe) * 100 : 0;

      if (entertainmentPct > CATEGORY_TARGETS.Entertainment + 10) {
        suggestions.push(
          `Entertainment is ${Math.round(entertainmentPct)}% of your spend, above your target mix. Consider optimizing this category.`
        );
      }

      if (wastedSubs.length > 0) {
        suggestions.push(
          `${wastedSubs[0].name} shows lower usage relative to its monthly cost. Review fit before the next renewal.`
        );
      }

      if (timelyCancelled > 0) {
        suggestions.push(
          `You canceled ${timelyCancelled} low-usage subscription${timelyCancelled > 1 ? 's' : ''} within 30 days of signal.`
        );
      }

      if (productPct < CATEGORY_TARGETS.Productivity - 10) {
        suggestions.push(
          `Productivity tools are below your target budget mix, so you still have room if a high-value tool appears.`
        );
      }

      if (suggestions.length === 0) {
        suggestions.push('Spending and usage are balanced this month. Keep monitoring renewals to maintain momentum.');
      }

      history.push({
        monthKey: monthDate.toISOString(),
        monthLabel: `${formatMonth(monthDate)} Report`,
        overallScore: overall,
        status: overall >= 80 ? 'Excellent' : overall >= 60 ? 'Good' : overall >= 40 ? 'Needs Improvement' : 'Critical',
        statusColor: getScoreAccent(overall),
        totalSpend: monthSpend,
        budgetDelta,
        budgetStatusText: budgetStatusLabel,
        activeCount: activeSubs.length,
        subsAdded: subscriptions.filter(sub => {
          const created = getSubCreatedAt(sub);
          if (!created) return false;
          return toMonthKey(created) === monthKey;
        }).length,
        subsCancelled: cancelledThisMonth.length,
        dimensions,
        topWasted: wastedSubs,
        suggestions: suggestions.slice(0, 5),
      });
    }

    return history;
  }, [subscriptions, activeSubs, cancelledSubs, monthlyBudget, checkinResponses]);

  const reportHistory = computedReportHistory;
  const selectedReport = reportHistory[reportHistory.length - 1];

  const trendPoints = reportHistory.map(report => report.overallScore);
  const trendMonths = reportHistory.map(report => formatShortMonth(new Date(report.monthKey)));

  const previousReport = reportHistory.length > 1 ? reportHistory[reportHistory.length - 2] : null;
  const spendDiff = previousReport && selectedReport ? selectedReport.totalSpend - previousReport.totalSpend : 0;

  // Spending trend across history
  const spendPoints = reportHistory.map(r => r.totalSpend);
  const maxSpend = Math.max(...spendPoints, 1);
  const spendTrendInsight = (() => {
    if (reportHistory.length < 2) return null;
    const first = reportHistory[0].totalSpend;
    const last = reportHistory[reportHistory.length - 1].totalSpend;
    const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
    const months = reportHistory.length;
    if (Math.abs(pct) < 2) return `Spending has been stable over the past ${months} month${months > 1 ? 's' : ''}.`;
    return pct < 0
      ? `Your spending decreased ${Math.abs(pct)}% over the past ${months} months.`
      : `Your spending increased ${pct}% over the past ${months} months.`;
  })();

  if (!selectedReport) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>HEALTH</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptySubtitle}>Preparing your health report...</Text>
        </View>
      </View>
    );
  }

  if (subscriptions.length >= 3 && checkinLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>HEALTH</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptySubtitle}>Loading latest check-in signals...</Text>
        </View>
      </View>
    );
  }

  const chartWidth = Math.max(220, windowWidth - spacing.lg * 4);
  const { path, circles } = buildTrendPath(trendPoints, chartWidth, 140);
  const lowestDimension = selectedReport.dimensions.reduce((min, current) =>
    current.score < min.score ? current : min
  );
  const scoreAccent = getScoreAccent(selectedReport.overallScore);
  const scoreLabel = getOptimizationLabel(selectedReport.overallScore);
  const conversationalInsights = selectedReport.suggestions.map(humanizeInsight);
  const recentTrend = reportHistory.slice(-3);
  const shareBudgetDeltaText =
    selectedReport.budgetDelta >= 0
      ? `$${selectedReport.budgetDelta.toFixed(2)} under budget`
      : `$${Math.abs(selectedReport.budgetDelta).toFixed(2)} over budget`;
  const shareTopReviews = selectedReport.topWasted.slice(0, 2);

  const handleReviewSubscription = (sub: WastedSub) => {
    navigation.navigate('SubscriptionDetail', { subscriptionId: sub.id });
  };

  const handleShare = async () => {
    const savedAmount = Math.max(selectedReport.budgetDelta, 0);
    const shareMessage = [
      `My SubSense ${selectedReport.monthLabel}: ${selectedReport.overallScore}/100 (${scoreLabel})`,
      `${selectedReport.activeCount} subscriptions managed`,
      `Saved $${savedAmount.toFixed(2)} this month`,
      'Powered by SubSense',
    ].join('\n');

    try {
      if (shareCardRef.current && (await Sharing.isAvailableAsync())) {
        await new Promise(resolve => setTimeout(resolve, 60));
        const pngUri = await captureRef(shareCardRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: 1080,
          height: 1920,
        });
        await Sharing.shareAsync(pngUri, {
          mimeType: 'image/png',
          dialogTitle: 'Share My Score',
          UTI: 'public.png',
        });
      } else {
        await Share.share({ message: shareMessage });
      }
    } catch (error) {
      try {
        await Share.share({ message: shareMessage });
      } catch {
        Alert.alert('Share failed', 'Unable to open share sheet right now.');
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>HEALTH</Text>
        <Pressable
          style={styles.headerButton}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share health score"
        >
          <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + spacing.xl * 2 }]}
        showsVerticalScrollIndicator={false}
      >
        {completedCheckinsCount === 0 ? (
          <View style={styles.syncBanner}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.syncBannerText}>
              Do more check-ins to sharpen your score — swipe through your subs to update usage signals.
            </Text>
          </View>
        ) : null}

        {/* ─── Big Score Ring (original position) ─── */}
        <View style={styles.scoreSection}>
          <ScoreRing score={selectedReport.overallScore} />
          <Text style={styles.scoreStatusText}>{scoreLabel}</Text>
          <Text style={styles.scoreHintText}>
            {selectedReport.overallScore >= 80
              ? 'Your subscriptions are well-optimized.'
              : selectedReport.overallScore >= 60
                ? 'Some room to improve — see breakdown below.'
                : 'Several areas need attention.'}
          </Text>
        </View>

        {/* Quick stats strip */}
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStatTile}>
            <Text style={styles.quickStatLabel}>Spend</Text>
            <Text style={styles.quickStatValue}>${selectedReport.totalSpend.toFixed(0)}</Text>
            <Text style={styles.quickStatSub}>{selectedReport.budgetStatusText}</Text>
          </View>
          <View style={styles.quickStatTile}>
            <Text style={styles.quickStatLabel}>Active</Text>
            <Text style={[styles.quickStatValue, { color: colors.primary }]}>{selectedReport.activeCount}</Text>
            <Text style={styles.quickStatSub}>subscriptions</Text>
          </View>
          <View style={styles.quickStatTile}>
            <Text style={styles.quickStatLabel}>Canceled</Text>
            <Text style={[styles.quickStatValue, { color: colors.success }]}>{selectedReport.subsCancelled}</Text>
            <Text style={styles.quickStatSub}>{spendDiff >= 0 ? '+' : ''}${spendDiff.toFixed(0)} vs last</Text>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.walletSection}>
          <View style={styles.walletRow}>
            <View>
              <Text style={styles.walletAmount}>${selectedReport.totalSpend.toFixed(2)}</Text>
              <Text style={styles.walletSecondary}>This month</Text>
            </View>
            <View style={styles.walletRight}>
              <Text
                style={[
                  styles.walletStatus,
                  selectedReport.budgetDelta > 0
                    ? styles.walletStatusPositive
                    : selectedReport.budgetDelta < 0
                      ? styles.walletStatusNegative
                      : styles.walletStatusNeutral,
                ]}
              >
                {selectedReport.budgetStatusText}
              </Text>
              <Text style={styles.walletSecondary}>
                {spendDiff >= 0 ? '+' : '-'}${Math.abs(spendDiff).toFixed(2)} vs last
              </Text>
            </View>
          </View>
          <Text style={styles.walletChangeText}>
            {selectedReport.subsAdded} added · {selectedReport.subsCancelled} canceled
          </Text>
        </View>

        <View style={styles.sectionDivider} />

        {/* Spending History */}
        {reportHistory.length >= 1 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Spending by Month</Text>
              <Text style={styles.sectionHint}>
                {reportHistory.length > 1 ? 'Historical comparison' : 'Current month'}
              </Text>
            </View>
            <View style={styles.spendBarsContainer}>
              {reportHistory.map((report, index) => {
                const barPct = Math.max(spendPoints[index] / maxSpend, 0.02);
                const isLatest = index === reportHistory.length - 1;
                return (
                  <View key={report.monthKey} style={styles.spendBarRow}>
                    <Text style={styles.spendBarMonth}>
                      {formatShortMonth(new Date(report.monthKey))}
                    </Text>
                    <View style={styles.spendBarTrack}>
                      <View
                        style={[
                          styles.spendBarFill,
                          {
                            width: `${barPct * 100}%`,
                            backgroundColor: isLatest ? colors.primary : colors.gray200,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.spendBarAmount, isLatest && styles.spendBarAmountLatest]}>
                      ${report.totalSpend.toFixed(0)}
                    </Text>
                  </View>
                );
              })}
            </View>
            {spendTrendInsight && (
              <View style={styles.spendTrendInsightRow}>
                <Ionicons
                  name={
                    spendTrendInsight.includes('decreased')
                      ? 'trending-down'
                      : spendTrendInsight.includes('increased')
                        ? 'trending-up'
                        : 'remove'
                  }
                  size={16}
                  color={
                    spendTrendInsight.includes('decreased')
                      ? colors.success
                      : spendTrendInsight.includes('increased')
                        ? colors.danger
                        : colors.textSecondary
                  }
                />
                <Text style={styles.spendTrendInsightText}>{spendTrendInsight}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Trend</Text>
            <Text style={styles.sectionHint}>Last {trendPoints.length} month snapshots</Text>
          </View>

          <Svg width={chartWidth} height={140} style={styles.trendChart}>
            {path ? <Path d={path} stroke={colors.primary} strokeWidth={3} fill="none" /> : null}
            {circles.map((c, index) => (
              <Circle key={index} cx={c.x} cy={c.y} r={4} fill={colors.primary} />
            ))}
          </Svg>

          <View style={styles.trendAxisLabels}>
            {trendMonths.map((month, index) => (
              <Text key={`${month}-${index}`} style={styles.axisLabel}>{month}</Text>
            ))}
          </View>

          <View style={styles.recentTrendChips}>
            {recentTrend.map(item => (
              <View key={item.monthKey} style={styles.recentTrendChip}>
                <Text style={styles.recentTrendChipMonth}>{formatShortMonth(new Date(item.monthKey))}</Text>
                <Text style={styles.recentTrendChipScore}>{item.overallScore}</Text>
              </View>
            ))}
          </View>

          {trendPoints.length < 6 ? (
            <Text style={styles.trendNote}>Trend gets sharper as more months accumulate.</Text>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Score Breakdown</Text>
            <View style={[styles.scoreBadge, { backgroundColor: getDimensionColor(selectedReport.overallScore) + '22' }]}>
              <Text style={[styles.scoreBadgeText, { color: getDimensionColor(selectedReport.overallScore) }]}>
                {selectedReport.overallScore}
              </Text>
            </View>
          </View>
          <Text style={styles.sectionHint}>What builds your health score</Text>

          <View style={styles.dimensionList}>
            {selectedReport.dimensions.map(dimension => {
              const isLowest = dimension.key === lowestDimension.key;
              const desc = DIMENSION_DESC[dimension.key];
              return (
                <View key={dimension.key} style={[styles.dimensionRow, isLowest && styles.dimensionRowEmphasis]}>
                  <View style={styles.dimensionLabelRow}>
                    <Text style={styles.dimensionLabel}>{dimension.label}</Text>
                    <Text style={[styles.dimensionScore, { color: getDimensionColor(dimension.score) }]}>
                      {Math.round(dimension.score)}
                    </Text>
                  </View>
                  {desc ? <Text style={styles.dimensionDesc}>{desc}</Text> : null}
                  <View style={styles.dimensionTrack}>
                    <View
                      style={[
                        styles.dimensionFill,
                        {
                          width: `${dimension.score}%`,
                          backgroundColor: getDimensionColor(dimension.score),
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Subscriptions to Review</Text>
          {selectedReport.topWasted.length > 0 ? (
            <View style={styles.wastedList}>
              {selectedReport.topWasted.map(sub => (
                <View key={sub.id} style={styles.wastedCard}>
                  <View style={styles.wastedLeft}>
                    <Text style={styles.wastedIcon}>{sub.icon}</Text>
                    <View style={styles.wastedInfo}>
                      <Text style={styles.wastedName}>{sub.name}</Text>
                      <Text style={styles.wastedReason}>Reason: {sub.indicator}</Text>
                    </View>
                  </View>

                  <View style={styles.wastedRight}>
                    <Text style={styles.wastedCost}>${sub.costMonthly.toFixed(2)}</Text>
                    <Pressable
                      style={styles.reviewButton}
                      onPress={() => handleReviewSubscription(sub)}
                      accessibilityRole="button"
                      accessibilityLabel={`Review ${sub.name}`}
                    >
                      <Text style={styles.reviewButtonText}>Review</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.goodText}>Great job. No high-risk subscriptions to review right now.</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Optimization Insights</Text>
          <View style={styles.suggestionList}>
            {conversationalInsights.map((suggestion, index) => (
              <View key={`${suggestion}-${index}`} style={styles.suggestionItem}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          style={styles.shareCta}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share My Score"
        >
          <Ionicons name="share-social-outline" size={20} color="white" />
          <Text style={styles.shareCtaText}>Share My Health Report</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.shareCardCaptureLayer} pointerEvents="none">
        <View
          ref={shareCardRef}
          collapsable={false}
          style={styles.sharePngCard}
        >
          <LinearGradient
            colors={[colors.primary, '#0EA5E9'] as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.sharePngInner}>
            <View style={styles.sharePngHeaderRow}>
              <Text style={styles.sharePngHeader}>SubSense Health</Text>
              <Text style={styles.sharePngMonth}>{selectedReport.monthLabel.replace(' Report', '')}</Text>
            </View>

            {/* Status + hint instead of big single score number */}
            <View style={styles.sharePngScoreWrap}>
              <Text style={styles.sharePngStatus}>{scoreLabel}</Text>
              <Text style={styles.sharePngMini}>Focus area: {lowestDimension.label}</Text>
            </View>

            <View style={styles.sharePngSummaryGrid}>
              <View style={styles.sharePngSummaryTile}>
                <Text style={styles.sharePngSummaryLabel}>Budget</Text>
                <Text style={styles.sharePngSummaryValue}>{selectedReport.budgetStatusText}</Text>
                <Text style={styles.sharePngSummarySub}>{shareBudgetDeltaText}</Text>
              </View>
              <View style={styles.sharePngSummaryTile}>
                <Text style={styles.sharePngSummaryLabel}>This month</Text>
                <Text style={styles.sharePngSummaryValue}>${selectedReport.totalSpend.toFixed(2)}</Text>
                <Text style={styles.sharePngSummarySub}>
                  {spendDiff >= 0 ? '+' : '-'}${Math.abs(spendDiff).toFixed(2)} vs last
                </Text>
              </View>
              <View style={styles.sharePngSummaryTile}>
                <Text style={styles.sharePngSummaryLabel}>Managed</Text>
                <Text style={styles.sharePngSummaryValue}>{selectedReport.activeCount}</Text>
                <Text style={styles.sharePngSummarySub}>active subscriptions</Text>
              </View>
              <View style={styles.sharePngSummaryTile}>
                <Text style={styles.sharePngSummaryLabel}>Changes</Text>
                <Text style={styles.sharePngSummaryValue}>
                  +{selectedReport.subsAdded} / -{selectedReport.subsCancelled}
                </Text>
                <Text style={styles.sharePngSummarySub}>added / canceled</Text>
              </View>
            </View>

            <View style={styles.sharePngSection}>
              <Text style={styles.sharePngSectionTitle}>Score Breakdown</Text>
              {selectedReport.dimensions.map(dimension => (
                <View key={dimension.key} style={styles.sharePngBreakdownRow}>
                  <View style={styles.sharePngBreakdownTop}>
                    <Text style={styles.sharePngBreakdownLabel}>{dimension.label}</Text>
                    <Text style={styles.sharePngBreakdownValue}>{dimension.score}/100</Text>
                  </View>
                  <View style={styles.sharePngBreakdownTrack}>
                    <View
                      style={[
                        styles.sharePngBreakdownFill,
                        { width: `${Math.max(8, dimension.score)}%` },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.sharePngSection}>
              <Text style={styles.sharePngSectionTitle}>Subscriptions to Review</Text>
              {shareTopReviews.length > 0 ? (
                shareTopReviews.map(sub => (
                  <View key={sub.id} style={styles.sharePngReviewRow}>
                    <Text style={styles.sharePngReviewName}>
                      {sub.name} · ${sub.costMonthly.toFixed(2)}
                    </Text>
                    <Text style={styles.sharePngReviewReason} numberOfLines={1}>
                      {sub.indicator}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.sharePngReviewReason}>No urgent subscriptions to review right now.</Text>
              )}
            </View>

            <Text style={styles.sharePngBrand}>SubSense</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.backgroundLight,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.black as any,
    color: colors.textPrimary,
    letterSpacing: 1.6,
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  quickStatTile: {
    flex: 1,
    backgroundColor: colors.gray[50],
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  quickStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: IOS_COLORS.label,
    lineHeight: 24,
  },
  quickStatSub: {
    fontSize: 10,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
    textAlign: 'center',
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  scoreBadgeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.background,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    gap: spacing.lg,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  syncBannerText: {
    color: IOS_COLORS.secondaryLabel,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    flex: 1,
  },
  scoreSection: {
    paddingTop: 36,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingWrap: {
    width: 208,
    height: 208,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingSvg: {
    transform: [{ rotate: '-90deg' }],
  },
  scoreRingCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingValue: {
    fontSize: 60,
    lineHeight: 64,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -1.2,
  },
  scoreStatusText: {
    marginTop: 18,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  scoreHintText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: IOS_COLORS.separator,
    marginVertical: 24,
  },
  walletSection: {
    paddingHorizontal: 0,
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  walletRight: {
    alignItems: 'flex-end',
  },
  walletAmount: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  walletStatus: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  walletStatusPositive: {
    color: IOS_COLORS.systemGreen,
  },
  walletStatusNegative: {
    color: IOS_COLORS.systemRed,
  },
  walletStatusNeutral: {
    color: IOS_COLORS.secondaryLabel,
  },
  walletSecondary: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 19,
    color: IOS_COLORS.secondaryLabel,
  },
  walletChangeText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 19,
    color: IOS_COLORS.secondaryLabel,
  },

  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionHint: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  trendChart: {
    alignSelf: 'center',
  },
  trendAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  axisLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  trendNote: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  recentTrendChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  recentTrendChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.gray[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  recentTrendChipMonth: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  recentTrendChipScore: {
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '800',
  },

  dimensionList: {
    gap: spacing.xs,
  },
  dimensionRow: {
    gap: 6,
    paddingVertical: 6,
  },
  dimensionRowEmphasis: {
    backgroundColor: colors.danger + '10',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  dimensionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dimensionLabel: {
    fontSize: 14,
    color: IOS_COLORS.label,
    fontWeight: '500',
  },
  dimensionScore: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '600',
  },
  dimensionTrack: {
    height: 6,
    backgroundColor: IOS_COLORS.separator,
    borderRadius: 999,
    overflow: 'hidden',
  },
  dimensionFill: {
    height: '100%',
    borderRadius: 999,
  },

  wastedList: {
    gap: spacing.sm,
  },
  wastedCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    gap: spacing.sm,
  },
  wastedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  wastedInfo: {
    flex: 1,
    gap: 2,
  },
  wastedIcon: {
    fontSize: 22,
  },
  wastedName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  wastedReason: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  wastedRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  wastedCost: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.danger,
  },
  reviewButton: {
    minHeight: 44,
    minWidth: 84,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },

  suggestionList: {
    gap: spacing.md,
  },
  suggestionItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  suggestionText: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 24,
  },

  shareCta: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  shareCtaText: {
    fontSize: 16,
    fontWeight: '800',
    color: 'white',
  },

  sharePreviewCard: {
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  sharePreviewPill: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sharePreviewScore: {
    fontSize: 72,
    lineHeight: 80,
    color: 'white',
    fontWeight: '900',
    letterSpacing: -1.6,
  },
  sharePreviewStatus: {
    fontSize: 20,
    color: 'white',
    fontWeight: '700',
  },
  sharePreviewMeta: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
  },
  sharePreviewBrand: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },

  shareCardCaptureLayer: {
    position: 'absolute',
    top: -3000,
    left: 0,
    width: 1080,
    height: 1920,
  },
  sharePngCard: {
    width: 1080,
    height: 1920,
    overflow: 'hidden',
  },
  sharePngInner: {
    flex: 1,
    backgroundColor: 'rgba(5,16,40,0.2)',
    paddingVertical: 72,
    paddingHorizontal: 56,
  },
  sharePngHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sharePngHeader: {
    fontSize: 44,
    fontWeight: '700',
    color: 'white',
  },
  sharePngMonth: {
    marginTop: 6,
    fontSize: 24,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
  },
  sharePngScoreWrap: {
    marginTop: 28,
    alignItems: 'center',
  },
  sharePngScore: {
    fontSize: 260,
    lineHeight: 268,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -6,
  },
  sharePngStatus: {
    marginTop: 2,
    fontSize: 42,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
  },
  sharePngMini: {
    marginTop: 8,
    fontSize: 26,
    lineHeight: 34,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
  },
  sharePngSummaryGrid: {
    marginTop: 34,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  sharePngSummaryTile: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 120,
  },
  sharePngSummaryLabel: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.84)',
    fontWeight: '600',
  },
  sharePngSummaryValue: {
    marginTop: 6,
    fontSize: 30,
    lineHeight: 36,
    color: 'white',
    fontWeight: '700',
  },
  sharePngSummarySub: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.86)',
  },
  sharePngSection: {
    marginTop: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  sharePngSectionTitle: {
    fontSize: 24,
    color: 'white',
    fontWeight: '700',
  },
  sharePngBreakdownRow: {
    gap: 6,
  },
  sharePngBreakdownTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sharePngBreakdownLabel: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  sharePngBreakdownValue: {
    fontSize: 18,
    color: 'white',
    fontWeight: '700',
  },
  sharePngBreakdownTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  sharePngBreakdownFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  sharePngReviewRow: {
    gap: 2,
    paddingVertical: 2,
  },
  sharePngReviewName: {
    fontSize: 20,
    color: 'white',
    fontWeight: '700',
  },
  sharePngReviewReason: {
    fontSize: 17,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.86)',
  },
  sharePngBrand: {
    marginTop: 'auto',
    alignSelf: 'center',
    fontSize: 24,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },

  emptyContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  successText: {
    color: colors.success,
  },
  warningText: {
    color: colors.warning,
  },
  dangerText: {
    color: colors.danger,
  },
  goodText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '700',
    lineHeight: 20,
  },
  spendBarsContainer: {
    gap: 10,
    marginTop: spacing.sm,
  },
  spendBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spendBarMonth: {
    width: 30,
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  spendBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.gray100,
    borderRadius: 5,
    overflow: 'hidden',
  },
  spendBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  spendBarAmount: {
    width: 38,
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'right',
  },
  spendBarAmountLatest: {
    color: colors.primary,
    fontWeight: '800',
  },
  spendTrendInsightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: IOS_COLORS.separator,
  },
  spendTrendInsightText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    flex: 1,
    lineHeight: 18,
  },
});
