/**
 * Deterministic audit scorer — v2
 * Rule Score Engine + Decision Layer per AUDIT_ARCHITECTURE_V2_CN.md
 * Pure functions, no API calls. Given same inputs → same outputs.
 */

import type {
  AuditSlots,
  AuditPersona,
  AuditRecommendationType,
  DecisionResult,
  ExpectedFrequency,
} from '@/lib/types';

// ---- RULES constant (DEFAULT_RULES from v2 spec) ----

const RULES = {
  // Need Fit (max 25)
  need_fit_scenario_specific: 22,
  need_fit_problem_aware: 18,
  need_fit_category_only: 14,
  need_fit_none: 10,
  need_fit_default: 12,

  // Usage (max 25)
  usage_daily: 25,
  usage_most_days: 23,
  usage_few_times: 18,
  usage_weekly: 14,
  usage_monthly: 6,
  usage_rarely: 0,
  usage_default: 10,

  // Budget (max 20)
  budget_comfortable: 16,
  budget_tight: 12,
  budget_steep: 7,
  budget_no_way: 3,
  budget_default: 10,
  budget_mandatory_bonus: 3,

  // Budget ratio
  ratio_low_threshold: 0.05,
  ratio_high_threshold: 0.15,
  ratio_low_bonus: 3,
  ratio_high_penalty: -3,

  // Cost-per-use
  cpu_benchmark: 2.0,
  cpu_high_ratio: 3.0,
  cpu_high_penalty: -3,
  cpu_mid_ratio: 1.5,
  cpu_mid_penalty: -1,
  cpu_low_ratio: 0.3,
  cpu_low_bonus: 2,

  // Overlap (max 15)
  overlap_none: 15,
  overlap_some: 10,
  overlap_significant: 4,
  overlap_high: 0,
  overlap_not_sure: 7,
  overlap_default: 7,
  no_subs_floor: 13,
  portfolio_min_count: 2,
  portfolio_max_usage: 0.4,
  portfolio_penalty: 3,

  // Risk (max 15)
  risk_none: 15,
  risk_mandatory_use: 13,
  risk_timeline_limited: 10,
  risk_free_enough: 10,
  risk_forget_cancel: 7,
  risk_interest_decay: 6,
  risk_not_sure: 5,
  risk_impulse: 4,
  risk_default: 8,

  // Cross-validation
  cv_high_need: 18,
  cv_low_usage: 9,
  cv_need_penalty: -3,
  cv_low_need: 14,
  cv_high_usage: 18,
  cv_usage_bonus: 2,
  cv_upgrading_overlap_penalty: -4,

  // Uncertainty
  unc_frequency: 3,
  unc_budget: 2,
  unc_motivation: 2,
  unc_overlap: 1,
  unc_risk: 1,
  unc_max: 10,
  unc_lifecycle_half: 0.5,

  // Decision thresholds
  threshold_subscribe: 75,
  threshold_trial: 60,
  threshold_watchlist: 45,
};

// ---- Score result ----

export interface ScoreResult {
  need_fit: number;
  usage: number;
  budget_fit: number;
  overlap: number;
  risk: number;
  uncertainty_penalty: number;
  total: number;
  not_sure_count: number;
  uncertainty_level: 'low' | 'medium' | 'high';
  cv_need_adj: number;
  cv_usage_adj: number;
  cv_upgrading_overlap_adj: number;
  had_before: boolean;
}

// ---- Helpers ----

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/** Convert expected_frequency string → monthly uses (for cost-per-use) */
function freqToMonthlyUses(freq: ExpectedFrequency): number {
  const map: Record<string, number> = {
    daily: 7 * 4.3,       // 30.1
    most_days: 4.5 * 4.3, // 19.35
    few_times: 2.5 * 4.3, // 10.75
    weekly: 1 * 4.3,      // 4.3
    monthly: 0.25 * 4.3,  // 1.075
    rarely: 0,
  };
  return map[freq] ?? 0;
}

// ---- computeScore ----

