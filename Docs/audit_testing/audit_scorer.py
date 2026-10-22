"""
audit_scorer.py — Python port of Audit v4 scoring logic
Source: AUDIT_V4_SPEC.pdf (2026-02-21)

Major changes from v3:
  - Need Fit: motivation_clarity-based (not keyword matching)
  - Budget Fit: feel-first (comfortable=18 base), max 20 not 25
  - Risk: completely new options, max 15 not 10
  - Uncertainty penalty: per-slot weighted (-3/-2/-2/-1/-1)
  - Recommendation thresholds raised: 75+/60/45
  - Cross-validation: Need Fit × Usage
  - Persona alignment coeff (0.7–1.3) on Need Fit
  - Lifecycle signal coeff (0.6–1.1) on Usage
  - Portfolio Pattern adjustor on Overlap
  - Cost-per-use adjustor (category benchmarks) on Budget Fit

Usage:
    from audit_scorer import AuditSlots, ScoringContext, score_audit, format_score_result
"""

from dataclasses import dataclass, field
from typing import Optional, Literal, List, Dict, Tuple

# ─── Type aliases ──────────────────────────────────────────────────────────────
RecommendationType = Literal["subscribe_now", "start_trial", "watchlist", "alternative"]
UncertaintyLevel   = Literal["low", "medium", "high"]

# ─── Tunable constants (notebook sliders can override these) ───────────────────

# § 1.2 Need Fit — motivation_clarity base scores
NEED_FIT_SCENARIO_SPECIFIC: float = 22.0  # described specific time/place/workflow
NEED_FIT_PROBLEM_AWARE:     float = 18.0  # named a gap/pain but no specific scenario
NEED_FIT_CATEGORY_ONLY:     float = 14.0  # just picked a chip / vague description
NEED_FIT_NONE:              float = 10.0  # not_sure or no answer
NEED_FIT_DEFAULT:           float = 12.0  # slot never reached (neutral)

# § 1.3 Expected Usage — frequency bucket → score
FREQUENCY_SCORE: Dict[float, float] = {
    0:   0.0,
    1:   10.0,
    2.5: 18.0,
    4.5: 23.0,
    7:   25.0,
}
FREQUENCY_NOT_SURE_SCORE: float = 10.0
USAGE_DEFAULT: float = 10.0
USAGE_UPGRADING_SCORE: float = 23.0  # history_status == 'upgrading' → skip, give 23

# § 1.4 Budget Fit — feel-first base scores (max 20)
BUDGET_FEEL_BASE: Dict[str, float] = {
    "comfortable": 18.0,
    "tight":       10.0,
    "no_way":       3.0,
    "not_sure":    10.0,
}
BUDGET_FIT_DEFAULT: float = 10.0  # slot never reached

# Budget Fit — ratio thresholds (before persona scaling)
RATIO_LOW_THRESHOLD:  float = 0.05   # < 5%  → +3
RATIO_HIGH_THRESHOLD: float = 0.15   # > 15% → -3
RATIO_LOW_BONUS:      float = 3.0
RATIO_HIGH_PENALTY:   float = -3.0
RATIO_ADJUST_MIN:     float = -5.0
RATIO_ADJUST_MAX:     float = 3.0

# § 1.4 Cost-per-use — category benchmarks ($ per use)
CATEGORY_BENCHMARKS: Dict[str, float] = {
    "entertainment": 0.50,
    "productivity":  2.00,
    "health":        3.00,
    "learning":      4.00,
    "social":        0.30,
    "creative":      3.00,
    "utilities":     5.00,
    "default":       2.00,
}
COST_PER_USE_RATIO_HIGH:  float = 3.0   # >3× benchmark → -3
COST_PER_USE_RATIO_MID:   float = 1.5   # >1.5× benchmark → -1
COST_PER_USE_RATIO_LOW:   float = 0.3   # <0.3× benchmark → +2
COST_PER_USE_SKIP_PRICE:  float = 3.0   # skip if price_monthly < $3
WEEKLY_USES_TO_MONTHLY:   float = 4.3   # × per week → per month

