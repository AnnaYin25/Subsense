"""
audit_prompt.py — Python port of Audit v4 Claude conversation protocol
Source: AUDIT_V4_SPEC.pdf §2 (Conversation Flow) + §5.1 (System Prompt)

Changes from v3:
  - 7 stages (new: history_check at Stage 2)
  - input_mode can now be "slider" (Stage 4: expected_usage)
  - New slots: history_status, cancel_reason, motivation_clarity, additional_risk_note
  - Risk options completely redesigned
  - Echo Back rule: bubbles must start with 1–3 word acknowledgment
  - Mid-conversation summary between Stage 4 and Stage 5
  - Motivation follow-up when clarity = category_only
"""

import os
import json
import re
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any, Literal

import anthropic

# ─── Config ───────────────────────────────────────────────────────────────────

MODEL      = "claude-sonnet-4-20250514"
MAX_TOKENS = 800

_client: Optional[anthropic.Anthropic] = None

def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY not set. Add to .env or export in shell."
            )
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


# ─── Types ────────────────────────────────────────────────────────────────────

AuditStage = Literal[
    "service_price",
    "history_check",
    "motivation",
    "expected_usage",
    "budget_feel",
    "overlap_decision",
    "independent_risk",
]

InputMode = Literal["text", "options", "slider"]


@dataclass
class AuditSlots:
    """Mirrors TypeScript AuditSlots (v4) from Appendix A."""
    # Stage 1
    service_name:   Optional[str]   = None
    price:          Optional[float] = None
    billing_cycle:  Optional[str]   = None
    price_monthly:  Optional[float] = None
    # Stage 2
    history_status:           Optional[str]  = None
    cancel_reason:            Optional[str]  = None
    free_trial_limiting:      Optional[bool] = None
    history_source:           Optional[str]  = None
    previous_duration_months: Optional[int]  = None
    # Stage 3
    primary_motivation: Optional[str] = None
    motivation_note:    Optional[str] = None
    motivation_clarity: Optional[str] = None  # scenario_specific | problem_aware | category_only | none
    # Stage 4
    expected_frequency: Optional[float] = None  # 0 | 1 | 2.5 | 4.5 | 7
    # Stage 5
    budget_feel: Optional[str] = None
    # Stage 6
    overlap_level: Optional[str] = None
    # Stage 7 (redesigned)
    top_risk:             Optional[str] = None  # none | free_enough | forget_cancel | interest_decay | impulse | not_sure
    additional_risk_note: Optional[str] = None
    # Final gate
    additional_notes: Optional[str] = None

    def to_json(self) -> str:
        d = {k: v for k, v in asdict(self).items() if v is not None}
        return json.dumps(d, indent=2)


@dataclass
class AuditContext:
    stage:                  AuditStage
    turn_index:             int
    slots:                  AuditSlots
    monthly_budget:         float
    persona:                Dict[str, float]  # price_sensitivity, budget_tightness, waste_tolerance
    existing_subscriptions: List[Dict[str, Any]] = field(default_factory=list)
    user_name:              str = "User"
    interest_tags:          List[str] = field(default_factory=list)
    subscriber_type:        str = "balanced_user"


@dataclass
class AuditOption:
    id:    str
    label: str
    value: Any


@dataclass
class ClaudeAuditResponse:
    stage:         str
    turn_index:    int
    is_finished:   bool
    bubbles:       List[str]
    question:      str
    ui:            Dict[str, Any]     # input_mode: text | options | slider
    options:       List[AuditOption]
    slots_delta:   Dict[str, Any]
    missing_slots: List[str]
    flags:         Dict[str, bool]
    aha:           Dict[str, Any]


@dataclass
class ChatMessage:
    role:    Literal["user", "assistant"]
    content: str


# ─── System prompt builder ────────────────────────────────────────────────────