export function computeScore(slots: AuditSlots, persona: AuditPersona): ScoreResult {
  const ns: Record<string, boolean> = {};

  // ── Need Fit (max 25) ──
  let nf = RULES.need_fit_default;
  switch (slots.motivation_clarity) {
    case 'scenario_specific': nf = RULES.need_fit_scenario_specific; break;
    case 'problem_aware':     nf = RULES.need_fit_problem_aware; break;
    case 'category_only':     nf = RULES.need_fit_category_only; break;
    case 'none':              nf = RULES.need_fit_none; ns.motivation = true; break;
  }
  nf = clamp(Math.round(nf * persona.persona_alignment * 10) / 10, 0, 25);

  // ── Usage (max 25) ──
  let us = RULES.usage_default;
  const freq = slots.expected_frequency;
  switch (freq) {
    case 'daily':     us = RULES.usage_daily; break;
    case 'most_days': us = RULES.usage_most_days; break;
    case 'few_times': us = RULES.usage_few_times; break;
    case 'weekly':    us = RULES.usage_weekly; break;
    case 'monthly':   us = RULES.usage_monthly; break;
    case 'rarely':    us = RULES.usage_rarely; break;
    case 'not_sure':  ns.frequency = true; break;
  }
  if (slots.usage_certainty === 'conditional') {
    ns.frequency = true;
  }
  us = clamp(Math.round(us * persona.lifecycle_coeff * 10) / 10, 0, 25);

  // ── Cross-Validation ──
  let cvN = 0;
  let cvU = 0;
  let cvUO = 0;
  if (nf > RULES.cv_high_need && us < RULES.cv_low_usage) {
    cvN = RULES.cv_need_penalty;
  }
  if (nf < RULES.cv_low_need && us > RULES.cv_high_usage) {
    cvU = RULES.cv_usage_bonus;
  }
  if (
    slots.history_status === 'upgrading' &&
    (slots.overlap_level === 'significant' || slots.overlap_level === 'high')
  ) {
    cvUO = RULES.cv_upgrading_overlap_penalty;
  }
  nf = clamp(nf + cvN, 0, 25);
  us = clamp(us + cvU + cvUO, 0, 25);

  // ── Budget Fit (max 20) ──
  let bf = RULES.budget_default;
  switch (slots.budget_feel) {
    case 'comfortable': bf = RULES.budget_comfortable; break;
    case 'tight':       bf = RULES.budget_tight; break;
    case 'steep':       bf = RULES.budget_steep; break;
    case 'no_way':      bf = RULES.budget_no_way; break;
    case 'not_sure':    ns.budget = true; break;
  }

  // Price ratio adjustment
  const pm = slots.price_monthly;
  const bgt = persona.monthly_budget;
  if (pm && pm > 0 && bgt > 0) {
    const r = pm / bgt;
    if (r < RULES.ratio_low_threshold) bf = clamp(bf + RULES.ratio_low_bonus, 0, 20);
    if (r > RULES.ratio_high_threshold) bf = clamp(bf + RULES.ratio_high_penalty, 0, 20);
  }

  // Cost-per-use adjustment
  if (pm && pm >= 3 && freq && freq !== 'not_sure') {
    const mu = freqToMonthlyUses(freq);
    if (mu > 0) {
      const cpu = pm / mu / RULES.cpu_benchmark;
      if (cpu > RULES.cpu_high_ratio) bf = clamp(bf + RULES.cpu_high_penalty, 0, 20);
      else if (cpu > RULES.cpu_mid_ratio) bf = clamp(bf + RULES.cpu_mid_penalty, 0, 20);
      else if (cpu < RULES.cpu_low_ratio) bf = clamp(bf + RULES.cpu_low_bonus, 0, 20);
    }
  }

  // Forcing function bonus
  if (slots.forcing_function === 'academic' || slots.forcing_function === 'work' || slots.forcing_function === 'professional') {
    bf = clamp(bf + RULES.budget_mandatory_bonus, 0, 20);
  }

  // ── Overlap (max 15) ──
  let ov = RULES.overlap_default;
  switch (slots.overlap_level) {
    case 'none':        ov = RULES.overlap_none; break;
    case 'some':        ov = RULES.overlap_some; break;
    case 'significant': ov = RULES.overlap_significant; break;
    case 'high':        ov = RULES.overlap_high; break;
    case 'not_sure':    ov = RULES.overlap_not_sure; ns.overlap = true; break;
  }

  // Portfolio penalty
  if (
    persona.same_cat_count >= RULES.portfolio_min_count &&
    persona.same_cat_avg_usage < RULES.portfolio_max_usage
  ) {
    ov = Math.max(0, ov - RULES.portfolio_penalty);
  }

  // No existing subs floor
  if (persona.existing_subs_count === 0) {
    ov = Math.max(ov, RULES.no_subs_floor);
  }

  // ── Risk (max 15) ──
  let rk = RULES.risk_default;
  switch (slots.top_risk) {
    case 'none':             rk = RULES.risk_none; break;
    case 'mandatory_use':    rk = RULES.risk_mandatory_use; break;
    case 'timeline_limited': rk = RULES.risk_timeline_limited; break;
    case 'free_enough':      rk = RULES.risk_free_enough; break;
    case 'forget_cancel':    rk = RULES.risk_forget_cancel; break;
    case 'interest_decay':   rk = RULES.risk_interest_decay; break;
    case 'impulse':          rk = RULES.risk_impulse; break;
    case 'not_sure':         rk = RULES.risk_not_sure; ns.risk = true; break;
    case 'other':            rk = RULES.risk_default; break;
  }

  // Forcing function risk floor
  if (slots.forcing_function === 'academic' || slots.forcing_function === 'work' || slots.forcing_function === 'professional') {
    rk = Math.max(rk, RULES.risk_timeline_limited);
  }

  // ── Uncertainty Penalty (max 10) ──
  let unc = 0;
  let nsc = 0;
  if (ns.frequency)   { unc += RULES.unc_frequency; nsc++; }
  if (ns.budget)      { unc += RULES.unc_budget; nsc++; }
  if (ns.motivation)  { unc += RULES.unc_motivation; nsc++; }
  if (ns.overlap)     { unc += RULES.unc_overlap; nsc++; }
  if (ns.risk)        { unc += RULES.unc_risk; nsc++; }

  // Had experience before → uncertainty halved
  const had = (
    slots.history_status === 'cancelled' ||
    slots.history_status === 'upgrading' ||
    slots.history_status === 'free_trial' ||
    slots.history_status === 'familiar'
  );
  if (had) {
    unc = unc * RULES.unc_lifecycle_half;
  }
  unc = Math.min(RULES.unc_max, unc);

  // ── Total ──
  const total = clamp(
    Math.round((nf + us + bf + ov + rk - unc) * 10) / 10,
    0, 100,
  );

  const uncertainty_level: ScoreResult['uncertainty_level'] =
    nsc === 0 ? 'low' : nsc <= 2 ? 'medium' : 'high';

  return {
    need_fit: Math.round(nf * 10) / 10,
    usage: Math.round(us * 10) / 10,
    budget_fit: Math.round(bf * 10) / 10,
    overlap: Math.round(ov * 10) / 10,
    risk: Math.round(rk * 10) / 10,
    uncertainty_penalty: Math.round(unc * 10) / 10,
    total,
    not_sure_count: nsc,
    uncertainty_level,
    cv_need_adj: cvN,
    cv_usage_adj: cvU,
    cv_upgrading_overlap_adj: cvUO,
    had_before: had,
  };
}