# § 1.5 Overlap — overlap_level base scores (max 15)
OVERLAP_SCORE: Dict[str, float] = {
    "none":        15.0,
    "some":        10.0,
    "significant":  4.0,
    "high":         0.0,
    "not_sure":     7.0,
}
OVERLAP_DEFAULT: float = 7.0
NO_EXISTING_SUBS_FLOOR: float = 13.0  # if no existing subs
PORTFOLIO_PATTERN_PENALTY: float = 3.0  # same_category_count >= 2 AND avg_usage < 0.4
PORTFOLIO_PATTERN_MIN_COUNT: int = 2
PORTFOLIO_PATTERN_MAX_USAGE: float = 0.4

# § 1.6 Independent Risk — new options (max 15)
RISK_SCORE: Dict[str, float] = {
    "none":           15.0,
    "free_enough":    10.0,
    "forget_cancel":   7.0,
    "interest_decay":  6.0,
    "not_sure":        5.0,
    "impulse":         4.0,
}
RISK_DEFAULT: float = 8.0   # slot never reached (neutral)

# § 1.8 Uncertainty Penalty — per-slot weighted
UNCERTAINTY_PENALTY_SLOTS: Dict[str, float] = {
    "expected_frequency": 3.0,
    "budget_feel":        2.0,
    "primary_motivation": 2.0,  # includes motivation_clarity = 'none'
    "overlap_level":      1.0,
    "top_risk":           1.0,
}
UNCERTAINTY_PENALTY_MAX: float = 10.0
LIFECYCLE_PENALTY_HALF_FACTOR: float = 0.5  # if had_before → penalty × 0.5

# § 1.9 Recommendation thresholds (raised from v3)
SUBSCRIBE_NOW_THRESHOLD: float = 75.0  # + uncertainty = low
START_TRIAL_THRESHOLD:   float = 60.0
WATCHLIST_THRESHOLD:     float = 45.0


# ─── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class AuditSlots:
    """
    All slots collected during an audit conversation.
    None  = slot never reached (unanswered).
    'not_sure' = user explicitly chose uncertainty.
    Mirrors TypeScript AuditSlots from Appendix A of AUDIT_V4_SPEC.pdf.
    """
    # Stage 1: service_price
    service_name:    Optional[str]   = None
    price:           Optional[float] = None
    billing_cycle:   Optional[str]   = None   # monthly | yearly | weekly | not_sure
    price_monthly:   Optional[float] = None   # client-derived

    # Stage 2: history_check (new in v4)
    history_status:            Optional[str]   = None   # first_time | cancelled | upgrading | free_trial
    cancel_reason:             Optional[str]   = None   # price | low_usage | found_alternative | other
    free_trial_limiting:       Optional[bool]  = None
    history_source:            Optional[str]   = None   # database | user_reported
    previous_duration_months:  Optional[int]   = None

    # Stage 3: motivation
    primary_motivation:  Optional[str] = None
    motivation_note:     Optional[str] = None
    motivation_clarity:  Optional[str] = None  # scenario_specific | problem_aware | category_only | none

    # Stage 4: expected_usage
    expected_frequency: Optional[float] = None   # 0 | 1 | 2.5 | 4.5 | 7 | None

    # Stage 5: budget_feel
    budget_feel: Optional[str] = None   # comfortable | tight | no_way | not_sure

    # Stage 6: overlap_decision
    overlap_level: Optional[str] = None  # none | some | significant | high | not_sure

    # Stage 7: independent_risk (new options in v4)
    top_risk:           Optional[str] = None  # none | free_enough | forget_cancel | interest_decay | impulse | not_sure
    additional_risk_note: Optional[str] = None

    # Final gate
    additional_notes: Optional[str] = None


@dataclass
class ScoringContext:
    slots:                   AuditSlots
    monthly_budget:          float
    price_sensitivity:       float   # 0.0–1.0 from persona (budget_tightness + price_sensitivity)
    existing_subscriptions:  List[Dict] = field(default_factory=list)
    # e.g. [{"name": "Spotify", "cost": 9.99, "category": "entertainment"}]
    category:                str   = "default"  # detected service category (for cost-per-use)
    persona_alignment_coeff: float = 1.0  # 0.7–1.3, from interest tags match
    lifecycle_coeff:         float = 1.0  # 0.6–1.1, from history_status
    same_category_count:     int   = 0    # how many same-category subs exist
    same_category_avg_usage: float = 1.0  # avg check-in usage rate (0–1)