def build_system_prompt(ctx: AuditContext) -> str:
    subs_text = (
        ", ".join(f"{s['name']} (${s['cost']}/mo)" for s in ctx.existing_subscriptions)
        if ctx.existing_subscriptions else "None"
    )

    budget_pct = "unknown"
    if ctx.slots.price_monthly and ctx.monthly_budget > 0:
        pct = round((ctx.slots.price_monthly / ctx.monthly_budget) * 100)
        budget_pct = f"{pct}%"

    tags_text = ", ".join(ctx.interest_tags) if ctx.interest_tags else "unspecified"
    slots_json = ctx.slots.to_json()

    # Detect same-category subs for overlap stage
    service_category = "unknown"
    same_cat_subs = []
    if ctx.slots.primary_motivation:
        m = ctx.slots.primary_motivation.lower()
        if any(k in m for k in ["entert", "movie", "music", "game", "stream"]):
            service_category = "entertainment"
        elif any(k in m for k in ["work", "product", "tool", "learn"]):
            service_category = "productivity"
        elif any(k in m for k in ["health", "fitness", "workout"]):
            service_category = "health"
    same_cat_subs = [s for s in ctx.existing_subscriptions
                     if s.get("category", "").lower() == service_category]
    same_cat_text = (
        ", ".join(s["name"] for s in same_cat_subs)
        if same_cat_subs else "none detected"
    )

    return f"""You are SubSage AI — a friendly, sharp subscription advisor. You help users decide whether to subscribe to a new service through a structured 7-stage conversation.

## CURRENT SESSION STATE
User: {ctx.user_name}
Monthly budget: ${ctx.monthly_budget}
Existing subscriptions: {subs_text}
Same-category subscriptions: {same_cat_text}
Current stage: {ctx.stage}
Turn index: {ctx.turn_index}
Price as % of budget: {budget_pct}
Persona tags: {tags_text}
Subscriber type: {ctx.subscriber_type}
Collected slots:
{slots_json}

## STAGE MAP (7 stages — follow in order, never skip unless noted)
Stage 1 — service_price: Ask what service + price/billing cycle. Required: service_name, price.
  → input_mode: "text"
  → Extract in slots_delta: service_name (string), price (number), billing_cycle (monthly/yearly/weekly), price_monthly (number)

Stage 2 — history_check: Ask if they've used this service before.
  → Check history from existing subscriptions first; reference it if found.
  → input_mode: "options"
  → Options: [{{"id":"new","label":"Never tried it","value":"first_time"}}, {{"id":"cancel","label":"Tried it, cancelled","value":"cancelled"}}, {{"id":"upgrade","label":"Currently using, want to upgrade","value":"upgrading"}}, {{"id":"trial","label":"Used a free trial","value":"free_trial"}}]
  → If cancelled: follow up ONCE asking cancel reason: price / low_usage / found_alternative / other
  → If upgrading: skip Stage 4 entirely (usage stays at 23 pts by default)

Stage 3 — motivation: Ask primary reason. Required: primary_motivation + motivation_clarity.
  → input_mode: "options" with possible follow-up text
  → Options must include: work, entertainment, health, learning, social, creative, other
  → If user only selects chip (category_only), follow up ONCE: "What kind of {{motivation}} tasks are you picturing this for?"
  → Classify motivation_clarity in slots_delta: scenario_specific | problem_aware | category_only | none

Stage 4 — expected_usage: Ask realistic frequency. SKIP if history_status = "upgrading".
  → input_mode: "slider"
  → Slider maps: 0-10%=0(Rarely), 10-25%=1(Once/wk), 25-50%=2.5(Few times), 50-75%=4.5(Most days), 75-100%=7(Daily)
  → Adapt question wording to service type (streaming=days/wk, tools=times/wk, fitness=sessions/wk)

Stage 5 — budget_feel: Reference price as % of budget in the question.
  → Claude MUST say: "At ${"{price_monthly}"}/month — that's about {budget_pct} of your subscription budget — how does that feel?"
  → input_mode: "options"
  → Options: comfortable / tight / no_way / not_sure
  → BETWEEN Stage 4 and Stage 5: insert a non-question progress bubble: "Okay, here's what I have so far — {{service_name}}, ${{price}}/month, mainly for {{motivation}}. Almost there."

Stage 6 — overlap_decision: If same-category subs exist, name them in the question.
  → input_mode: "options"
  → Options: none / some / significant / high / not_sure

Stage 7 — independent_risk: Ask "Besides what we've already talked about, is there anything that makes you hesitate?"
  → input_mode: "options" (with text input always visible too — set allow_optional_note: true)
  → Options: none / free_enough / forget_cancel / interest_decay / impulse / not_sure
  → Store custom text in additional_risk_note

## CONVERSATION STYLE (§2.9)
- First bubble MUST start with 1–3 word acknowledgment: "Got it.", "Makes sense.", "$10.99 — noted.", "Fair enough."
- Never skip the acknowledgment — even a short "Got it." is required
- If user's answer is positive (comfortable/none/daily): may add one warm remark
- If user's answer is negative/vulnerable (no_way/impulse/interest_decay): stay respectful, never joke
- Maximum 2 bubbles (context) + 1 question per turn

## OUTPUT RULES
- Return ONLY valid JSON. No prose, no markdown, no code blocks.
- input_mode: "text" | "options" | "slider" (Stage 4 uses "slider")
- is_finished: always false — client enforces the finish guard
- slots_delta: extract ALL slot values from user's latest message
  → Stage 1: service_name, price, billing_cycle (monthly/yearly/weekly), price_monthly
  → Stage 2: history_status, cancel_reason (if cancelled), free_trial_limiting (if free_trial)
  → Stage 3: primary_motivation, motivation_note (if provided), motivation_clarity (scenario_specific/problem_aware/category_only/none)
  → Stage 4: expected_frequency (0/1/2.5/4.5/7)
  → Stage 5: budget_feel (comfortable/tight/no_way/not_sure)
  → Stage 6: overlap_level (none/some/significant/high/not_sure)
  → Stage 7: top_risk (none/free_enough/forget_cancel/interest_decay/impulse/not_sure), additional_risk_note (if provided)
  → CRITICAL: For Stage 1, if user says "X for $Y per month", extract: service_name="X", price=Y, billing_cycle="monthly", price_monthly=Y
- missing_slots: required slots for CURRENT stage that are still undefined (not 'not_sure')
- flags.contradiction: true if answer conflicts with previously collected slot
- flags.off_topic: true if user's message is not about subscription evaluation
- flags.price_cycle_unclear: true if price given without clear billing period
- aha.triggered: true ONLY if one of these conditions: (a) overlap=significant/high, (b) price>8% budget, (c) freq≤1 AND risk=forget_cancel/interest_decay, (d) contradiction, (e) history=cancelled+cancel_reason=low_usage, (f) risk=impulse
- aha.bubbles: max 1 item, ≤30 words, ends with concrete action hint

## RESPONSE JSON SCHEMA
{{
  "stage": "{ctx.stage}",
  "turn_index": {ctx.turn_index},
  "is_finished": false,
  "bubbles": ["string"],
  "question": "string",
  "ui": {{
    "input_mode": "options",
    "allow_optional_note": false,
    "note_hint": "",
    "max_chars": 80
  }},
  "options": [{{"id": "string", "label": "string", "value": "string | number"}}],
  "slots_delta": {{}},
  "missing_slots": [],
  "flags": {{
    "contradiction": false,
    "off_topic": false,
    "price_cycle_unclear": false
  }},
  "aha": {{
    "triggered": false,
    "bubbles": []
  }}
}}"""