// ---- Decision Layer ----

function getPrimaryDecision(score: number): AuditRecommendationType {
  if (score >= RULES.threshold_subscribe) return 'subscribe';
  if (score >= RULES.threshold_trial) return 'trial';
  if (score >= RULES.threshold_watchlist) return 'watchlist';
  return 'alternative';
}

export function getDecisionResult(finalScore: number, slots: AuditSlots): DecisionResult {
  const primary = getPrimaryDecision(finalScore);
  const timingIssue = slots.top_risk === 'timeline_limited';

  // Case 1: high score + timing issue → pure Delay
  if (finalScore >= 65 && timingIssue) {
    const suggestion = primary === 'subscribe'
      ? "This looks like a strong fit overall — the main question is timing. Worth revisiting once this limited-term phase passes."
      : "There's real value here, but it may make more sense to start when you'll actually have time to use it.";
    return {
      primary_decision: primary,
      final_recommendation: 'delay',
      timing_suggestion: suggestion,
      delay_triggered: true,
    };
  }

  // Case 2: mid score + timing issue → watchlist + timing modifier
  if (finalScore >= 45 && finalScore < 65 && timingIssue) {
    return {
      primary_decision: 'watchlist',
      final_recommendation: 'watchlist',
      timing_suggestion: "The fit isn't quite there yet — and the timing adds another reason to wait. Worth revisiting when both conditions change.",
      delay_triggered: true,
    };
  }

  // Default
  return {
    primary_decision: primary,
    final_recommendation: primary,
    timing_suggestion: null,
    delay_triggered: false,
  };
}

// ---- Helpers for display ----

export function recommendationToStatus(type: AuditRecommendationType | 'delay'): 'Good' | 'Fair' | 'Poor' {
  switch (type) {
    case 'subscribe': return 'Good';
    case 'trial':     return 'Good';
    case 'delay':     return 'Fair';
    case 'watchlist': return 'Fair';
    case 'alternative': return 'Poor';
    default: return 'Fair';
  }
}