@dataclass
class ScoreBreakdown:
    need_fit:            float
    usage:               float
    budget_fit:          float
    overlap:             float
    risk:                float
    uncertainty_penalty: float
    # Cross-validation adjustments (for debug)
    need_fit_cv_adj:     float = 0.0
    usage_cv_adj:        float = 0.0


@dataclass
class ScoreResult:
    total:               float
    breakdown:           ScoreBreakdown
    recommendation_type: RecommendationType
    uncertainty_level:   UncertaintyLevel
    not_sure_count:      int


# ─── Sub-scorers ───────────────────────────────────────────────────────────────

def _score_need_fit(slots: AuditSlots,
                    persona_alignment_coeff: float) -> Tuple[float, int]:
    """
    § 1.2 Need Fit (0–25): motivation clarity, not category bias.
    Returns (score, not_sure_count_increment).
    """
    ns = 0
    if slots.motivation_clarity is not None:
        base_map = {
            "scenario_specific": NEED_FIT_SCENARIO_SPECIFIC,
            "problem_aware":     NEED_FIT_PROBLEM_AWARE,
            "category_only":     NEED_FIT_CATEGORY_ONLY,
            "none":              NEED_FIT_NONE,
        }
        base = base_map.get(slots.motivation_clarity, NEED_FIT_CATEGORY_ONLY)
        if slots.motivation_clarity == "none":
            ns += 1   # "none" counts as not_sure for uncertainty penalty (§1.8)
    elif slots.primary_motivation is not None:
        # motivation answered but clarity not classified → category_only by default
        base = NEED_FIT_CATEGORY_ONLY
    else:
        # Slot never reached
        return NEED_FIT_DEFAULT, 0

    score = min(25.0, base * persona_alignment_coeff)
    return score, ns


def _score_usage(slots: AuditSlots, lifecycle_coeff: float) -> Tuple[float, int]:
    """
    § 1.3 Expected Usage (0–25): frequency bucket × lifecycle coeff.
    Returns (score, not_sure_count_increment).
    """
    ns = 0

    # Special case: upgrading skips expected_usage entirely
    if slots.history_status == "upgrading":
        return USAGE_UPGRADING_SCORE * lifecycle_coeff, 0

    if slots.expected_frequency is None:
        return USAGE_DEFAULT, 0   # slot never answered — neutral default, no ns_count

    freq = slots.expected_frequency
    if str(freq) == "not_sure" or freq == "not_sure":
        base = FREQUENCY_NOT_SURE_SCORE
        ns += 1
    else:
        base = FREQUENCY_SCORE.get(float(freq), USAGE_DEFAULT)

    score = min(25.0, base * lifecycle_coeff)
    return score, ns


