import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscriptions } from '@/contexts/SubscriptionContext';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { colors, spacing, fontSize, borderRadius, commonStyles } from '@/styles';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = 90;

/**
 * Simplified CheckInScreen without Reanimated gestures
 * Temporary version for testing while fixing worklets compatibility
 */
export const CheckInScreen: React.FC = () => {
  const insets = useScreenInsets();
  const { subscriptions, submitCheckInFeedback } = useSubscriptions();

  const activeSubs = useMemo(
    () => subscriptions.filter(s => s.status === 'active'),
    [subscriptions]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionMode, setQuestionMode] = useState(false);
  const [questionStep, setQuestionStep] = useState<0 | 1>(0);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [selectedFollowUp, setSelectedFollowUp] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnimatingSwipe, setIsAnimatingSwipe] = useState(false);
  const [pendingAction, setPendingAction] = useState<'review' | 'unsure'>('review');
  const pan = useRef(new Animated.ValueXY()).current;

  const currentSub = activeSubs[currentIndex];
  const isLastCard = currentIndex === activeSubs.length - 1;

  // Map reasons → follow-up tags
  const followUps: Record<string, string[]> = {
    'Too expensive': ['Price spike', 'Promo ended', 'Hidden fees'],
    'Not using enough': ['Content stale', 'Too busy lately', 'Overlapping service'],
    'Found alternative': ['Switching soon', 'Testing alternative', 'Better value elsewhere'],
    'No longer need it': ['Life change', 'Temporary need ended', 'Trial curiosity only'],
  };

  const resetQuestionState = () => {
    setQuestionStep(0);
    setSelectedReason(null);
    setSelectedFollowUp(null);
    setQuestionMode(false);
    setPendingAction('review');
  };

  const proceedNextCard = () => {
    resetQuestionState();
    if (isLastCard) {
      setCurrentIndex(prev => prev + 1); // triggers done state
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const recordFeedback = useCallback(async (
    action: 'love' | 'review' | 'unsure',
    reason?: string | null,
    follow?: string | null,
    blockUI = true
  ) => {
    if (!currentSub) return;
    if (blockUI) setIsSubmitting(true);
    try {
      await submitCheckInFeedback({
        subId: currentSub.id,
        action,
        step1Reason: reason || null,
        step2Reason: follow || null,
      });
    } catch (e) {
      console.error('Check-in submit failed', e);
    } finally {
      if (blockUI) setIsSubmitting(false);
    }
  }, [currentSub, submitCheckInFeedback]);

  const handleReview = useCallback(() => {
    setPendingAction('review');
    setQuestionMode(true);
    setQuestionStep(0);
    setSelectedReason(null);
  }, []);

  const handleMaybe = useCallback(() => {
    setPendingAction('unsure');
    setQuestionMode(true);
    setQuestionStep(0);
    setSelectedReason(null);
  }, []);

  const handleReasonSelect = async (reason: string) => {
    if (isSubmitting) return;
    setSelectedReason(reason);
    const nextFollowUps = followUps[reason] || [];
    if (nextFollowUps.length === 0) {
      setSelectedFollowUp(null);
      await recordFeedback(pendingAction, reason, null);
      proceedNextCard();
      return;
    }
    setQuestionStep(1);
  };

  const handleFollowUpSelect = async (tag: string) => {
    if (isSubmitting || !selectedReason) return;
    setSelectedFollowUp(tag);
    await recordFeedback(pendingAction, selectedReason, tag);
    proceedNextCard();
  };

  const resetCardPosition = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      bounciness: 6,
      speed: 18,
    }).start();
  }, [pan]);

  const triggerSwipeAction = useCallback((direction: 'left' | 'right' | 'down') => {
    if (isAnimatingSwipe) return;
    setIsAnimatingSwipe(true);

    if (direction === 'right') {
      Animated.timing(pan, {
        toValue: { x: width + 120, y: 0 },
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        pan.setValue({ x: 0, y: 0 });
        setIsAnimatingSwipe(false);
        proceedNextCard();
        // Keep swipe should feel instant; persist feedback in background.
        void recordFeedback('love', null, null, false);
      });
      return;
    }

    const exitTarget = direction === 'left'
      ? { x: -(width + 120), y: 0 }
      : { x: 0, y: height * 0.95 };

    Animated.timing(pan, {
      toValue: exitTarget,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setIsAnimatingSwipe(false);
      if (direction === 'left') handleReview();
      else handleMaybe();
    });
  }, [handleMaybe, handleReview, height, isAnimatingSwipe, pan, recordFeedback]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !questionMode &&
          !isSubmitting &&
          !isAnimatingSwipe &&
          (Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6),
        onPanResponderGrant: () => {
          if (isAnimatingSwipe) return;
          pan.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          if (isAnimatingSwipe) return;
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        },
        onPanResponderRelease: (_, gestureState) => {
          if (isAnimatingSwipe) return;
          const { dx, dy, vx, vy } = gestureState;
          const absX = Math.abs(dx);
          const absY = Math.abs(dy);
          const leftIntent = dx < -SWIPE_THRESHOLD || (dx < -25 && vx < -0.8);
          const rightIntent = dx > SWIPE_THRESHOLD || (dx > 25 && vx > 0.8);
          const downIntent = dy > SWIPE_THRESHOLD || (dy > 25 && vy > 0.9);

          if (leftIntent && absX > absY) {
            triggerSwipeAction('left');
          } else if (rightIntent && absX > absY) {
            triggerSwipeAction('right');
          } else if (downIntent && absY > absX) {
            triggerSwipeAction('down');
          } else {
            resetCardPosition();
          }
        },
        onPanResponderTerminate: resetCardPosition,
      }),
    [isAnimatingSwipe, isSubmitting, pan, pan.x, pan.y, questionMode, resetCardPosition, triggerSwipeAction]
  );

  const animatedCardStyle = useMemo(
    () => ({
      transform: [
        { translateX: pan.x },
        { translateY: pan.y },
        {
          rotate: pan.x.interpolate({
            inputRange: [-width, 0, width],
            outputRange: ['-8deg', '0deg', '8deg'],
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [pan.x, pan.y]
  );

  const rightCueOpacity = useMemo(
    () =>
      pan.x.interpolate({
        inputRange: [0, 30, SWIPE_THRESHOLD + 30],
        outputRange: [0, 0.35, 1],
        extrapolate: 'clamp',
      }),
    [pan.x]
  );
  const leftCueOpacity = useMemo(
    () =>
      pan.x.interpolate({
        inputRange: [-SWIPE_THRESHOLD - 30, -30, 0],
        outputRange: [1, 0.35, 0],
        extrapolate: 'clamp',
      }),
    [pan.x]
  );
  const downCueOpacity = useMemo(
    () =>
      pan.y.interpolate({
        inputRange: [0, 30, SWIPE_THRESHOLD + 30],
        outputRange: [0, 0.35, 1],
        extrapolate: 'clamp',
      }),
    [pan.y]
  );

  if (activeSubs.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={80} color={colors.gray400} />
          <Text style={styles.emptyTitle}>No Active Subscriptions</Text>
          <Text style={styles.emptyText}>Add some subscriptions to start your weekly check-in</Text>
        </View>
      </View>
    );
  }

  if (currentIndex >= activeSubs.length) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.doneContainer}>
          <View style={styles.doneContent}>
            <Ionicons name="checkmark-circle" size={80} color={colors.success} />
            <Text style={styles.doneTitle}>All Done!</Text>
            <Text style={styles.doneText}>
              You've reviewed all your active subscriptions. Great job staying on top of your spending!
            </Text>
            <Pressable
              style={styles.doneButton}
              onPress={() => setCurrentIndex(0)}
            >
              <Text style={styles.doneButtonText}>Review Again</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (questionMode) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.questionContainer}>
          <Text style={styles.questionTitle}>Tell us more about {currentSub.name}</Text>
          <Text style={styles.questionText}>
            {questionStep === 0
              ? 'Why are you reconsidering this subscription?'
              : 'What best explains it? (helps us refine recommendations)'}
          </Text>
          <Pressable onPress={resetQuestionState} style={{ marginBottom: spacing.md }}>
            <Text style={[styles.questionText, { color: colors.primary }]}>← Back to card</Text>
          </Pressable>

          {questionStep === 0 && (
            <View style={styles.reasonsContainer}>
              {['Too expensive', 'Not using enough', 'Found alternative', 'No longer need it'].map(reason => (
                <Pressable
                  key={reason}
                  style={[
                    styles.reasonChip,
                    isSubmitting && styles.reasonChipDisabled,
                    selectedReason === reason && styles.reasonChipSelected
                  ]}
                  onPress={() => {
                    void handleReasonSelect(reason);
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={styles.reasonText}>{reason}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {questionStep === 1 && selectedReason && (
            <View style={styles.reasonsContainer}>
              {(followUps[selectedReason] || []).map(tag => (
                <Pressable
                  key={tag}
                  style={[
                    styles.reasonChip,
                    isSubmitting && styles.reasonChipDisabled,
                    selectedFollowUp === tag && styles.reasonChipSelected
                  ]}
                  onPress={() => {
                    void handleFollowUpSelect(tag);
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={styles.reasonText}>{tag}</Text>
                </Pressable>
              ))}
              {(followUps[selectedReason] || []).length === 0 && (
                <Text style={styles.reasonText}>No follow-ups for this reason.</Text>
              )}
            </View>
          )}

          {isSubmitting && (
            <Text style={styles.questionText}>Saving your feedback...</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WEEKLY CHECK-IN</Text>
        <Text style={styles.headerSubtitle}>
          {currentIndex + 1} of {activeSubs.length}
        </Text>
      </View>

      {/* Card */}
      <View style={styles.cardContainer}>
        <Animated.View style={[styles.dragCue, styles.dragCueLeft, { opacity: leftCueOpacity }]}>
          <Ionicons name="close-circle" size={22} color={colors.danger} />
          <Text style={[styles.dragCueText, { color: colors.danger }]}>REVIEW</Text>
        </Animated.View>
        <Animated.View style={[styles.dragCue, styles.dragCueRight, { opacity: rightCueOpacity }]}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <Text style={[styles.dragCueText, { color: colors.success }]}>KEEP IT</Text>
        </Animated.View>
        <Animated.View style={[styles.dragCue, styles.dragCueDown, { opacity: downCueOpacity }]}>
          <Ionicons name="help-circle" size={20} color={colors.warning} />
          <Text style={[styles.dragCueText, { color: colors.warning }]}>MAYBE</Text>
        </Animated.View>

        <Animated.View style={[styles.card, animatedCardStyle]} {...panResponder.panHandlers}>
          <View style={styles.cardEmoji}>
            <Text style={styles.emojiText}>{currentSub.iconEmoji || currentSub.icon_emoji}</Text>
          </View>

          <Text style={styles.cardName}>{currentSub.name}</Text>
          <Text style={styles.cardPlan}>{currentSub.planName || currentSub.plan_name}</Text>

          <View style={styles.cardPrice}>
            <Text style={styles.priceAmount}>${currentSub.cost}</Text>
            <Text style={styles.priceCycle}>/{currentSub.billingCycle || currentSub.billing_cycle}</Text>
          </View>

          <View style={styles.cardCategory}>
            <Text style={styles.categoryText}>{currentSub.category}</Text>
          </View>

          <Text style={styles.instructionText}>
            Swipe left to Review, right to Keep It, down for Maybe.
          </Text>
        </Animated.View>
      </View>

      <View style={styles.swipeLegend}>
        <View style={[styles.legendChip, styles.legendChipReview]}>
          <Ionicons name="arrow-back" size={14} color={colors.danger} />
          <Text style={[styles.legendChipText, styles.legendChipTextReview]}>Review</Text>
        </View>
        <View style={[styles.legendChip, styles.legendChipMaybe]}>
          <Ionicons name="arrow-down" size={14} color={colors.warning} />
          <Text style={[styles.legendChipText, styles.legendChipTextMaybe]}>Maybe</Text>
        </View>
        <View style={[styles.legendChip, styles.legendChipKeep]}>
          <Text style={[styles.legendChipText, styles.legendChipTextKeep]}>Keep It</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.success} />
        </View>
      </View>

      {/* Note */}
      <Text style={styles.note}>
        Swipe card to continue
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: fontSize.sm,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  dragCue: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    ...commonStyles.cardShadow,
  },
  dragCueLeft: {
    left: spacing.lg,
    top: spacing.xl * 2,
  },
  dragCueRight: {
    right: spacing.lg,
    top: spacing.xl * 2,
  },
  dragCueDown: {
    bottom: spacing.md,
  },
  dragCueText: {
    fontSize: fontSize.xs,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: width * 0.85,
    alignItems: 'center',
    ...commonStyles.cardShadow,
  },
  cardEmoji: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emojiText: {
    fontSize: 40,
  },
  cardName: {
    fontSize: fontSize.xl,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardPlan: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  cardPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  priceAmount: {
    fontSize: fontSize.xxxl,
    fontWeight: '900',
    color: colors.primary,
  },
  priceCycle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  cardCategory: {
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.lg,
  },
  categoryText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  instructionText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  swipeLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...commonStyles.cardShadow,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    minWidth: 94,
  },
  legendChipReview: {
    backgroundColor: colors.danger + '12',
    borderColor: colors.danger + '45',
  },
  legendChipMaybe: {
    backgroundColor: colors.warning + '14',
    borderColor: colors.warning + '45',
  },
  legendChipKeep: {
    backgroundColor: colors.success + '12',
    borderColor: colors.success + '45',
  },
  legendChipText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  legendChipTextReview: {
    color: colors.danger,
  },
  legendChipTextMaybe: {
    color: colors.warning,
  },
  legendChipTextKeep: {
    color: colors.success,
  },
  note: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    paddingBottom: spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  doneContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  doneContent: {
    alignItems: 'center',
  },
  doneTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  doneText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  doneButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
  },
  doneButtonText: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.white,
  },
  questionContainer: {
    padding: spacing.xl,
  },
  questionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  questionText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  reasonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  reasonChip: {
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  reasonChipSelected: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  reasonChipDisabled: {
    opacity: 0.6,
  },
  reasonText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
});
