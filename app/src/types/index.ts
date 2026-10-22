import { AvatarStyle } from '@/utils/avatarUtils';

// Re-export AvatarStyle for convenience
export type { AvatarStyle };

export interface User {
    id: string;
    email: string;
    name: string;
    avatar: string;
    avatarStyle: AvatarStyle;
    age: number;
    monthly_budget: number;
    currency: string;
    reminder_day: number;
    reminder_days_before: number;
    created_at: string;
    updated_at: string;
  }
  
export interface Subscription {
    // Canonical camelCase fields used across the app UI
    id: string;
    userId: string;
    name: string;
    planName: string;
    cost: number;
    billingCycle: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    category: 'Entertainment' | 'Productivity' | 'Utilities' | 'Health';
    iconEmoji: string;
    color: string;
    status: 'active' | 'paused' | 'cancelled' | 'watchlist';
    isReminder: boolean;
    startDate?: string;
    nextRenewalDate: string;
    usageScore?: number;
    satisfactionScore?: number;
    notes?: string;
    // v2 check-in signals (require DB migration — see checkin-v2-spec)
    lastUsedRecency?: 'today' | 'this_week' | 'last_week' | 'over_2_weeks';
    usageType?: 'active' | 'passive';
    retentionAnchor?: string;
    // Phase 6: cancellation reason (requires DB migration)
    cancellationReason?: string;
    createdAt: string;
    updatedAt: string;