def _score_budget_fit(slots: AuditSlots,
                      monthly_budget: float,
                      price_sensitivity: float,
                      category: str) -> Tuple[float, int]:
    """
    § 1.4 Budget Fit (0–20): feel-first base + ratio adjustment (persona-scaled) + cost-per-use.
    Returns (score, not_sure_count_increment).
    """
    ns = 0

    # Base from budget_feel
    if slots.budget_feel is None:
        base_feel = BUDGET_FIT_DEFAULT
    elif slots.budget_feel == "not_sure":
        base_feel = BUDGET_FEEL_BASE["not_sure"]
        ns += 1
    else:
        base_feel = BUDGET_FEEL_BASE.get(slots.budget_feel, BUDGET_FIT_DEFAULT)

    # Ratio adjustment (scaled by price_sensitivity)
    ratio_adjust = 0.0
    if slots.price_monthly is not None and monthly_budget > 0:
        ratio = slots.price_monthly / monthly_budget
        if ratio < RATIO_LOW_THRESHOLD:
            raw_adjust = RATIO_LOW_BONUS
        elif ratio > RATIO_HIGH_THRESHOLD:
            raw_adjust = RATIO_HIGH_PENALTY
        else:
            raw_adjust = 0.0

        if raw_adjust < 0:   # penalty: high sensitivity → larger penalty
            scale = 0.5 + (price_sensitivity * 1.0)   # 0.5–1.5
            ratio_adjust = round(raw_adjust * scale)
        elif raw_adjust > 0:  # bonus: high sensitivity → smaller bonus
            scale = 1.0 - (price_sensitivity * 0.5)   # 0.5–1.0
            ratio_adjust = round(raw_adjust * scale)

        ratio_adjust = max(RATIO_ADJUST_MIN, min(RATIO_ADJUST_MAX, ratio_adjust))

    # Cost-per-use adjustment
    cpu_adjust = 0.0
    skip_cpu = (
        slots.budget_feel == "no_way"
        or (slots.expected_frequency is not None and float(slots.expected_frequency or 0) >= 7)
        or (slots.price_monthly is not None and slots.price_monthly < COST_PER_USE_SKIP_PRICE)
    )
    if (not skip_cpu
            and slots.price_monthly is not None
            and slots.expected_frequency is not None
            and str(slots.expected_frequency) != "not_sure"
            and slots.expected_frequency is not None):
        monthly_uses = float(slots.expected_frequency) * WEEKLY_USES_TO_MONTHLY
        if monthly_uses > 0:
            cost_per_use = slots.price_monthly / monthly_uses
            benchmark = CATEGORY_BENCHMARKS.get(category, CATEGORY_BENCHMARKS["default"])
            ratio_to_bench = cost_per_use / benchmark
            if ratio_to_bench > COST_PER_USE_RATIO_HIGH:
                cpu_adjust = -3.0
            elif ratio_to_bench > COST_PER_USE_RATIO_MID:
                cpu_adjust = -1.0
            elif ratio_to_bench < COST_PER_USE_RATIO_LOW:
                cpu_adjust = 2.0

    budget_fit = min(20.0, max(0.0, base_feel + ratio_adjust + cpu_adjust))
    return budget_fit, ns


def _score_overlap(slots: AuditSlots,
                   existing_subscriptions: List[Dict],
                   same_category_count: int,
                   same_category_avg_usage: float) -> Tuple[float, int]:
    """
    § 1.5 Overlap (0–15): overlap_level + Portfolio Pattern adjustor.
    Returns (score, not_sure_count_increment).
    """
    ns = 0

    if slots.overlap_level is None:
        overlap = OVERLAP_DEFAULT
    elif slots.overlap_level == "not_sure":
        overlap = OVERLAP_SCORE["not_sure"]
        ns += 1
    else:
        overlap = OVERLAP_SCORE.get(slots.overlap_level, OVERLAP_DEFAULT)

    # Portfolio Pattern: already stacking same-category, low usage → extra penalty
    if (same_category_count >= PORTFOLIO_PATTERN_MIN_COUNT
            and same_category_avg_usage < PORTFOLIO_PATTERN_MAX_USAGE):
        overlap = max(0.0, overlap - PORTFOLIO_PATTERN_PENALTY)

    # No-existing-subs bonus
    if len(existing_subscriptions) == 0:
        overlap = max(overlap, NO_EXISTING_SUBS_FLOOR)

    return overlap, ns


def _score_risk(slots: AuditSlots) -> Tuple[float, int]:
    """
    § 1.6 Independent Risk (0–15): new options, only captures truly independent signals.
    Returns (score, not_sure_count_increment).
    """
    ns = 0

    if slots.top_risk is None:
        return RISK_DEFAULT, 0

    if slots.top_risk == "not_sure":
        ns += 1

    risk = RISK_SCORE.get(slots.top_risk, RISK_DEFAULT)
    return risk, ns