# ─── Response parser ──────────────────────────────────────────────────────────

def _parse_response(text: str, ctx: AuditContext) -> ClaudeAuditResponse:
    try:
        match = re.search(r'\{[\s\S]*\}', text)
        if not match:
            raise ValueError("No JSON found")
        data = json.loads(match.group(0))

        options = [
            AuditOption(id=o.get("id", ""), label=o.get("label", ""), value=o.get("value", ""))
            for o in (data.get("options") or [])
        ]
        ui = data.get("ui") or {}

        return ClaudeAuditResponse(
            stage=data.get("stage", ctx.stage),
            turn_index=data.get("turn_index", ctx.turn_index),
            is_finished=False,
            bubbles=(data.get("bubbles") or [])[:2],
            question=data.get("question", ""),
            ui={
                "input_mode":         ui.get("input_mode", "options"),
                "allow_optional_note": ui.get("allow_optional_note", False),
                "note_hint":          ui.get("note_hint", ""),
                "max_chars":          ui.get("max_chars", 80),
            },
            options=options,
            slots_delta=data.get("slots_delta") or {},
            missing_slots=data.get("missing_slots") or [],
            flags={
                "contradiction":       bool((data.get("flags") or {}).get("contradiction", False)),
                "off_topic":           bool((data.get("flags") or {}).get("off_topic", False)),
                "price_cycle_unclear": bool((data.get("flags") or {}).get("price_cycle_unclear", False)),
            },
            aha={
                "triggered": bool((data.get("aha") or {}).get("triggered", False)),
                "bubbles":   ((data.get("aha") or {}).get("bubbles") or [])[:1],
            },
        )
    except Exception as e:
        print(f"[audit_prompt] parse error: {e}\nRaw: {text[:300]}")
        return _fallback_response(ctx)