    // Backwards-compat snake_case aliases (kept optional so legacy code still type-checks)
    user_id?: string;
    plan_name?: string;
    billing_cycle?: Subscription['billingCycle'];
    icon_emoji?: string;
    is_reminder?: boolean;
    start_date?: string;
    next_renewal_date?: string;
    usage_score?: number;
    satisfaction_score?: number;
    created_at?: string;
    updated_at?: string;
  }

  // Setup/Persona Types
  export interface SetupPreferences {
    budget_tightness: number;      // 0.0-1.0
    price_sensitivity: number;     // 0.0-1.0
    waste_tolerance: number;       // 0.0-1.0
    exploration_tendency: number;  // 0.0-1.0
    quality_preference: number;    // 0.0-1.0
    decision_style: 'quick' | 'moderate' | 'deliberate';
    favorite_categories: string[]; // User's most focused categories
  }

  export interface SetupQuestionOption {
    label: string;
    emoji?: string;
    values: Partial<SetupPreferences>; // Values this option sets
  }

  export interface SetupQuestion {
    id: string;
    question: string;
    type: 'choice' | 'slider';
    options: SetupQuestionOption[];
  }

  export interface UserPersona {
    id: string;
    user_id: string;
    setup_preferences: SetupPreferences;
    setup_completed: boolean;
    confidence_score: number;
    last_updated: string;
    created_at: string;
  }

  // Audit/Assessment Types
  export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
  }

  // --- Audit FSM & Protocol Types (v2) ---

  export type AuditStage =
    | 'service_id'
    | 'motivation'
    | 'history_check'
    | 'expected_usage'
    | 'overlap_check'
    | 'budget_feel'
    | 'risk';

  // Maybe<T>: slot explicitly answered (including 'not_sure') vs undefined (never reached)
  export type Maybe<T> = T | 'not_sure';

  export type MotivationClarity = 'scenario_specific' | 'problem_aware' | 'category_only' | 'none';
  export type ForcingFunction = 'academic' | 'work' | 'professional';
  export type HistoryStatus = 'first_time' | 'familiar' | 'cancelled' | 'upgrading' | 'free_trial';
  export type CancelReason = 'price' | 'low_usage' | 'found_alternative' | 'no_longer_needed' | 'other';
  export type ExpectedFrequency = 'daily' | 'most_days' | 'few_times' | 'weekly' | 'monthly' | 'rarely' | 'not_sure';
  export type OverlapLevel = 'none' | 'some' | 'significant' | 'high' | 'not_sure';
  export type BudgetFeel = 'comfortable' | 'tight' | 'steep' | 'no_way' | 'not_sure';
  export type TopRisk = 'none' | 'mandatory_use' | 'timeline_limited' | 'free_enough'
    | 'forget_cancel' | 'interest_decay' | 'not_sure' | 'impulse' | 'other';
  export type SubscriberType = 'balanced_user' | 'essentialist' | 'spontaneous' | 'explorer' | 'power_user';

  export interface AuditSlots {
    // Stage 1
    service_name?: string;
    price?: number;
    billing_cycle?: 'monthly' | 'yearly';
    price_monthly?: number;

    // Stage 2
    primary_motivation?: string;
    motivation_text?: string;
    motivation_clarity?: MotivationClarity;
    forcing_function?: ForcingFunction | null;

    // Stage 3
    history_status?: HistoryStatus;
    cancel_reason?: CancelReason;
    cancel_text?: string;

    // Stage 4
    expected_frequency?: ExpectedFrequency;
    usage_certainty?: 'conditional';

    // Stage 4.5
    overlap_level?: OverlapLevel;

    // Stage 5
    budget_feel?: BudgetFeel;

    // Stage 6
    top_risk?: TopRisk;
    additional_risk_note?: string;
  }

  export interface AuditPersona {
    name: string;
    monthly_budget: number;
    persona_alignment: number;           // 0.7 / 1.0 / 1.3
    subscriber_type: SubscriberType;
    lifecycle_coeff: number;             // 0.6–1.1
    same_cat_count: number;
    same_cat_avg_usage: number;          // 0–1
    existing_subs_count: number;
    existing_subs: string;               // "Netflix, Spotify, ..."
    same_cat_subs: string;               // "Spotify, Apple Music"
    interest_tags: string[];
    checkin_sat?: string;
    usage_trend?: string;
  }

  export type AuditRecommendationType =
    | 'subscribe'
    | 'trial'
    | 'watchlist'
    | 'alternative';

  export interface DecisionResult {
    primary_decision: AuditRecommendationType;
    final_recommendation: AuditRecommendationType | 'delay';
    timing_suggestion: string | null;
    delay_triggered: boolean;
  }

  export interface AdjusterSignal {
    name: string;
    finding: string;
    impact: number;              // [-6, +6]
    confidence: 'high' | 'medium' | 'low';
  }

  export interface AdjusterResult {
    signals: AdjusterSignal[];
    total_delta: number;         // [-12, +10]
    narrative_insight: string;
    overlap_inference: string;
  }

  // Structured option chip used in protocol and recovery questions
  export interface AuditOption {
    id: string;
    label: string;
    value: string | number;
  }

  export interface AuditFactor {
    title: string;
    description: string;
    type: 'risk' | 'pass';
    direction?: 'up' | 'down' | 'neutral';
  }

  export interface AuditReport {
    id: string;
    user_id: string;
    service_name: string;
    cost: string;
    billing_cycle?: string;
    category: 'Entertainment' | 'Productivity' | 'Utilities' | 'Health';
    score: number;
    status: 'Good' | 'Fair' | 'Poor';
    recommendation: string;
    recommendation_type: AuditRecommendationType;
    // Legacy reports may have old recommendation_type values
    factors: AuditFactor[];
    slots: AuditSlots;
    uncertainty_level: 'low' | 'medium' | 'high';
    conversation_history: ChatMessage[];
    decision?: DecisionResult;
    adjuster?: AdjusterResult;
    created_at: string;
  }

  // Check-In Feedback Types
  export type CheckInAction = 'love' | 'review' | 'unsure';

  export interface CheckInResult {
    subId: string;
    action: CheckInAction;
    step1Reason: string | null;
    step2Reason: string | null;
    diveDeeperNote?: string | null;
  }

  // Check-In Log (stored in check_ins table — requires DB migration)
  export interface CheckInLog {
    id?: string;
    userId: string;
    subId: string;
    action: CheckInAction;
    q1Answer: string | null;
    q2Answer: string | null;
    diveDeeperNote: string | null;
    createdAt?: string;
  }