def _calc_uncertainty_penalty(slots: AuditSlots,
                               not_sure_flags: Dict[str, bool],
                               had_before: bool) -> Tuple[float, int]:
    """
    § 1.8 Uncertainty Penalty: per-slot weighted, not flat -2.
    Returns (penalty as positive number to subtract, not_sure_count).
    """
    total_penalty = 0.0
    ns_count = 0

    for slot_name, is_ns in not_sure_flags.items():
        if is_ns:
            total_penalty += UNCERTAINTY_PENALTY_SLOTS.get(slot_name, 0.0)
            ns_count += 1

    # Lifecycle halving: if user had this service before, their not_sure matters less
    if had_before:
        total_penalty *= LIFECYCLE_PENALTY_HALF_FACTOR

    total_penalty = min(UNCERTAINTY_PENALTY_MAX, total_penalty)
    return total_penalty, ns_count


# ─── Cross-validation ──────────────────────────────────────────────────────────

def _cross_validate(need_fit: float, usage: float) -> Tuple[float, float, float, float]:
    """
    § 1.7 Cross-Validation: Need Fit × Usage mutual correction.
    Returns (adjusted_need_fit, adjusted_usage, need_fit_adj, usage_adj).
    """
    need_adj = 0.0
    usage_adj = 0.0

    # "想要但可能不会真的用" — motivation is imagined, not real
    if need_fit > 18 and usage < 12:
        need_adj = -3.0

    # "说不清为什么要但确实会常用" — behavior speaks louder than words
    if need_fit < 14 and usage > 18:
        usage_adj = 2.0

    return need_fit + need_adj, usage + usage_adj, need_adj, usage_adj


# ─── Main scorer ───────────────────────────────────────────────────────────────

def score_audit(ctx: ScoringContext) -> ScoreResult:
    """
    Full v4 audit score calculation.
    Returns ScoreResult with total (0-100), breakdown, recommendation_type, uncertainty_level.
    """
    slots = ctx.slots
    had_before = slots.history_status in ("cancelled", "upgrading", "free_trial")

    # --- Need Fit ---
    need_fit_raw, ns_motivation = _score_need_fit(slots, ctx.persona_alignment_coeff)

    # --- Usage ---
    usage_raw, ns_freq = _score_usage(slots, ctx.lifecycle_coeff)

    # --- Budget Fit ---
    budget_fit, ns_budget = _score_budget_fit(
        slots, ctx.monthly_budget, ctx.price_sensitivity, ctx.category
    )

    # --- Overlap ---
    overlap, ns_overlap = _score_overlap(
        slots, ctx.existing_subscriptions, ctx.same_category_count, ctx.same_category_avg_usage
    )

    # --- Risk ---
    risk, ns_risk = _score_risk(slots)

    # --- Cross-Validation ---
    need_fit, usage, nf_cv_adj, us_cv_adj = _cross_validate(need_fit_raw, usage_raw)

    # --- Uncertainty Penalty ---
    not_sure_flags = {
        "expected_frequency": ns_freq > 0,
        "budget_feel":        ns_budget > 0,
        "primary_motivation": ns_motivation > 0,
        "overlap_level":      ns_overlap > 0,
        "top_risk":           ns_risk > 0,
    }
    uncertainty_penalty, ns_count = _calc_uncertainty_penalty(slots, not_sure_flags, had_before)

    # --- Total ---
    raw = need_fit + usage + budget_fit + overlap + risk - uncertainty_penalty
    total = min(100.0, max(0.0, raw))

    # --- Uncertainty Level ---
    if ns_count == 0:
        uncertainty_level: UncertaintyLevel = "low"
    elif ns_count <= 2:
        uncertainty_level = "medium"
    else:
        uncertainty_level = "high"

    # --- Recommendation (§1.9 — raised thresholds) ---
    if total >= SUBSCRIBE_NOW_THRESHOLD and uncertainty_level == "low":
        rec: RecommendationType = "subscribe_now"
    elif total >= START_TRIAL_THRESHOLD:
        rec = "start_trial"
    elif total >= WATCHLIST_THRESHOLD:
        rec = "watchlist"
    else:
        rec = "alternative"

    return ScoreResult(
        total=round(total, 1),
        breakdown=ScoreBreakdown(
            need_fit=round(need_fit, 1),
            usage=round(usage, 1),
            budget_fit=round(budget_fit, 1),
            overlap=round(overlap, 1),
            risk=round(risk, 1),
            uncertainty_penalty=round(uncertainty_penalty, 1),
            need_fit_cv_adj=nf_cv_adj,
            usage_cv_adj=us_cv_adj,
        ),
        recommendation_type=rec,
        uncertainty_level=uncertainty_level,
        not_sure_count=ns_count,
    )