def _fallback_response(ctx: AuditContext) -> ClaudeAuditResponse:
    """Local fallback — no API call — when Claude response is unparseable."""
    STAGE_FALLBACKS = {
        "service_price": (
            "What service are you considering, and what's the cost?",
            "text", 120, []
        ),
        "history_check": (
            f"Have you used this service before?",
            "options", 80, [
                AuditOption("new",     "Never tried it",              "first_time"),
                AuditOption("cancel",  "Tried it, cancelled",         "cancelled"),
                AuditOption("upgrade", "Currently using, want to upgrade", "upgrading"),
                AuditOption("trial",   "Used a free trial",           "free_trial"),
            ]
        ),
        "motivation": (
            "What's the main reason you want this subscription?",
            "options", 80, [
                AuditOption("work",     "Work / study",         "work"),
                AuditOption("entert",   "Entertainment",        "entertainment"),
                AuditOption("health",   "Health & fitness",     "health"),
                AuditOption("learn",    "Learning",             "learning"),
                AuditOption("social",   "Social / communication","social"),
                AuditOption("creative", "Creative / design",    "creative"),
                AuditOption("other",    "Other",                "other"),
            ]
        ),
        "expected_usage": (
            "How often would you realistically use it per week?",
            "slider", 80, []
        ),
        "budget_feel": (
            "How does the price feel relative to your budget?",
            "options", 80, [
                AuditOption("ok",    "Comfortable", "comfortable"),
                AuditOption("tight", "A stretch",   "tight"),
                AuditOption("noway", "Too much",    "no_way"),
                AuditOption("ns",    "Not sure",    "not_sure"),
            ]
        ),
        "overlap_decision": (
            "How much does it overlap with your current subscriptions?",
            "options", 80, [
                AuditOption("none",  "No overlap",                 "none"),
                AuditOption("some",  "A little",                   "some"),
                AuditOption("sig",   "Significant overlap",        "significant"),
                AuditOption("high",  "Very high / basically same", "high"),
                AuditOption("ns",    "Not sure",                   "not_sure"),
            ]
        ),
        "independent_risk": (
            "Besides what we've talked about — is there anything that makes you hesitate?",
            "options", 80, [
                AuditOption("none",    "No real concerns",            "none"),
                AuditOption("free",    "The free version might be enough","free_enough"),
                AuditOption("cancel",  "I might forget to cancel",    "forget_cancel"),
                AuditOption("decay",   "I tend to lose interest quickly","interest_decay"),
                AuditOption("impulse", "I'm being impulsive right now","impulse"),
                AuditOption("ns",      "Not sure",                    "not_sure"),
            ]
        ),
    }

    q, input_mode, max_chars, options = STAGE_FALLBACKS.get(
        ctx.stage, ("How can I help?", "text", 80, [])
    )

    return ClaudeAuditResponse(
        stage=ctx.stage,
        turn_index=ctx.turn_index,
        is_finished=False,
        bubbles=[],
        question=q,
        ui={"input_mode": input_mode, "allow_optional_note": ctx.stage == "independent_risk",
            "note_hint": "Add any other thoughts...", "max_chars": max_chars},
        options=options,
        slots_delta={},
        missing_slots=[],
        flags={"contradiction": False, "off_topic": False, "price_cycle_unclear": False},
        aha={"triggered": False, "bubbles": []},
    )


# ─── Public API ───────────────────────────────────────────────────────────────

def start_audit(ctx: AuditContext) -> ClaudeAuditResponse:
    """Send the first message to start Stage 1 (service_price)."""
    client = _get_client()
    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=build_system_prompt(ctx),
            messages=[{
                "role": "user",
                "content": "Start the audit. Ask me what service I am thinking of subscribing to.",
            }],
        )
        text = message.content[0].text if message.content else ""
        return _parse_response(text, ctx)
    except Exception as e:
        print(f"[audit_prompt] start_audit error: {e}")
        return _fallback_response(ctx)


def continue_audit(history: List[ChatMessage], ctx: AuditContext) -> ClaudeAuditResponse:
    """Continue the audit with the current message history."""
    client = _get_client()
    # print(f"[continue_audit] history={[(m.role, m.content[:40]) for m in history]}")
    try:
        messages = [{"role": m.role, "content": m.content} for m in history]
        message = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=build_system_prompt(ctx),
            messages=messages,
        )
        text = message.content[0].text if message.content else ""
        # print(f"[continue_audit] raw response (first 300 chars): {text[:300]}")
        return _parse_response(text, ctx)
    except Exception as e:
        import traceback
        print(f"[continue_audit] ERROR: {e}")
        traceback.print_exc()
        return _fallback_response(ctx)


def format_response(resp: ClaudeAuditResponse) -> str:
    """Pretty-print a ClaudeAuditResponse for debugging."""
    lines = [f"Stage: {resp.stage}  |  Turn: {resp.turn_index}  |  mode: {resp.ui.get('input_mode')}", ""]
    for b in resp.bubbles:
        lines.append(f"  💬 {b}")
    if resp.question:
        lines.append(f"  ❓ {resp.question}")
    if resp.options:
        for o in resp.options:
            lines.append(f"     [{o.id}] {o.label}  →  {o.value}")
    if resp.slots_delta:
        lines.append(f"\n  slots_delta: {resp.slots_delta}")
    if resp.aha.get("triggered"):
        lines.append(f"\n  ⚡ AHA: {resp.aha.get('bubbles', [])}")
    if any(resp.flags.values()):
        lines.append(f"  🚩 flags: {resp.flags}")
    return "\n".join(lines)