def recommendation_to_status(rec: RecommendationType) -> Literal["Good", "Fair", "Poor"]:
    if rec in ("subscribe_now", "start_trial"):
        return "Good"
    if rec == "watchlist":
        return "Fair"
    return "Poor"


# ─── Pretty-print helper ───────────────────────────────────────────────────────

def format_score_result(result: ScoreResult) -> str:
    b = result.breakdown
    cv_notes = []
    if b.need_fit_cv_adj != 0:
        cv_notes.append(f"need_fit CV adj: {b.need_fit_cv_adj:+.0f}")
    if b.usage_cv_adj != 0:
        cv_notes.append(f"usage CV adj: {b.usage_cv_adj:+.0f}")
    cv_str = f"  ({', '.join(cv_notes)})" if cv_notes else ""

    lines = [
        f"{'Score':20s}: {result.total:.1f} / 100",
        f"{'Recommendation':20s}: {result.recommendation_type.upper()}",
        f"{'Uncertainty':20s}: {result.uncertainty_level} (not_sure ×{result.not_sure_count})",
        "",
        "  Breakdown (v4 weights: NeedFit/25, Usage/25, Budget/20, Overlap/15, Risk/15):",
        f"  {'need_fit':20s}: {b.need_fit:.1f} / 25{cv_str}",
        f"  {'usage':20s}: {b.usage:.1f} / 25",
        f"  {'budget_fit':20s}: {b.budget_fit:.1f} / 20",
        f"  {'overlap':20s}: {b.overlap:.1f} / 15",
        f"  {'risk':20s}: {b.risk:.1f} / 15",
        f"  {'uncertainty_penalty':20s}: -{b.uncertainty_penalty:.1f}",
    ]
    return "\n".join(lines)


# ─── Smoke test ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # "每天用，预算舒适，无重叠，无风险" → should be ≥85
    slots = AuditSlots(
        service_name      = "Spotify",
        price             = 9.99,
        billing_cycle     = "monthly",
        history_status    = "first_time",
        motivation_clarity= "scenario_specific",  # "I listen every morning commute"
        primary_motivation= "entertainment",
        expected_frequency= 7.0,
        budget_feel       = "comfortable",
        overlap_level     = "none",
        top_risk          = "none",
        price_monthly     = 9.99,
    )
    ctx = ScoringContext(
        slots=slots,
        monthly_budget=500.0,
        price_sensitivity=0.3,
        existing_subscriptions=[],
        category="entertainment",
    )
    result = score_audit(ctx)
    print("=== Smoke test: daily Spotify, comfortable, no overlap, no risk ===")
    print(format_score_result(result))
    print(f"\nExpected: ≥85 → {'✅' if result.total >= 85 else '❌'}")

    print()

    # "冲动购买者，之前因用太少取消过" → should be <50
    slots2 = AuditSlots(
        service_name      = "Some App",
        price             = 15.99,
        billing_cycle     = "monthly",
        history_status    = "cancelled",
        cancel_reason     = "low_usage",
        motivation_clarity= "category_only",
        primary_motivation= "entertainment",
        expected_frequency= 1.0,
        budget_feel       = "tight",
        overlap_level     = "some",
        top_risk          = "impulse",
        price_monthly     = 15.99,
    )
    ctx2 = ScoringContext(
        slots=slots2,
        monthly_budget=300.0,
        price_sensitivity=0.6,
        existing_subscriptions=[{"name": "Netflix", "cost": 15.99, "category": "entertainment"}],
        category="entertainment",
        lifecycle_coeff=0.6,  # cancelled due to low_usage
    )
    result2 = score_audit(ctx2)
    print("=== Smoke test: impulse buy, previously cancelled low_usage ===")
    print(format_score_result(result2))
    print(f"\nExpected: <50 → {'✅' if result2.total < 50 else '❌'}")
