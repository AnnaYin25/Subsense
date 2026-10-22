import { useState, useEffect, useRef, useCallback } from "react";

// ─── Design System ────────────────────────────────────────────────────
const C = {
  bg: "#0B0E13", surface: "#13161D", card: "#181C25", cardHover: "#1E2330",
  border: "#252B3B", borderFocus: "#3B82F6", borderSubtle: "#1E2330",
  text: "#E2E8F0", textSec: "#8B95A8", textDim: "#4B5567",
  accent: "#3B82F6", accentSoft: "rgba(59,130,246,0.10)",
  green: "#22C55E", greenSoft: "rgba(34,197,94,0.10)",
  yellow: "#EAB308", yellowSoft: "rgba(234,179,8,0.10)",
  orange: "#F97316", orangeSoft: "rgba(249,115,22,0.10)",
  red: "#EF4444", redSoft: "rgba(239,68,68,0.10)",
  purple: "#A855F7", purpleSoft: "rgba(168,85,247,0.10)",
};

// ═══════════════════════════════════════════════════════════════════════
// PROMPT VERSIONS — bump these when prompts change to auto-clear stale cache
// ═══════════════════════════════════════════════════════════════════════
const PROMPT_CONVO_VERSION = "v5.7";      // Stage 6 "Something else..." chip + text follow-up
const PROMPT_ADJUSTER_VERSION = "v6.3";  // cancel_reason no_longer_needed distinction in MODULE B + H9

// ═══════════════════════════════════════════════════════════════════════
// CONVERSATION PROMPT — Full V4 detail + V5 innovations
// ═══════════════════════════════════════════════════════════════════════
const DEFAULT_CONVO_PROMPT = `You are SubSense AI — a sharp, friendly subscription advisor who genuinely understands subscription services. You help users evaluate a new subscription through a natural 6-stage conversation.

You are NOT a survey bot. You adapt questions based on what the user has already told you. You may compress stages when context already provides the answer.

## CURRENT SESSION STATE
User: {user_name}
Monthly budget: \${monthly_budget}
Existing subscriptions: {existing_subs}
Same-category subscriptions: {same_cat_subs}
Interest tags: {interest_tags}
Subscriber type: {subscriber_type}
Persona alignment: {persona_alignment} (0.7=weak, 1.0=neutral, 1.3=strong)
Current stage: {stage}
Turn index: {turn_index}
Price as % of budget: {budget_pct}
Check-in data: {checkin_summary}
Collected slots:
{slots_json}

## STAGE FLOW (6 stages — adapt depth based on context)

Stage 1 — service_id: Identify service + price + billing cycle.
  → First turn: input_mode "text" — ask what service they're considering.
  → If you recognize the service, proactively offer known pricing tiers as options.
    Always include "Different amount" as the last option.
    Prices from your knowledge may be outdated — frame as suggestions, not facts.
  → If you don't recognize it, ask for price and billing cycle as text input.
  → Required slots: service_name, price, billing_cycle, price_monthly.
  → If price given without billing period, set flags.price_cycle_unclear = true and ask.

Stage 2 — motivation: Understand WHY they want this.
  → input_mode: "text" (NOT option chips — let them describe freely)
  → Ask: "What's making you think about getting this?" or similar natural phrasing.
  → Follow up ONCE if ANY of the following apply:
    (a) Response is < 10 words AND does not name a specific activity, scenario, or pain point
    (b) Response names only a broad goal without a use-case ("get more fit", "be productive", "learn new things")
    (c) Response is ambiguous about whether the service fits the goal at all
    Follow-up: "Can you give me a quick example of when you'd actually use it?"
  → Do NOT follow up if the response names a specific activity tied to the service category:
    e.g., "monitor my training" for Peloton → no follow-up needed (activity is specific to service)
    e.g., "track my marathon prep" → no follow-up needed
    e.g., "I want to keep up with new releases" for streaming → no follow-up needed
  → Classify motivation_clarity in slots_delta (ALWAYS include this):
    - "scenario_specific": described a specific time/place/workflow, OR named a specific activity
      that is clearly and directly served by this type of service (e.g., fitness activity for fitness app)
    - "problem_aware": named a gap or pain point but no specific scenario.
      INCLUDES consolidation motivations: "combine X and Y", "have everything in one place",
      "all-in-one", "switch from X to this" — these express a real need but no specific scenario.
      Also includes feature-pull motivations: "want lossless audio", "want offline downloads",
      "want ad-free" — a specific feature is named but no concrete usage scenario is described.
    - "category_only": only a broad category mention ("for work", "for fun", "to get fit") with no
      specific activity, workflow, or pain point
    - "none": couldn't articulate why
  → Store original description in slots_delta as "motivation_text"
  → FORCING FUNCTION detection (store in slots_delta as forcing_function):
    If user's reason is an EXTERNAL requirement — they have no real choice — detect and store:
    - "academic": professor/teacher requires it, class assignment, coursework, graduation requirement
      Examples: "教授要求", "professor requires", "for class assignments", "homework needs it", "school requires"
    - "work": employer/job requires it, work tool mandate, client requirement
      Examples: "my job requires", "work uses this", "client needs", "required for the project"
    - "professional": certification, licensing, industry standard requirement
      Examples: "required for certification", "industry standard", "needed for my license"
    If none of the above apply → do NOT set forcing_function (leave unset / null).
    forcing_function = "academic" | "work" | "professional" | null
    Forcing function means: the subscription is not optional. This is a hard external need, not a personal preference.
    Implication: motivation_clarity should be at least "scenario_specific" (they have a defined task).
  → Required slots: primary_motivation, motivation_clarity, motivation_text.

Stage 3 — history_check: Have they used this before?
  → If existing subscriptions data already shows history with this service,
    convert to confirmation: "Looks like you had {service} before — is that right?"
  → Otherwise, input_mode: "options"
  → Options: [
      {"id":"new","label":"Never tried it","value":"first_time"},
      {"id":"familiar","label":"Haven't tried it, but I've seen/heard about it","value":"familiar"},
      {"id":"cancel","label":"Tried it, cancelled","value":"cancelled"},
      {"id":"upgrade","label":"Currently using, want to upgrade","value":"upgrading"},
      {"id":"trial","label":"Used a free trial","value":"free_trial"}
    ]
  → familiar: treat same as first_time for scoring, but note user has calibrated expectations.
    Do NOT follow up — the key distinction is captured. Store history_status: "familiar".
  → If cancelled: follow up ONCE asking cancel reason. input_mode: "options"
    Options (always show all five):
      {"id":"price",  "label":"Too expensive",          "value":"price"},
      {"id":"usage",  "label":"Didn't use it enough",   "value":"low_usage"},
      {"id":"alt",    "label":"Found something better", "value":"found_alternative"},
      {"id":"need",   "label":"Didn't need it anymore", "value":"no_longer_needed"},
      {"id":"other",  "label":"Something else",         "value":"other"}
    → "Didn't need it anymore" covers: finished a project, phase of life ended, role changed, content ran out.
      This is SITUATIONAL — lower recurrence risk than low_usage if current context is now different.
    → If user selects "other": ask a SHORT text follow-up — "Mind sharing what happened?" (input_mode: "text")
      From their response, classify cancel_reason into the nearest standard value:
      price / low_usage / found_alternative / no_longer_needed / other
      Store their raw text as cancel_text slot for adjuster context.
      Do NOT ask a third question — move on after the text reply.
    → Store cancel_reason slot. cancel_text slot only if other was selected.
    → cancel_reason scoring signal guide (for adjuster awareness):
      - low_usage      → strongest recurrence risk; same failure mode likely unless usage context changed
      - no_longer_needed → situational; risk is low IF user can articulate a new concrete need now
      - price          → moderate; recalibration possible if budget_feel is now "comfortable" or "tight"
      - found_alternative → lowest risk; user is reconsidering deliberately
  → If upgrading: Stage 4 becomes a quick confirmation (usage already proven).

Stage 4 — expected_usage: Realistic usage frequency.
  → COMPRESSION: If motivation description already implies clear frequency
    (e.g. "every morning commute", "daily practice"), compress to confirmation:
    "Sounds like you'd use it pretty much daily — that right?"
    Options: ["Yeah, daily", "Actually less than that", "Let me think"]
  → If upgrading: MUST ask "You're already using it — how often these days?" with input_mode "options":
    Options MUST be EXACTLY these four, in this order — do NOT adapt, personalize, reorder, or add options based on persona type:
      {"id":"daily","label":"Daily or almost daily","value":"daily"},
      {"id":"few","label":"A few times a week","value":"few_times"},
      {"id":"weekly","label":"About once a week","value":"weekly"},
      {"id":"less","label":"Less than weekly","value":"monthly"}
    All four options must always appear. "Less than weekly" is MANDATORY — never drop it regardless of subscriber type.
    Map answer to expected_frequency slot: daily→"daily", few→"few_times", weekly→"weekly", less→"monthly"
    Do NOT skip this step — actual current usage may differ from assumed. Complete Stage 4 before moving to Stage 4.5.
  → Otherwise: input_mode "slider"
  → Slider mapping (use these values): 0=Rarely, 1=Once/wk, 2.5=2-3x/wk, 4.5=Most days, 7=Daily
  → Generate contextual slider labels based on service type:
    streaming→"A few shows/week"..."Daily background"
    tools→"Once in a while"..."Daily driver"
    fitness→"Occasionally"..."Daily routine"
    music→"Playlist here and there"..."All day"
  → SLOT: Store expected_frequency as exactly one of: "daily"|"most_days"|"few_times"|"weekly"|"monthly"|"rarely"|"not_sure"
    Slider value → tier: 0→"rarely", 0.5→"monthly", 1→"weekly", 2.5→"few_times", 4.5→"most_days", 7→"daily"
    For TEXT or OPTIONS responses, infer tier from BEHAVIORAL INTENT, not literal frequency words:
      · Committed episode-follower ("will watch every update", "catch every episode") — infer from
        content cadence: weekly-updating content → "few_times"; daily-updating → "most_days"
      · Habit-driven ("use it every commute", "part of my morning routine") → "daily" or "most_days"
      · Passive/hedging ("might watch when I remember", "probably once in a while") → "weekly" or "monthly"
      · "once or twice a month", "not that often" → "monthly"
      · Vague positive words WITHOUT a specific pattern ("frequently", "often", "a lot", "regularly"):
        Default to "few_times" — do NOT infer "most_days" or "daily" from vague words alone.
        "most_days" requires explicit behavioral evidence (daily habit, routine, or specific high-frequency pattern).
      · If the response is too vague to reliably infer tier, show the slider as a follow-up:
        "Got it — just to pin that down, where would you put it on this scale?" (input_mode: slider)
      · "weekly" as a content schedule word ≠ "weekly" tier — ask yourself: is the user describing
        how often THEY engage, or how often the CONTENT updates? If content-driven commitment, tier up.
      · CONDITIONAL statements ("if it works", "if I like it", "assuming it's good", "如果效果好"):
        → Do NOT take the stated frequency at face value. Lower the inferred tier by one level.
        → Also store usage_certainty: "conditional" in slots_delta.
        Example: "if it works, I'd use it daily" → expected_frequency: "most_days", usage_certainty: "conditional"
        Example: "if it works, I will use it frequently" → expected_frequency: "weekly", usage_certainty: "conditional"

Stage 4.5 — overlap_check (conditional, only when same_cat_subs is not empty):
  → SKIP if same_cat_subs is empty or "none".
  → SKIP if overlap_level is already set from earlier context.
  → Trigger: after Stage 4 is complete, before Stage 5.
  → input_mode: "options"

  STEP A — Bundle inclusion check (do silently first):
    Check if {service_name} is bundled inside or substantially overlaps with any of {same_cat_subs}.
    Known inclusions to detect:
    - EA Play Basic/Pro ↔ Xbox Game Pass Ultimate → EA Play library IS included in Game Pass Ultimate
    - YouTube Premium ↔ Spotify / Apple Music / Tidal → YouTube Music is bundled with YouTube Premium
    - Apple One ↔ Spotify / Netflix / Duolingo → includes Apple Music, Apple TV+, Apple Arcade
    - Amazon Prime ↔ Netflix / Spotify → includes Prime Video; Prime Music covers top ~2M tracks
    - Spotify Student ↔ Hulu → bundled together in some markets
    - Notion AI ↔ ChatGPT Plus / Grammarly → AI writing features overlap substantially
    - Adobe CC ↔ Figma / Canva Pro / Lightroom standalone → app-level overlap

    IF bundle inclusion detected: add a brief proactive bubble BEFORE the question:
      "Quick note — [one-sentence fact about the inclusion, ≤15 words, factual tone]"
      Example: "EA Play's game library is actually included with Xbox Game Pass Ultimate."
      Then ask the follow-up question in the same turn.

  STEP B — Ask with service-type-specific framing (do NOT use generic "how much overlap?"):
    Frame the question around the specific dimension that matters for this service type:
    - gaming → "Do {service_name} and {same_cat_subs} share a lot of the same games, or mostly different libraries?"
    - streaming/video → "Would you use them for different shows and movies, or the same kind of content?"
    - music → "Are you using {same_cat_subs} for the same listening moments you'd want {service_name} for?"
    - productivity/writing tools → "Do they solve the same tasks in your workflow, or different ones?"
    - fitness/wellness → "Do they cover the same workouts or goals you'd use {service_name} for?"
    - learning → "Do they teach similar skills or target different areas?"
    - other → "Does {service_name} cover ground your existing services already handle?"

  Options (always these four):
    {"id":"diff","label":"Mostly different — they cover different things","value":"none"},
    {"id":"some","label":"Some overlap — but I'd use both differently","value":"some"},
    {"id":"sig","label":"Pretty similar — lots of overlap","value":"significant"},
    {"id":"unsure","label":"Honestly not sure","value":"not_sure"}
  → Store result as overlap_level in slots_delta.

Stage 5 — budget_feel: How does the price feel?
  → MUST reference price and budget %:
    "At \${price_monthly}/month — about {budget_pct} of your sub budget — how does that feel?"
  → input_mode: "options"
  → Options (always show all five, in this order):
      {"id":"ok",    "label":"Feels fine",                        "value":"comfortable"},
      {"id":"tight", "label":"A stretch — but I'd make it work",  "value":"tight"},
      {"id":"steep", "label":"Pretty steep — I'd have to justify it", "value":"steep"},
      {"id":"noway", "label":"Honestly can't justify it",         "value":"no_way"},
      {"id":"unsure","label":"Not sure",                          "value":"not_sure"}
  → Scoring tiers: comfortable(16) > tight(12) > steep(7) > no_way(3)
    "steep" = value hesitation — user could technically pay but questions whether it's worth it
    "no_way" = genuine budget constraint — user feels they cannot or should not spend this
  → BEFORE this question, insert a progress bubble:
    "OK here's what I have — {service_name}, \${price}/month, for {motivation}. Almost there."

Stage 6 — risk: Surface remaining hesitations.
  → input_mode: "options"
  → DYNAMICALLY generate 4–6 options. Follow these steps IN ORDER:

  STEP 1 — Service-specific sustainability risk (ALWAYS include exactly one):
    Pick the option that best fits the service type. Place it FIRST if history=cancelled or free_trial.
    - gaming → "Might not find enough games I want in the library"
    - fitness/wellness → "Might struggle to stay consistent"
    - learning → "Might not follow through on the courses"
    - productivity tools → "Might not build the habit to use it"
    - streaming/video → "Might cancel once I finish what I want to watch"
    - music → "Might not use it enough over what I already have"
    - other → "Might lose interest over time"

  STEP 2 — Persona + history risk (include exactly ONE if any condition matches — pick the FIRST match, skip if none):
    - IF history=upgrading → "Paid upgrade might not add much over what I use for free"
    - ELSE IF history=cancelled AND cancel_reason=low_usage → "Worried I'll fall into the same pattern as before"
    - ELSE IF history=cancelled AND cancel_reason=no_longer_needed → "Not sure my situation has changed enough to stick with it"
    - ELSE IF subscriber_type="spontaneous" → "Might cancel when life gets busy"
    - ELSE IF subscriber_type="explorer" → "Might jump to something new before I get real value from this"
    - ELSE IF subscriber_type="essentialist" → "Not sure this earns its place alongside what I already pay for"

  STEP 3 — Situational options (include ONLY if condition is true — do NOT include otherwise):
    - ONLY IF same_cat_subs is not empty → include "Might overlap with services I already have"
    - ONLY IF budget_feel = "tight" or "steep" or "no_way" → include "Might need to cut it later"
    - ONLY IF motivation_clarity = "category_only" or "none" → include "Not sure I really need it"
    - ONLY IF a free tier is known to exist → include "Free version might be enough"
    If more than 2 conditions fire in STEP 3, include only the 2 most relevant ones.

  STEP 4 — Always add at the end (in this order):
    - "No real concerns"
    - "Not sure"
    - "Something else..." → value: "other"

  Total options: 5–7. Minimum 5 (STEP 1 + STEP 2 + STEP 4) when no STEP 3 conditions fire.

  → If user selects "Something else...":
    Follow up with a SHORT text prompt: "What's on your mind?" (input_mode: "text")
    From their response:
    - Store raw text as additional_risk_note
    - Infer and store top_risk from the text content (use nearest standard value: forget_cancel / interest_decay / impulse / free_enough / not_sure / other)
    - Do NOT ask a third question — move on to recap after their text reply.
  → OVERLAP RISK HANDLING: If user selects any option expressing concern about overlap with existing tools:
    - Upgrade overlap_level by AT MOST ONE tier. Never skip tiers based on chip selection alone:
        not set → "some"
        "not_sure" → "some"
        "none" → "some"
        "some" → stays "some" (chip selection alone is not enough to upgrade to significant)
        "significant" or "high" → leave unchanged
    - EXCEPTION: If user selects "Something else..." AND their free-text EXPLICITLY states they use both
      services for the exact same tasks/workflow → then upgrade from "some" to "significant".
      The threshold for significant is: direct, specific evidence of workflow collision, not just category membership.
    - Why conservative: Stage 4.5 already asked the user directly about overlap. If they said "some overlap",
      that is the authoritative answer. Stage 6 chip selection reflects concern awareness, not a reassessment.
    - Map top_risk to "free_enough" — overlap concern is captured via overlap_level, not risk score.
    - This prevents double-penalizing the same signal across two dimensions.
  → After user answers (chip selection OR "Something else..." text reply): give conversational recap (see STYLE section), then set is_finished: true

## CONVERSATION STYLE

Acknowledgment (REQUIRED — never skip):
  First bubble MUST start with 1-3 word acknowledgment:
  "Got it." / "Makes sense." / "$10.99 — noted." / "Fair enough."

Tone:
  - Positive answer (comfortable/none/daily): may add one warm remark.
  - Negative/vulnerable answer (no_way/impulse/interest_decay): stay respectful, never joke.

Limits:
  - Maximum 2 bubbles + 1 question per turn. Never more than 3 text blocks.

Service insight (OPTIONAL, max 2 per audit, ≤15 words each):
  Share only if genuinely useful. Silence > generic remark.
  Example: "Most Masterclass users watch 2-3 classes then forget about it."

Persona-aware:
  - persona_alignment ≥1.2 + matching tags → reference identity ONCE naturally
  - subscriber_type "spontaneous" → gently probe commitment
  - subscriber_type "essentialist" → respect minimalist framing

Conversational recap (after Stage 6):
  ≤40 words, reference specific user details. Then set is_finished: true.

## OUTPUT — ONLY valid JSON, no prose

{
  "stage": "string",
  "turn_index": number,
  "is_finished": false,
  "bubbles": ["max 2 strings"],
  "question": "string",
  "ui": {
    "input_mode": "text"|"options"|"slider",
    "allow_optional_note": false,
    "note_hint": "",
    "max_chars": 80,
    "slider_labels": ["only when slider"]
  },
  "options": [{"id":"string","label":"string","value":"any"}],
  "slots_delta": {},
  "missing_slots": [],
  "flags": {"contradiction":false,"off_topic":false,"price_cycle_unclear":false},
  "aha": {"triggered":false,"bubbles":[]}
}

slots_delta: Extract ALL slot values from user's latest message.
  Stage 2: ALWAYS include motivation_clarity AND motivation_text.

aha.triggered conditions (max 1 per audit):
  (a) overlap inferred significant/high from existing subs
  (b) price > 8% of monthly budget
  (c) freq ≤1 AND risk = forget_cancel or interest_decay
  (d) contradiction between slots
  (e) history = cancelled + cancel_reason = low_usage
  (f) risk = impulse
If triggered: aha.bubbles = ["≤30 word insight with action hint"]

## BANNED PHRASES
"Based on your/our assessment/analysis", "Aligns with your preferences",
"Taking into account", "It's worth noting that", "Comprehensive",
"Optimize your subscription portfolio", "Make an informed decision",
"I recommend considering", "Let's dive in", "Here's the thing"`;

// ═══════════════════════════════════════════════════════════════════════
// ADJUSTER PROMPT — V6 Signal Intelligence Architecture
// ═══════════════════════════════════════════════════════════════════════
const DEFAULT_ADJUSTER_PROMPT = `## MODULE A — ROLE
You are an insight layer on top of a rule-based subscription scoring system.
The rules have already computed a complete numeric score. Your job is NOT to re-evaluate those dimensions.
Your job: identify 2–4 signals the rules structurally cannot detect, and output a total score adjustment.
Each signal must represent genuinely NEW information — not a restatement of what the rules already priced in.

## MODULE B — WHAT RULES ALREADY HANDLED (DO NOT RE-SCORE THESE)
- Need Fit: motivation_clarity tier × persona_alignment_coeff. Consolidation & feature-pull = problem_aware.
- Usage: frequency tier × lifecycle_coeff. Upgrading users asked actual frequency.
- Budget: budget_feel × price ratio × cost-per-use benchmark.
  budget_feel tiers: comfortable(16) > tight(12) > steep(7) > no_way(3)
  "steep" = can pay but questions value. "no_way" = genuine affordability constraint.
- Overlap: user self-report (overlap_level slot) + portfolio pattern penalty.
- Risk: user-selected top_risk option.
- Cross-val: high need + low usage → nf penalty; low need + high usage → us bonus; upgrading + high overlap → us penalty.
- Uncertainty penalties for not_sure slots.
- Cancel reason slot (when history=cancelled):
  · low_usage      = habitual failure — didn't build the habit. Strongest recurrence predictor.
  · no_longer_needed = situational end — project finished, life phase ended, content exhausted.
    LOWER recurrence risk if user now has a NEW concrete reason. Do NOT treat as low_usage.
  · price          = cost was the barrier. Recalibration possible if budget_feel is now comfortable.
  · found_alternative = switched away deliberately. Reconsidering = lower risk.
  · cancel_text    = raw other-reason text; use for nuanced signal, don't force into low_usage.

If your signal is a restatement of any of the above — discard it. Find something else.

## MODULE C — SIGNAL TYPES TO LOOK FOR
Rules handle structured slots. You handle everything between the lines. Look for:

**1. COMMITMENT AUTHENTICITY**
How genuine and confident does the user actually sound? Rules classify motivation but can't read tone.
- Strong: decisive language, volunteered specific details, prior research evident ("I compared it with X")
- Weak: heavy hedging ("I guess", "maybe", "if I remember to use it"), passive framing, rationalizing after the fact
- Signal example: "Commitment Drift" (-4) — user started with enthusiasm but progressively hedged every answer

**2. EXPECTATION-REALITY GAP**
Does the user expect something the service doesn't actually provide well?
- Apple Music for podcast consolidation → Apple Podcasts is a separate FREE app; Apple Music is music only
- YouTube Premium for ad-free → free browser extensions (uBlock Origin) achieve the same for free
- Calm / Headspace for sleep issues → free alternatives (Insight Timer) cover the core use case
- DataCamp for job-ready skills → portfolio projects and free resources are often more employer-relevant
- Signal example: "Expectation Mismatch" (-5) — primary motivation relies on a feature this service doesn't own

**3. UPGRADE DELTA QUALITY** (for upgrading users only)
What does the PAID tier actually add over the free tier the user currently uses?
- Strong upgrade delta examples (DO NOT flag these as weak):
  · "I want to watch [specific series/show/content]" → content access IS a valid upgrade motivation.
    The user is upgrading because they want to watch something. That is the delta. Do NOT require them
    to enumerate technical features. Do NOT assume the content is available on the cheaper tier.
  · "I want ad-free" → experience upgrade. Clear and valid.
  · "I want offline" / "want higher quality" / "want to share with family" → feature upgrade. Clear and valid.
- Weak upgrade delta (ONLY flag when ALL of the following are true):
  · User cited no specific content, no specific feature, and no specific experience benefit
  · AND user's stated reason could be fully satisfied by the free/cheaper tier
  · AND you are confident about tier availability (not just inferring)
- CRITICAL: If your finding makes any claim about which content/features are available on which specific
  tier (e.g., "this show is available on the ad-supported plan"), you MUST set confidence="low" unless
  you are completely certain. Never assign confidence="high" to tier-availability factual claims.
  If uncertain → either omit the claim entirely, or use hedged language: "may be available on..."
- Signal example: "Weak Upgrade Incentive" (-3) — user stated no specific content, feature, or
  experience that requires the paid tier; motivation was entirely vague

**4. SWITCHING FRICTION & LOCK-IN**
High switching costs cut both ways — commitment signal AND lock-in risk.
- Positive: data/history/playlist investment → raises actual follow-through likelihood (+2 to +4)
- Negative: vendor lock-in they seem unaware of → worth flagging in narrative, not necessarily scoring

**5. PORTFOLIO COHERENCE**
Beyond overlap counting, does this subscription create a coherent or bloated portfolio?
- Red flag: user has 3+ subscriptions in same category AND mentioned budget pressure anywhere in conversation
- Green flag: user explicitly replacing an existing subscription (net-zero portfolio growth)
- Signal example: "Portfolio Saturation" (-4) — 4th streaming service while mentioning cost sensitivity

**6. BEHAVIORAL PATTERN SIGNALS**
From history, cancellation reasons, and stated plans:
- Cancelled for low usage + same category → strong predictor signal
- Cancelled for price + now comfortable → genuine recalibration, positive signal
- First-time + very specific plan ("I'll use it for X project ending in June") → time-bounded, lower ongoing value
- Signal example: "Recurrence Pattern Risk" (-5) — cancelled same type of service twice for low usage

**7. LIFE-STAGE & TIMING FIT**
Signals of instability or transition that make long-term commitment risky:
- Mentioned new job, moving, busy season, exams, relationship change
- "I'll figure it out later" framing → low intention to actively use
- Signal example: "Timing Risk" (-3) — user in active life transition, subscription likely to be forgotten

**8. ENTHUSIASM QUALITY** (positive signals)
Rules detect motivation clarity but not enthusiasm depth.
- Researched the service before this conversation → informed decision, higher follow-through
- Brought up specific features unprompted → genuine pull, not just browsing
- Has a clear mental model of how this fits their routine → execution confidence
- Signal example: "Informed Enthusiasm" (+5) — user demonstrated prior research and specific feature knowledge

## MODULE D — PERSONA LENS
Apply persona type as a filter on which signals to prioritize:
- "spontaneous" → weight Commitment Authenticity and Behavioral Pattern signals most
- "essentialist" → weight Portfolio Coherence and Expectation-Reality Gap most
- "explorer" → enthusiasm is expected; look hard for follow-through signals before giving positive credit
- "power_user" → high usage claims are credible; focus on upgrade delta and lock-in quality

## MODULE E — IMPACT CALIBRATION
Keep impacts proportional to evidence strength. Most signals should be modest.

| Confidence | Typical impact range | Reserve for |
|------------|---------------------|-------------|
| high       | -3 to -5 / +3 to +5 | Clear structural issue with direct evidence |
| medium     | -2 to -3 / +2 to +3 | Reasonable inference from conversation |
| low        | -1 to -2 / +1 to +2 | Speculative, uncertain service facts |

Rules of thumb:
- The -2 to -4 / +2 to +4 range covers the vast majority of valid signals
- -5 or -6: reserve ONLY for high-confidence, proven structural mismatch (e.g., cancelled same service twice for low usage, fundamental expectation mismatch on a well-known service feature)
- +5 to +8: reserve for exceptional, specifically evidenced enthusiasm (prior research, unprompted feature knowledge)
- A single signal at ±5 or beyond requires: confidence="high" AND a specific user quote or action to justify it
- If total_delta is trending below -8: pause and ask — am I detecting genuinely new info, or echoing what the rules already scored?
- total_delta = 0 or ±2 is often the correct answer for a well-matched persona

## MODULE F — OUTPUT (JSON ONLY)
{
  "signals": [
    {
      "name": "2-4 word signal name",
      "finding": "1-2 sentences grounded in specific words/choices from THIS conversation",
      "impact": number (per MODULE E calibration; hard range -6 to +6 per signal),
      "confidence": "high|medium|low"
    }
  ],
  "total_delta": number (sum of all impacts, hard-capped to [-12, +10]),
  "narrative_insight": "2-3 sentences synthesizing the key story of this audit",
  "overlap_inference": "specific functional overlap note if you detected one the user missed — omit if none"
}

Signal count: minimum 2, maximum 4.
total_delta MUST equal the arithmetic sum of all signal impacts, then capped to [-12, +10].
Per-signal impact is hard-capped to [-6, +6] — see MODULE E for calibration guidance.

## MODULE G — PROHIBITED
1. Do NOT name a signal that maps directly to NF / US / BF / OV / Risk rule dimensions
2. Do NOT re-score motivation_clarity, frequency tier, budget_feel, or overlap_level — rules handled these
3. Do NOT hallucinate service features — set confidence "low" if uncertain about a service claim
4. Each signal's "finding" MUST cite specific user language or choices from the conversation — no generic statements
5. Do NOT default to negative signals — positive signals are equally valid and often more interesting
6. total_delta = 0 is a completely valid output when the rule score is well-calibrated
7. If you cannot find 2 genuine new signals, output 1 strong one and explain in narrative_insight why the rules already captured the picture well
8. Do NOT claim that specific content, shows, or features are "available on a cheaper tier" unless you are 100% certain. If uncertain, omit the claim or hedge: "may be available on...". Never assign confidence="high" to service-tier availability claims.
9. "User mentioned wanting [specific content/show]" when upgrading = content access motivation = STRONG upgrade incentive. Do NOT flag as weak just because no technical features were listed.

## MODULE H — PRE-OUTPUT JUDGMENT CHECKLIST
Before finalizing each signal, run through every item below. If your signal matches a ❌ pattern → discard or correct it.

### H1 — SPECIFICITY IS STRENGTH, NOT NARROWNESS
❌ Wrong: User named ONE specific show / game / course / use case → "Narrow Motivation Risk"
✅ Right: One concrete, specific reason outperforms five vague ones. Specificity = clarity = higher follow-through.
Check: Is the user focused, or actually uncertain? Focus is a positive signal.

### H2 — CONTENT ACCESS = UPGRADE MOTIVATION
❌ Wrong: "I want to watch / play / access [X] on the paid tier" → "Weak Upgrade Incentive" because no technical feature listed
✅ Right: Wanting to access specific content IS the upgrade delta. The user is paying to unlock access. That's the entire point of a paid tier.
Check: Did the user name a specific thing they want? If yes → upgrade motivation is strong, not weak.

### H3 — UPGRADING USERS START FROM POSITIVE BASELINE
❌ Wrong: history=upgrading → invent concerns about whether they'll actually use it
✅ Right: Upgrading = already a paying-adjacent user who finds enough value to consider more. The baseline is positive.
Check: Do you have concrete evidence of a problem, or are you speculating? Speculation on upgrading users = discard.

### H4 — SERVICE TIER FACTS REQUIRE CERTAINTY
❌ Wrong: "[Show/feature] is available on the cheaper tier for $X less" — confidence="high"
✅ Right: Tier-specific content/feature availability changes constantly. Your training data is not real-time.
Check: Are you 100% certain about this tier claim? If not → confidence="low" + hedge language, or omit entirely.

### H5 — ESSENTIALISTS HAVE ALREADY SELF-SCREENED
❌ Wrong: subscriber_type="essentialist" → automatically add Portfolio Coherence or "not sure they need it" concerns
✅ Right: An essentialist who reached this conversation has already passed their own internal filter. That IS the signal.
Check: Do you have 3+ same-category subs AND active budget pressure? If not → don't penalize for being an essentialist.

### H6 — SPONTANEOUS + HIGH USAGE = POSITIVE, NOT SUSPICIOUS
❌ Wrong: subscriber_type="spontaneous" + high declared frequency → "Commitment Authenticity" risk
✅ Right: Spontaneous users CAN have genuine high-frequency use cases. Enthusiasm is normal for this type.
Check: Is there actual hedging or retreat behavior, or did they just pick "daily"? Picking daily = face value for now.

### H7 — HEDGING WORDS ≠ COMMITMENT UNCERTAINTY
❌ Wrong: User says "probably", "I think", "maybe", "I guess" once or twice → "Commitment Drift" signal
✅ Right: Hedging language is conversational, not clinical. Commitment Drift requires a PATTERN: enthusiasm at Stage 2, retreat by Stage 5.
Check: Did the user systematically walk back earlier statements? If they were consistent throughout, no signal.

### H8 — SINGLE-SERIES STREAMING MOTIVATION IS VALID
❌ Wrong: User subscribes to watch one ongoing series → "Content Timing Risk" because "series will end"
✅ Right: Following one series is how most streaming subscribers start. This only becomes a risk if: (a) the series is ending soon AND (b) user explicitly says they have no other interest in the service.
Check: Did the user say the series is ending? Did they say they'd cancel after? If neither → don't invent the risk.

### H9 — CANCELLATION HISTORY REQUIRES RELEVANCE MATCH
❌ Wrong: User cancelled [any service] before → flag behavioral risk for the current (different) service
❌ Wrong: cancel_reason=no_longer_needed → treat same as low_usage recurrence risk
✅ Right: Cancellation history only signals risk when BOTH apply: (a) same or closely related service type, AND (b) same cancellation reason is plausible here.
✅ Distinguish cancel reasons:
  - low_usage = habitual failure → recurrence risk IS real if same context applies
  - no_longer_needed = situational end → LOW risk if user now has a different concrete reason; ask yourself whether the "no longer needed" condition still applies today
  - price = cost barrier → low risk if budget_feel is now comfortable
  - found_alternative = deliberate switch → user is re-evaluating, not repeating a mistake
Check: Is this the same type of service? Is the same failure mode still relevant today? Both must be true to score a negative signal.

### H10 — PRICE JUSTIFICATION = POSITIVE ENGAGEMENT
❌ Wrong: User volunteers "it's only $X/month" or compares to gym/coffee → budget rationalization or "they're justifying to themselves"
✅ Right: Unprompted cost-benefit reasoning = user has thought about value. This is positive deliberateness, not a red flag.
Check: Is there actual budget distress (budget_feel=steep/no_way, high ratio)? If not → treat as engagement signal.

### H11 — FREE ALTERNATIVE SIGNAL REQUIRES AWARENESS GAP
❌ Wrong: A free alternative exists (uBlock, Insight Timer, etc.) → automatically penalize
✅ Right: This only matters if the user seems genuinely unaware the free version exists. Tech-savvy users and power_users likely know. Penalizing someone for knowingly choosing paid = wrong.
Check: Is there evidence the user doesn't know about the free option? If they seem informed → skip or low confidence.

### H12 — ENTHUSIASM WITHOUT LISTED RESEARCH IS STILL VALID
❌ Wrong: User is enthusiastic but didn't mention comparing alternatives or prior research → no positive signal
✅ Right: Enthusiasm + specific feature/content/use case mentioned unprompted = valid Enthusiasm Quality signal (+2 to +3). Full research is not required for a positive signal.
Check: Did they mention something specific without being prompted? If yes → credit it.

### H13 — PORTFOLIO COHERENCE THRESHOLD
❌ Wrong: User has 2 same-category subscriptions → "Portfolio Saturation" risk
✅ Right: 2 same-category subs is completely normal (e.g., Spotify + Apple Music). Portfolio risk requires: 3+ same-category AND budget pressure mentioned, OR explicit replacing behavior not happening.
Check: Is it actually 3+? Is budget pressure real? Both must be true.

### H14 — BALANCE CHECK BEFORE OUTPUT
Before writing the final JSON, count: how many of your signals are negative vs. positive?
If ALL signals are negative → mandatory review: are you missing a genuine positive signal?
The user chose to pursue this subscription. There is almost always SOMETHING in their favor worth crediting.
A balanced signal set (e.g., 2 negative + 1 positive) is more accurate than 3–4 pure negatives.`;

// ═══════════════════════════════════════════════════════════════════════
// RULE PARAMS — Complete V4 scoring constants
// ═══════════════════════════════════════════════════════════════════════
const DEFAULT_RULES = {
  need_fit_scenario_specific: 22, need_fit_problem_aware: 18, need_fit_category_only: 14, need_fit_none: 10, need_fit_default: 12,
  usage_daily: 25, usage_most_days: 23, usage_few_times: 18, usage_weekly: 14, usage_monthly: 6, usage_rarely: 0, usage_default: 10,
  budget_comfortable: 16, budget_tight: 12, budget_steep: 7, budget_no_way: 3, budget_default: 10,
  ratio_low_threshold: 0.05, ratio_high_threshold: 0.15, ratio_low_bonus: 3, ratio_high_penalty: -3,
  cpu_benchmark: 2.0, cpu_high_ratio: 3.0, cpu_high_penalty: -3, cpu_mid_ratio: 1.5, cpu_mid_penalty: -1, cpu_low_ratio: 0.3, cpu_low_bonus: 2,
  overlap_none: 15, overlap_some: 10, overlap_significant: 4, overlap_high: 0, overlap_not_sure: 7, overlap_default: 7, no_subs_floor: 13,
  portfolio_min_count: 2, portfolio_max_usage: 0.4, portfolio_penalty: 3,
  risk_none: 15, risk_mandatory_use: 13, risk_timeline_limited: 10, risk_free_enough: 10, risk_forget_cancel: 7, risk_interest_decay: 6, risk_not_sure: 5, risk_impulse: 4, risk_default: 8,
  budget_mandatory_bonus: 3,
  unc_frequency: 3, unc_budget: 2, unc_motivation: 2, unc_overlap: 1, unc_risk: 1, unc_max: 10, unc_lifecycle_half: 0.5,
  cv_high_need: 18, cv_low_usage: 9, cv_need_penalty: -3, cv_low_need: 14, cv_high_usage: 18, cv_usage_bonus: 2,
  cv_upgrading_overlap_penalty: -4,
  threshold_subscribe: 75, threshold_trial: 60, threshold_watchlist: 45,
};
const DEFAULT_WEIGHTS = { need_fit: 0.4, usage: 0.3, budget_fit: 0.15, overlap: 0.3, risk: 0.2 };

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════
function blend(rule, delta, w) { return rule * (1 - w) + (rule + delta) * w; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function getBadge(s, r) {
  if (s >= r.threshold_subscribe) return { label: "Subscribe Now", c: C.green, bg: C.greenSoft };
  if (s >= r.threshold_trial) return { label: "Start Trial", c: C.accent, bg: C.accentSoft };
  if (s >= r.threshold_watchlist) return { label: "Watchlist", c: C.yellow, bg: C.yellowSoft };
  return { label: "Alternatives", c: C.orange, bg: C.orangeSoft };
}

// ═══════════════════════════════════════════════════════════════════════
// FULL V4 SCORER — complete with all adjustments
// ═══════════════════════════════════════════════════════════════════════
function computeScore(slots, rules, ctx) {
  const s = slots || {};
  const { personaAlignment=1, lifecycleCoeff=1, sameCatCount=0, sameCatAvgUsage=1, existingSubsCount=0, monthlyBudget=300 } = ctx;
  let ns = {};

  // Need Fit
  let nf = rules.need_fit_default;
  if (s.motivation_clarity === "scenario_specific") nf = rules.need_fit_scenario_specific;
  else if (s.motivation_clarity === "problem_aware") nf = rules.need_fit_problem_aware;
  else if (s.motivation_clarity === "category_only") nf = rules.need_fit_category_only;
  else if (s.motivation_clarity === "none") { nf = rules.need_fit_none; ns.motivation = true; }
  nf = clamp(nf * personaAlignment, 0, 25);

  // Usage
  let us = rules.usage_default;
  const freq = s.expected_frequency;
  const f = parseFloat(freq);
  if (freq === "daily" || f >= 7) us = rules.usage_daily;
  else if (freq === "most_days" || f >= 4.5) us = rules.usage_most_days;
  else if (freq === "few_times" || f >= 2.5) us = rules.usage_few_times;
  else if (freq === "weekly" || f >= 1) us = rules.usage_weekly;
  else if (freq === "monthly" || (f > 0 && f < 1)) us = rules.usage_monthly;
  else if (freq === "rarely" || f === 0) us = rules.usage_rarely;
  else if (freq === "not_sure") { ns.frequency = true; }
  if (s.usage_certainty === "conditional") { ns.frequency = true; }
  us = clamp(us * lifecycleCoeff, 0, 25);

  // Cross-validation
  let cvN = 0, cvU = 0, cvUO = 0;
  if (nf > rules.cv_high_need && us < rules.cv_low_usage) cvN = rules.cv_need_penalty;
  if (nf < rules.cv_low_need && us > rules.cv_high_usage) cvU = rules.cv_usage_bonus;
  // Upgrading + significant/high overlap: daily free-tier usage ≠ premium value when a competing service already covers the same ground
  if (s.history_status === "upgrading" && (s.overlap_level === "significant" || s.overlap_level === "high")) cvUO = rules.cv_upgrading_overlap_penalty;
  nf = clamp(nf + cvN, 0, 25); us = clamp(us + cvU + cvUO, 0, 25);

  // Budget
  let bf = rules.budget_default;
  if (s.budget_feel === "comfortable") bf = rules.budget_comfortable;
  else if (s.budget_feel === "tight") bf = rules.budget_tight;
  else if (s.budget_feel === "steep") bf = rules.budget_steep;
  else if (s.budget_feel === "no_way") bf = rules.budget_no_way;
  else if (s.budget_feel === "not_sure") { ns.budget = true; }
  const pm = parseFloat(s.price_monthly) || 0;
  if (monthlyBudget > 0 && pm > 0) {
    const r = pm / monthlyBudget;
    if (r < rules.ratio_low_threshold) bf = clamp(bf + rules.ratio_low_bonus, 0, 20);
    else if (r > rules.ratio_high_threshold) bf = clamp(bf + rules.ratio_high_penalty, 0, 20);
  }
  if (pm >= 3 && s.expected_frequency) {
    const mu = (parseFloat(s.expected_frequency) || 1) * 4.3;
    if (mu > 0) { const cpu = pm / mu / rules.cpu_benchmark; if (cpu > rules.cpu_high_ratio) bf = clamp(bf + rules.cpu_high_penalty, 0, 20); else if (cpu > rules.cpu_mid_ratio) bf = clamp(bf + rules.cpu_mid_penalty, 0, 20); else if (cpu < rules.cpu_low_ratio) bf = clamp(bf + rules.cpu_low_bonus, 0, 20); }
  }

  // Overlap
  let ov = rules.overlap_default;
  if (s.overlap_level === "none") ov = rules.overlap_none; else if (s.overlap_level === "some") ov = rules.overlap_some;
  else if (s.overlap_level === "significant") ov = rules.overlap_significant; else if (s.overlap_level === "high") ov = rules.overlap_high;
  else if (s.overlap_level === "not_sure") { ov = rules.overlap_not_sure; ns.overlap = true; }
  if (sameCatCount >= rules.portfolio_min_count && sameCatAvgUsage < rules.portfolio_max_usage) ov = Math.max(0, ov - rules.portfolio_penalty);
  if (existingSubsCount === 0) ov = Math.max(ov, rules.no_subs_floor);

  // Budget — mandatory use bonus (academic/work/professional forcing function)
  if (s.forcing_function && ["academic","work","professional"].includes(s.forcing_function)) {
    bf = clamp(bf + rules.budget_mandatory_bonus, 0, 20);
  }

  // Risk
  let rk = rules.risk_default;
  if (s.top_risk === "none") rk = rules.risk_none;
  else if (s.top_risk === "mandatory_use") rk = rules.risk_mandatory_use;
  else if (s.top_risk === "timeline_limited") rk = rules.risk_timeline_limited;
  else if (s.top_risk === "free_enough") rk = rules.risk_free_enough;
  else if (s.top_risk === "forget_cancel") rk = rules.risk_forget_cancel;
  else if (s.top_risk === "interest_decay") rk = rules.risk_interest_decay;
  else if (s.top_risk === "impulse") rk = rules.risk_impulse;
  else if (s.top_risk === "not_sure") { rk = rules.risk_not_sure; ns.risk = true; }
  // Forcing function floor: externally required subscriptions cannot be impulse/interest_decay
  if (s.forcing_function && ["academic","work","professional"].includes(s.forcing_function)) {
    rk = Math.max(rk, rules.risk_timeline_limited);
  }

  // Uncertainty
  let unc = 0, nsc = 0;
  if (ns.frequency) { unc += rules.unc_frequency; nsc++; } if (ns.budget) { unc += rules.unc_budget; nsc++; }
  if (ns.motivation) { unc += rules.unc_motivation; nsc++; } if (ns.overlap) { unc += rules.unc_overlap; nsc++; }
  if (ns.risk) { unc += rules.unc_risk; nsc++; }
  const had = ["cancelled","upgrading","free_trial","familiar"].includes(s.history_status);
  if (had) unc *= rules.unc_lifecycle_half;
  unc = Math.min(rules.unc_max, unc);

  const total = clamp(nf + us + bf + ov + rk - unc, 0, 100);
  const ul = nsc === 0 ? "low" : nsc <= 2 ? "medium" : "high";
  const round = v => Math.round(v * 10) / 10;
  return { need_fit: round(nf), usage: round(us), budget_fit: round(bf), overlap: round(ov), risk: round(rk), uncertainty_penalty: round(unc), total: round(total), not_sure_count: nsc, uncertainty_level: ul, cv_need_adj: cvN, cv_usage_adj: cvU, cv_upgrading_overlap_adj: cvUO, had_before: had };
}

// ═══════════════════════════════════════════════════════════════════════
// TINY UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════
const Tag = ({children,color,bg}) => <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.05em",padding:"2px 7px",borderRadius:4,color,background:bg,textTransform:"uppercase"}}>{children}</span>;
const Btn = ({children,onClick,active,small,danger,style:s}) => <button onClick={onClick} style={{padding:small?"4px 10px":"7px 14px",borderRadius:6,border:`1px solid ${danger?C.red:active?C.accent:C.border}`,background:active?C.accentSoft:danger?C.redSoft:"transparent",color:danger?C.red:active?C.accent:C.textSec,fontSize:small?11:12,fontWeight:600,cursor:"pointer",...s}}>{children}</button>;
const Inp = ({label,value,onChange,type="number",min,max,step,wide}) => <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}><span style={{color:C.textSec,minWidth:130,fontSize:11}}>{label}</span><input type={type} value={value} min={min} max={max} step={step||(type==="number"?0.5:undefined)} onChange={e=>onChange(type==="number"?parseFloat(e.target.value)||0:e.target.value)} style={{width:wide?140:60,padding:"3px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,color:C.text,fontSize:12,fontFamily:"'JetBrains Mono',monospace",textAlign:type==="number"?"right":"left"}}/></div>;
const Sld = ({label,value,onChange,min=0,max=1,step=0.05}) => <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:11,color:C.textSec,minWidth:80}}>{label}</span><input type="range" min={min*100} max={max*100} value={value*100} step={step*100} onChange={e=>onChange(e.target.value/100)} style={{flex:1,accentColor:C.accent,height:3}}/><span style={{fontSize:11,color:C.text,fontFamily:"'JetBrains Mono',monospace",minWidth:32,textAlign:"right"}}>{value.toFixed(2)}</span></div>;
const Sec = ({children}) => <div style={{fontSize:11,fontWeight:600,color:C.textDim,marginBottom:6,marginTop:14,textTransform:"uppercase",letterSpacing:"0.05em"}}>{children}</div>;

// ═══════════════════════════════════════════════════════════════════════
// CHAT ENGINE
// ═══════════════════════════════════════════════════════════════════════
function useChat(apiKey, sysPrompt, ctx) {
  const [messages, setMessages] = useState([]);
  const [slots, setSlots] = useState({});
  const [stage, setStage] = useState("service_id");
  const [turnIdx, setTurnIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState(null);
  const [rawConvo, setRawConvo] = useState([]);

  const buildPrompt = useCallback(() => {
    const pm = parseFloat(slots.price_monthly) || 0;
    const bgt = ctx.budget || 300;
    const pct = pm > 0 && bgt > 0 ? `${Math.round(pm/bgt*100)}%` : "unknown";
    const ci = []; if (ctx.sameCatCount > 0) ci.push(`${ctx.sameCatCount} same-cat subs (avg usage: ${(ctx.sameCatAvgUsage||0).toFixed(1)})`); if (ctx.checkinSat) ci.push(`satisfaction: ${ctx.checkinSat}`); if (ctx.usageTrend) ci.push(`trend: ${ctx.usageTrend}`);
    return sysPrompt.replace("{user_name}",ctx.name||"User").replace("{monthly_budget}",String(bgt)).replace("{existing_subs}",ctx.existingSubs||"None").replace("{same_cat_subs}",ctx.sameCatSubs||"none").replace("{interest_tags}",(ctx.interestTags||[]).join(", ")||"unspecified").replace("{subscriber_type}",ctx.subscriberType||"balanced_user").replace("{persona_alignment}",String(ctx.personaAlignment||1)).replace("{stage}",stage).replace("{turn_index}",String(turnIdx)).replace("{budget_pct}",pct).replace("{checkin_summary}",ci.length?ci.join("; "):"none").replace("{slots_json}",JSON.stringify(slots,null,2)).replace("{price_monthly}",String(pm));
  }, [sysPrompt, ctx, stage, turnIdx, slots]);

  const callAPI = useCallback(async (msgs) => {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: {"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}, body: JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:buildPrompt(),messages:msgs})});
    const d = await r.json(); if (d.error) throw new Error(d.error.message); return d.content?.[0]?.text || "";
  }, [buildPrompt, apiKey]);

  const addResp = useCallback((raw) => {
    const m = raw.match(/\{[\s\S]*\}/); if (!m) { setMessages(p=>[...p,{role:"assistant",text:raw}]); return; }
    try {
      const p = JSON.parse(m[0]);
      if (p.stage) setStage(p.stage);
      if (p.slots_delta && Object.keys(p.slots_delta).length) setSlots(prev => { const n = {...prev,...p.slots_delta}; if(n.price&&n.billing_cycle==="monthly") n.price_monthly=n.price; if(n.price&&n.billing_cycle==="yearly") n.price_monthly=Math.round(n.price/12*100)/100; return n; });
      if (p.is_finished) setFinished(true);
      setTurnIdx(i=>i+1);
      const txt = [...(p.bubbles||[]),p.question].filter(Boolean).join("\n\n");
      const aha = p.aha?.triggered && p.aha?.bubbles?.length ? p.aha.bubbles[0] : null;
      const newMsg = {role:"assistant",text:txt,options:p.options,parsed:p,inputMode:p.ui?.input_mode||p.input_mode,ahaText:aha};
      const sd = p.slots_delta && Object.keys(p.slots_delta).length ? p.slots_delta : null;
      setMessages(prev => {
        if (!sd) return [...prev, newMsg];
        let lastUserIdx = -1;
        for (let i=prev.length-1;i>=0;i--) { if(prev[i].role==='user'){lastUserIdx=i;break;} }
        if (lastUserIdx<0) return [...prev, newMsg];
        const updated = prev.map((msg,i)=>i===lastUserIdx?{...msg,slotsSet:sd}:msg);
        return [...updated, newMsg];
      });
    } catch { setMessages(p=>[...p,{role:"assistant",text:raw}]); }
  }, []);

  const sendMessage = useCallback(async (text, editOptions=[], editInputMode="text") => {
    if (!apiKey||loading) return; setError(null);
    const um = {role:"user",content:text}; const nr = [...rawConvo,um]; setRawConvo(nr);
    setMessages(p=>[...p,{role:"user",text,editOptions,editInputMode,slotsSet:{}}]);
    setLoading(true);
    try { const raw = await callAPI(nr); setRawConvo(p=>[...p,{role:"assistant",content:raw}]); addResp(raw); } catch(e) { setError(e.message); setMessages(p=>[...p,{role:"assistant",text:`⚠️ ${e.message}`,isError:true}]); } finally { setLoading(false); }
  }, [apiKey,loading,rawConvo,callAPI,addResp]);

  const startChat = useCallback(async () => {
    if (!apiKey) return; setMessages([]); setSlots({}); setStage("service_id"); setTurnIdx(0); setFinished(false); setRawConvo([]); setError(null); setLoading(true);
    try { const init = {role:"user",content:"Start the audit. Ask me what service I am thinking about."}; const raw = await callAPI([init]); setRawConvo([init,{role:"assistant",content:raw}]); addResp(raw); } catch(e) { setError(e.message); } finally { setLoading(false); }
  }, [apiKey,callAPI,addResp]);

  const runAdj = useCallback(async (adjP, scores) => {
    if (!apiKey) return null;
    const ct = rawConvo.map(m=>`${m.role}: ${m.content}`).join("\n\n");
    const um = `## RULE SCORES\n${JSON.stringify(scores,null,2)}\n\n## PERSONA\ntags: ${(ctx.interestTags||[]).join(", ")}\ntype: ${ctx.subscriberType}\nPAC: ${ctx.personaAlignment}\nlifecycle: ${ctx.lifecycleCoeff}\nsubs: ${ctx.existingSubs}\nsame_cat: ${ctx.sameCatCount} (avg: ${ctx.sameCatAvgUsage})\ncheckin_sat: ${ctx.checkinSat||"N/A"}\nusage_trend: ${ctx.usageTrend||"N/A"}\n\n## SLOTS\n${JSON.stringify(slots,null,2)}\n\n## CONVERSATION\n${ct}\n\nReturn adjustments JSON.`;
    try { const r = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:adjP,messages:[{role:"user",content:um}]})}); const d = await r.json(); if(d.error) throw new Error(d.error.message); const raw = d.content?.[0]?.text||""; const mm = raw.match(/\{[\s\S]*\}/); return mm ? JSON.parse(mm[0]) : null; } catch(e) { setError(`Adj: ${e.message}`); return null; }
  }, [apiKey, rawConvo, slots, ctx]);

  const updateSlot = useCallback((updates) => {
    setSlots(prev => { const n={...prev,...updates}; if(n.price&&n.billing_cycle==="monthly")n.price_monthly=n.price; if(n.price&&n.billing_cycle==="yearly")n.price_monthly=Math.round(n.price/12*100)/100; return n; });
  }, []);
  const updateMsgText = useCallback((idx, text) => {
    setMessages(prev=>prev.map((m,i)=>i===idx?{...m,text}:m));
  }, []);

  return { messages, slots, stage, turnIdx, loading, finished, error, sendMessage, startChat, rawConvo, runAdj, updateSlot, updateMsgText };
}

// ═══════════════════════════════════════════════════════════════════════
// PANELS
// ═══════════════════════════════════════════════════════════════════════
const FREQ_CHIPS = [
  {label:"Rarely",value:"rarely"},{label:"~1/wk",value:"weekly"},
  {label:"2-3×/wk",value:"few_times"},{label:"Most days",value:"most_days"},{label:"Daily",value:"daily"},
];

function ChatPanel({chat,apiKey,onGoToRules,onRunAdj}) {
  const [inp,setInp] = useState(""); const ref = useRef(null);
  const [editIdx, setEditIdx] = useState(null);
  useEffect(()=>{if(ref.current) ref.current.scrollTop=ref.current.scrollHeight},[chat.messages,chat.loading,chat.finished]);
  const send = (t, eopts, eim) => { if(!t||!t.trim()) return; chat.sendMessage(t.trim(), eopts||[], eim||"text"); setInp(""); };

  const handleEditPick = (msgIdx, msg, newVal, newLabel) => {
    const slotKeys = Object.keys(msg.slotsSet||{});
    if (!slotKeys.length) return;
    // Find the primary slot key: the one whose current value matches an option value
    const slotKey = slotKeys.length===1 ? slotKeys[0] :
      slotKeys.find(k=>(msg.editOptions||[]).some(o=>o.value===msg.slotsSet[k])||FREQ_CHIPS.some(o=>o.value===msg.slotsSet[k])) || slotKeys[0];
    chat.updateSlot({[slotKey]:newVal});
    chat.updateMsgText(msgIdx, newLabel);
    setEditIdx(null);
  };
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,fontWeight:600,color:C.text}}>Chat</span><Tag color={C.accent} bg={C.accentSoft}>{chat.stage}</Tag><Tag color={C.textDim} bg={C.surface}>t{chat.turnIdx}</Tag></div>
        <Btn small onClick={chat.startChat}>{chat.messages.length?"Restart":"Start"}</Btn>
      </div>
      <div ref={ref} style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
        {!chat.messages.length && <div style={{textAlign:"center",color:C.textDim,fontSize:13,marginTop:40}}>{apiKey?'Click Start':"Set API key in ⚙️"}</div>}
        {chat.messages.map((m,i) => {
          const isEditableUser = m.role==="user" && chat.finished && m.slotsSet && Object.keys(m.slotsSet).length>0 && (m.editOptions?.length>0 || m.editInputMode==="slider");
          const isEditing = editIdx===i;
          const editChips = m.editInputMode==="slider" ? FREQ_CHIPS : (m.editOptions||[]);
          return <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"82%",display:"flex",flexDirection:"column",gap:6}}>
            {m.ahaText && <div style={{background:C.yellowSoft,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.yellow,lineHeight:1.5,borderLeft:`3px solid ${C.yellow}`,border:"1px dashed rgba(234,179,8,0.3)"}}>💡 {m.ahaText}</div>}
            <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{padding:"9px 13px",borderRadius:m.role==="user"?"14px 14px 3px 14px":"14px 14px 14px 3px",background:m.isError?C.redSoft:m.role==="user"?C.accent:C.surface,color:m.isError?C.red:m.role==="user"?"#fff":C.text,border:m.role==="user"?"none":`1px solid ${C.border}`,fontSize:13,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{m.text}</div>
              {isEditableUser && <button onClick={()=>setEditIdx(isEditing?null:i)} title="Edit this answer" style={{flexShrink:0,background:isEditing?C.accentSoft:"transparent",border:`1px solid ${isEditing?C.accent:C.border}`,borderRadius:6,color:isEditing?C.accent:C.textDim,fontSize:11,padding:"3px 6px",cursor:"pointer",lineHeight:1}}>✏</button>}
            </div>
            {isEditing && <div style={{display:"flex",flexWrap:"wrap",gap:5,justifyContent:"flex-end"}}>
              {editChips.map((o,j)=><button key={j} onClick={()=>handleEditPick(i,m,o.value,o.label)} style={{padding:"5px 11px",borderRadius:16,fontSize:11,fontWeight:500,background:m.slotsSet[Object.keys(m.slotsSet)[0]]===o.value?C.accentSoft:C.surface,color:m.slotsSet[Object.keys(m.slotsSet)[0]]===o.value?C.accent:C.textSec,border:`1px solid ${m.slotsSet[Object.keys(m.slotsSet)[0]]===o.value?C.accent:C.border}`,cursor:"pointer"}}>{o.label}</button>)}
            </div>}
            {m.options?.length>0 && <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{m.options.map((o,j)=><button key={j} onClick={()=>send(o.label,m.options,m.inputMode||"options")} disabled={chat.loading} style={{padding:"5px 11px",borderRadius:16,fontSize:11,fontWeight:500,background:C.surface,color:C.accent,border:`1px solid ${C.border}`,cursor:chat.loading?"default":"pointer",opacity:chat.loading?0.5:1}}>{o.label}</button>)}</div>}
          </div>;
        })}
        {chat.finished && <div style={{alignSelf:"stretch",margin:"6px 0",padding:"14px 16px",borderRadius:10,background:"rgba(34,197,94,0.08)",border:`1px solid rgba(34,197,94,0.35)`,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontSize:13,fontWeight:600,color:C.green}}>Conversation complete</div>
          <div style={{fontSize:12,color:C.textSec,lineHeight:1.6}}>Step 1 — Review the rule-based score in the <strong style={{color:C.text}}>Rules</strong> tab.<br/>Step 2 — Run <strong style={{color:C.text}}>Adjuster</strong> to apply AI nuance on top.</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onGoToRules} style={{flex:1,padding:"7px 0",borderRadius:7,border:`1px solid ${C.green}`,background:"rgba(34,197,94,0.12)",color:C.green,fontSize:12,fontWeight:600,cursor:"pointer"}}>Check Score →</button>
            <button onClick={onRunAdj} style={{flex:1,padding:"7px 0",borderRadius:7,border:`1px solid ${C.accent}`,background:C.accentSoft,color:C.accent,fontSize:12,fontWeight:600,cursor:"pointer"}}>Run Adjuster</button>
          </div>
        </div>}
        {chat.loading && <div style={{alignSelf:"flex-start",padding:"9px 13px",borderRadius:14,background:C.surface,border:`1px solid ${C.border}`,fontSize:13,color:C.textDim}}>thinking...</div>}
      </div>
      <div style={{padding:10,borderTop:`1px solid ${C.border}`,display:"flex",gap:8}}>
        <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send(inp)} placeholder={chat.loading?"...":"Type response..."} disabled={chat.loading||!apiKey} style={{flex:1,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,color:C.text,fontSize:13,outline:"none"}}/>
        <Btn onClick={()=>send(inp)} active style={{borderRadius:8}}>Send</Btn>
      </div>
    </div>
  );
}

function RulePanel({rules,setRules,sr}) {
  const G = [
    {t:"Need Fit /25",k:[["need_fit_scenario_specific","scenario_specific"],["need_fit_problem_aware","problem_aware"],["need_fit_category_only","category_only"],["need_fit_none","none"]]},
    {t:"Usage /25",k:[["usage_daily","daily"],["usage_most_days","most days"],["usage_few_times","few times"],["usage_weekly","weekly"],["usage_monthly","monthly"],["usage_rarely","rarely"]]},
    {t:"Budget /20",k:[["budget_comfortable","comfortable"],["budget_tight","tight"],["budget_steep","steep"],["budget_no_way","no_way"]]},
    {t:"Budget Adj",k:[["ratio_low_bonus","<5% bonus"],["ratio_high_penalty",">15% penalty"],["cpu_benchmark","CPU bench ($)"]]},
    {t:"Overlap /15",k:[["overlap_none","none"],["overlap_some","some"],["overlap_significant","significant"],["overlap_high","high"],["no_subs_floor","no-subs floor"],["portfolio_penalty","portfolio pen."]]},
    {t:"Risk /15",k:[["risk_none","none"],["risk_free_enough","free_enough"],["risk_forget_cancel","forget_cancel"],["risk_interest_decay","interest_decay"],["risk_impulse","impulse"]]},
    {t:"Uncertainty",k:[["unc_frequency","freq wt"],["unc_budget","budget wt"],["unc_motivation","motiv wt"],["unc_overlap","overlap wt"],["unc_risk","risk wt"],["unc_max","max"]]},
    {t:"Cross-val",k:[["cv_need_penalty","hi-need+lo-use"],["cv_usage_bonus","lo-need+hi-use"],["cv_upgrading_overlap_penalty","upgrading+hi-overlap"]]},
    {t:"Thresholds",k:[["threshold_subscribe","Subscribe ≥"],["threshold_trial","Trial ≥"],["threshold_watchlist","Watchlist ≥"]]},
  ];
  return (
    <div style={{padding:14,overflowY:"auto",height:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{fontSize:13,fontWeight:600,color:C.text}}>Rules</span><Btn small onClick={()=>setRules({...DEFAULT_RULES})}>Reset</Btn></div>
      {sr && <div style={{padding:10,borderRadius:8,background:C.accentSoft,border:`1px solid ${C.accent}30`,marginBottom:12,fontSize:11,color:C.accent,lineHeight:1.7,fontFamily:"'JetBrains Mono',monospace"}}>
        <div style={{fontWeight:700,fontSize:13}}>Score: {sr.total} | {sr.uncertainty_level} ({sr.not_sure_count}×ns)</div>
        NF={sr.need_fit} US={sr.usage} BF={sr.budget_fit} OV={sr.overlap} RK={sr.risk} −{sr.uncertainty_penalty}
        {sr.cv_need_adj!==0&&<span style={{color:C.orange}}> cv:nf{sr.cv_need_adj}</span>}{sr.cv_usage_adj!==0&&<span style={{color:C.green}}> cv:us+{sr.cv_usage_adj}</span>}{sr.cv_upgrading_overlap_adj!==0&&<span style={{color:C.yellow}}> cv:uo{sr.cv_upgrading_overlap_adj}</span>}{sr.had_before&&<span style={{color:C.purple}}> ½unc</span>}
      </div>}
      {G.map(g=><div key={g.t}><Sec>{g.t}</Sec><div style={{display:"flex",flexDirection:"column",gap:3}}>{g.k.map(([k,l])=><Inp key={k} label={l} value={rules[k]} onChange={v=>setRules(p=>({...p,[k]:v}))} min={-10} max={25}/>)}</div></div>)}
    </div>
  );
}

function PromptPanel({cp,setCp,ap,setAp}) {
  const [t,setT] = useState("convo");
  const [saved,setSaved] = useState(false);
  const p = t==="convo"?cp:ap; const sP = t==="convo"?setCp:setAp;
  const key = t==="convo"?"subsense_prompt_convo":"subsense_prompt_adjuster";
  const verKey = key+"_version";
  const ver = t==="convo"?PROMPT_CONVO_VERSION:PROMPT_ADJUSTER_VERSION;
  const d = t==="convo"?DEFAULT_CONVO_PROMPT:DEFAULT_ADJUSTER_PROMPT;
  const savePrompt = () => { localStorage.setItem(key, p); localStorage.setItem(verKey, ver); setSaved(true); setTimeout(()=>setSaved(false),1800); };
  const resetPrompt = () => { sP(d); localStorage.removeItem(key); localStorage.removeItem(verKey); };
  return <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
    <div style={{padding:"8px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:6,alignItems:"center"}}>
      <Btn small active={t==="convo"} onClick={()=>{setT("convo");setSaved(false);}}>Conversation</Btn>
      <Btn small active={t==="adjuster"} onClick={()=>{setT("adjuster");setSaved(false);}}>Adjuster</Btn>
      <div style={{flex:1}}/>
      <Btn small active onClick={savePrompt}>{saved?"Saved ✓":"Save"}</Btn>
      <Btn small danger onClick={resetPrompt}>Reset</Btn>
    </div>
    <textarea value={p} onChange={e=>sP(e.target.value)} style={{flex:1,padding:14,border:"none",background:C.surface,color:C.text,fontSize:12,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.6,resize:"none",outline:"none"}} spellCheck={false}/>
    <div style={{padding:"6px 14px",borderTop:`1px solid ${C.border}`,fontSize:11,color:C.textDim}}>
      {localStorage.getItem(key)
        ? <span style={{color:C.green,marginRight:8}}>● saved ({ver})</span>
        : <span style={{color:C.textDim,marginRight:8}}>○ default ({ver})</span>}
      {p.length} chars · {p.split(/\s+/).length} words
    </div>
  </div>;
}

function AdjPanel({adj,sr,rules}) {
  if (!adj) return <div style={{padding:20,textAlign:"center",color:C.textDim,fontSize:13}}>Run Adjuster after conversation</div>;
  // Handle old format (adjustments-based) gracefully
  if (!adj.signals && adj.adjustments) {
    return <div style={{padding:20,textAlign:"center",color:C.yellow,fontSize:12,lineHeight:1.7}}>
      <div style={{fontSize:22,marginBottom:8}}>🔄</div>
      Old adjuster format detected.<br/>Re-run the <strong>🧠 Adjuster</strong> to use the new V6 signal analysis.
    </div>;
  }
  const signals = adj.signals || [];
  const totalDelta = adj.total_delta || 0;
  const bT = clamp(sr.total + totalDelta, 0, 100);
  const bg = getBadge(bT, rules);
  const df = bT - sr.total;
  const impC = v => v > 0 ? C.green : v < 0 ? C.orange : C.textDim;
  const confC = c => c==="high"?C.green:c==="medium"?C.yellow:C.textDim;
  const confBg = c => c==="high"?C.greenSoft:c==="medium"?C.yellowSoft:C.surface;
  return <div style={{padding:14,overflowY:"auto",height:"100%"}}>
    {/* Score header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <div>
        <span style={{fontSize:32,fontWeight:700,color:C.text,fontFamily:"'JetBrains Mono',monospace"}}>{bT.toFixed(1)}</span>
        <span style={{fontSize:12,color:C.textDim,fontFamily:"'JetBrains Mono',monospace",marginLeft:8}}>
          from {sr.total}<span style={{color:impC(df),fontWeight:600,marginLeft:5}}>{df>0?"+":""}{df.toFixed(1)}</span>
        </span>
      </div>
      <Tag color={bg.c} bg={bg.bg}>{bg.label}</Tag>
    </div>
    {/* Narrative + overlap */}
    {(adj.narrative_insight||adj.overlap_inference)&&<div style={{marginBottom:12,padding:10,borderRadius:8,borderLeft:`3px solid ${C.purple}`,background:C.surface}}>
      {adj.narrative_insight&&<div style={{fontSize:12,color:C.text,lineHeight:1.6}}>{adj.narrative_insight}</div>}
      {adj.overlap_inference&&<div style={{marginTop:adj.narrative_insight?6:0,fontSize:11,color:C.textSec,lineHeight:1.5}}><span style={{fontSize:10,fontWeight:700,color:C.yellow,marginRight:5}}>OVERLAP</span>{adj.overlap_inference}</div>}
    </div>}
    {/* Total delta pill */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,padding:"6px 10px",borderRadius:6,background:C.surface,border:`1px solid ${C.border}`}}>
      <span style={{fontSize:10,fontWeight:700,color:C.textDim,letterSpacing:"0.05em"}}>SIGNAL TOTAL</span>
      <span style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:impC(totalDelta)}}>{totalDelta>0?"+":""}{totalDelta}</span>
    </div>
    {/* Signal cards */}
    {signals.length===0&&<div style={{textAlign:"center",padding:20,color:C.textDim,fontSize:12}}>No signals — rule score well-calibrated</div>}
    {signals.map((sig,i)=><div key={i} style={{marginBottom:10,padding:10,background:C.surface,borderRadius:8,border:`1px solid ${sig.impact>0?C.green:sig.impact<0?C.orange:C.border}`,borderLeftWidth:3}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
        <span style={{fontSize:12,fontWeight:600,color:C.text}}>{sig.name}</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:impC(sig.impact)}}>{sig.impact>0?"+":""}{sig.impact}</span>
          <Tag color={confC(sig.confidence)} bg={confBg(sig.confidence)}>{sig.confidence}</Tag>
        </div>
      </div>
      <div style={{fontSize:11,color:C.textSec,lineHeight:1.5}}>{sig.finding}</div>
    </div>)}
  </div>;
}

const TAGS = ["music","video","podcast","gaming","productivity","health","fitness","learning","design","creative","social","news","finance","career"];
const STYPES = [{id:"power_user",l:"Power User",d:"Deep on fewer"},{id:"explorer",l:"Explorer",d:"Tries new things"},{id:"essentialist",l:"Essentialist",d:"Only essentials"},{id:"spontaneous",l:"Spontaneous",d:"Impulse sub/cancel"},{id:"balanced_user",l:"Balanced",d:"Middle ground"}];

const PERSONA_STORE_KEY = "subsense_saved_personas";

function SettingsPanel({apiKey,setApiKey,ctx,setCtx,sr,adj}) {
  const tog = t=>setCtx(p=>({...p,interestTags:(p.interestTags||[]).includes(t)?p.interestTags.filter(x=>x!==t):[...(p.interestTags||[]),t]}));
  const [savedPersonas,setSavedPersonas] = useState(()=>{ try { return JSON.parse(localStorage.getItem(PERSONA_STORE_KEY)||"[]"); } catch { return []; } });
  const [saveName,setSaveName] = useState("");
  const [importText,setImportText] = useState("");
  const [importErr,setImportErr] = useState("");
  const persist = list => { setSavedPersonas(list); localStorage.setItem(PERSONA_STORE_KEY,JSON.stringify(list)); };
  const importPersona = () => {
    setImportErr("");
    try {
      const raw = JSON.parse(importText.trim());
      const CTX_KEYS = ["name","budget","priceSensitivity","existingSubs","sameCatSubs","interestTags","subscriberType","personaAlignment","lifecycleCoeff","sameCatCount","sameCatAvgUsage","checkinSat","usageTrend"];
      const merged = {...ctx};
      CTX_KEYS.forEach(k=>{ if(raw[k]!==undefined) merged[k]=raw[k]; });
      setCtx(merged);
      setImportText("");
    } catch(e) { setImportErr("Invalid JSON — " + e.message); }
  };
  const savePersona = () => {
    const label = saveName.trim() || ctx.name || "Persona";
    const entry = { id: Date.now(), label, savedAt: new Date().toLocaleDateString(), ctx: {...ctx}, sr: sr||null, adj: adj||null };
    persist([entry, ...savedPersonas]);
    setSaveName("");
  };
  const loadPersona = p => setCtx({...p.ctx});
  const updatePersona = id => persist(savedPersonas.map(p=>p.id===id ? {...p, sr:sr||p.sr, adj:adj||p.adj, savedAt:new Date().toLocaleDateString()} : p));
  const deletePersona = id => persist(savedPersonas.filter(p=>p.id!==id));
  return <div style={{padding:14,display:"flex",flexDirection:"column",gap:4,overflowY:"auto",height:"100%"}}>
    <Sec>Import Persona (JSON)</Sec>
    <textarea value={importText} onChange={e=>{setImportText(e.target.value);setImportErr("");}} placeholder={'{\n  "name": "Alice",\n  "budget": 200,\n  "subscriberType": "explorer",\n  "interestTags": ["music","fitness"],\n  ...\n}'} style={{width:"100%",minHeight:110,padding:"8px 10px",borderRadius:6,border:`1px solid ${importErr?C.red:C.border}`,background:C.surface,color:C.text,fontSize:11,fontFamily:"'JetBrains Mono',monospace",resize:"vertical",lineHeight:1.6,boxSizing:"border-box"}}/>
    {importErr && <div style={{fontSize:10,color:C.red}}>{importErr}</div>}
    <Btn small active={!!importText.trim()} onClick={importPersona} style={{alignSelf:"flex-start"}}>Import →</Btn>
    <Sec>API Key</Sec>
    <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="<your-anthropic-api-key>" style={{width:"100%",padding:"8px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:C.surface,color:C.text,fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}/>
    <Sec>User</Sec>
    <Inp label="Name" value={ctx.name} onChange={v=>setCtx(p=>({...p,name:v}))} type="text"/>
    <Inp label="Budget ($)" value={ctx.budget} onChange={v=>setCtx(p=>({...p,budget:v}))} min={0} max={5000}/>
    <Inp label="Price Sensitivity" value={ctx.priceSensitivity} onChange={v=>setCtx(p=>({...p,priceSensitivity:v}))} min={0} max={1} step={0.1}/>
    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}><span style={{color:C.textSec,minWidth:130,fontSize:11}}>Existing subs</span><input value={ctx.existingSubs} onChange={e=>setCtx(p=>({...p,existingSubs:e.target.value}))} placeholder="Spotify, Netflix..." style={{flex:1,padding:"3px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,color:C.text,fontSize:12}}/></div>
    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}><span style={{color:C.textSec,minWidth:130,fontSize:11}}>Same-cat subs</span><input value={ctx.sameCatSubs} onChange={e=>setCtx(p=>({...p,sameCatSubs:e.target.value}))} placeholder="Apple Music..." style={{flex:1,padding:"3px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,color:C.text,fontSize:12}}/></div>
    <Sec>🎭 Interest Tags</Sec>
    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{TAGS.map(t=>{const a=(ctx.interestTags||[]).includes(t);return <button key={t} onClick={()=>tog(t)} style={{padding:"4px 10px",borderRadius:14,fontSize:11,fontWeight:500,border:`1px solid ${a?C.purple:C.border}`,background:a?C.purpleSoft:"transparent",color:a?C.purple:C.textSec,cursor:"pointer"}}>{t}</button>})}</div>
    <Sec>🎭 Subscriber Type</Sec>
    <div style={{display:"flex",flexDirection:"column",gap:3}}>{STYPES.map(t=><button key={t.id} onClick={()=>setCtx(p=>({...p,subscriberType:t.id}))} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 10px",borderRadius:6,border:`1px solid ${ctx.subscriberType===t.id?C.purple:C.border}`,background:ctx.subscriberType===t.id?C.purpleSoft:"transparent",cursor:"pointer",textAlign:"left"}}><span style={{fontSize:12,fontWeight:600,color:ctx.subscriberType===t.id?C.purple:C.text,minWidth:75}}>{t.l}</span><span style={{fontSize:11,color:C.textDim}}>{t.d}</span></button>)}</div>
    <Sec>🎭 Persona Alignment</Sec>
    <Sld label="PAC" value={ctx.personaAlignment||1} onChange={v=>setCtx(p=>({...p,personaAlignment:v}))} min={0.7} max={1.3} step={0.05}/>
    <div style={{display:"flex",gap:4,mt:4}}>{[{l:"Weak",v:.8},{l:"Neutral",v:1},{l:"Strong",v:1.2},{l:"Max",v:1.3}].map(p=><Btn key={p.l} small active={Math.abs((ctx.personaAlignment||1)-p.v)<.02} onClick={()=>setCtx(pr=>({...pr,personaAlignment:p.v}))}>{p.l}</Btn>)}</div>
    <Sec>📊 Check-in & Lifecycle</Sec>
    <Sld label="Lifecycle" value={ctx.lifecycleCoeff||1} onChange={v=>setCtx(p=>({...p,lifecycleCoeff:v}))} min={0.6} max={1.1} step={0.05}/>
    <Inp label="Same-cat count" value={ctx.sameCatCount} onChange={v=>setCtx(p=>({...p,sameCatCount:v}))} min={0} max={10} step={1}/>
    <Inp label="Same-cat avg use" value={ctx.sameCatAvgUsage} onChange={v=>setCtx(p=>({...p,sameCatAvgUsage:v}))} min={0} max={1} step={0.1}/>
    <Inp label="Checkin satisfaction" value={ctx.checkinSat||""} onChange={v=>setCtx(p=>({...p,checkinSat:v}))} type="text" wide/>
    <Inp label="Usage trend" value={ctx.usageTrend||""} onChange={v=>setCtx(p=>({...p,usageTrend:v}))} type="text" wide/>
    <Sec>Prompt Injection Summary</Sec>
    <div style={{padding:8,borderRadius:6,background:C.surface,border:`1px solid ${C.border}`,fontSize:10,color:C.textSec,lineHeight:1.6,fontFamily:"'JetBrains Mono',monospace"}}>
      tags: {(ctx.interestTags||[]).join(",")||"∅"} | type: {ctx.subscriberType}<br/>
      PAC: ×{(ctx.personaAlignment||1).toFixed(2)} | lifecycle: ×{(ctx.lifecycleCoeff||1).toFixed(2)}<br/>
      same_cat: {ctx.sameCatCount||0} (avg:{(ctx.sameCatAvgUsage||1).toFixed(1)}) | sens: {ctx.priceSensitivity}<br/>
      checkin: {ctx.checkinSat||"—"} | trend: {ctx.usageTrend||"—"}
    </div>
    <Sec>Saved Personas</Sec>
    <div style={{display:"flex",gap:6}}>
      <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder={ctx.name||"Label..."} onKeyDown={e=>e.key==="Enter"&&savePersona()} style={{flex:1,padding:"5px 8px",borderRadius:5,border:`1px solid ${C.border}`,background:C.surface,color:C.text,fontSize:12}}/>
      <Btn small active onClick={savePersona}>Save</Btn>
    </div>
    {savedPersonas.length===0 && <div style={{fontSize:11,color:C.textDim,paddingTop:4}}>No saved personas yet.</div>}
    <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:2}}>
      {savedPersonas.map(p=>{
        const ruleTotal = p.sr?.total;
        const adjTotal = p.adj ? (() => {
          if (p.adj.total_delta !== undefined) return clamp((p.sr?.total||0) + p.adj.total_delta, 0, 100).toFixed(1);
          // old format fallback
          const D=["need_fit","usage","budget_fit","overlap","risk"]; const M={need_fit:25,usage:25,budget_fit:20,overlap:15,risk:15}; let t=0; D.forEach(d=>{const base=p.sr?.[d]||0;const dl=p.adj.adjustments?.[d]?.delta||0;t+=clamp(blend(base,dl,0.5),0,M[d]);}); return clamp(t-(p.sr?.uncertainty_penalty||0),0,100).toFixed(1);
        })() : null;
        const badge = ruleTotal!=null ? getBadge(ruleTotal, DEFAULT_RULES) : null;
        return <div key={p.id} style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:C.surface,display:"flex",alignItems:"center",gap:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
              <span style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.label}</span>
              {badge && <Tag color={badge.c} bg={badge.bg}>{badge.label}</Tag>}
            </div>
            <div style={{fontSize:10,color:C.textDim}}>{p.savedAt} · {p.ctx.subscriberType} · PAC {p.ctx.personaAlignment?.toFixed(2)}</div>
            {ruleTotal!=null && <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:C.textSec,marginTop:2}}>
              Rule <span style={{color:C.text,fontWeight:700}}>{ruleTotal}</span>
              {adjTotal && <span> · Adj <span style={{color:C.accent,fontWeight:700}}>{adjTotal}</span></span>}
              <span style={{color:C.textDim}}> — NF{p.sr.need_fit} US{p.sr.usage} BF{p.sr.budget_fit} OV{p.sr.overlap} RK{p.sr.risk}</span>
            </div>}
            <div style={{fontSize:10,color:C.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:1}}>{(p.ctx.interestTags||[]).join(", ")||"no tags"} · ${p.ctx.budget}/mo</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3,flexShrink:0}}>
            <Btn small onClick={()=>loadPersona(p)}>Load</Btn>
            <Btn small active onClick={()=>updatePersona(p.id)}>Upd</Btn>
            <Btn small danger onClick={()=>deletePersona(p.id)}>Del</Btn>
          </div>
        </div>;
      })}
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
export default function App() {
  const [apiKey,setApiKey] = useState("");
  const [ctx,setCtx] = useState({name:"User",budget:300,priceSensitivity:0.3,existingSubs:"Apple Music ($10.99/mo)",sameCatSubs:"Apple Music",interestTags:["music","video"],subscriberType:"balanced_user",personaAlignment:1.0,lifecycleCoeff:1.0,sameCatCount:1,sameCatAvgUsage:0.7,checkinSat:"",usageTrend:""});
  const [rules,setRules] = useState({...DEFAULT_RULES});
  const [weights,setW] = useState({...DEFAULT_WEIGHTS});
  const [cp,setCp] = useState(()=>{
    const saved = localStorage.getItem("subsense_prompt_convo");
    const ver = localStorage.getItem("subsense_prompt_convo_version");
    if (saved && ver === PROMPT_CONVO_VERSION) return saved;
    localStorage.removeItem("subsense_prompt_convo");
    localStorage.removeItem("subsense_prompt_convo_version");
    return DEFAULT_CONVO_PROMPT;
  });
  const [ap,setAp] = useState(()=>{
    const saved = localStorage.getItem("subsense_prompt_adjuster");
    const ver = localStorage.getItem("subsense_prompt_adjuster_version");
    if (saved && ver === PROMPT_ADJUSTER_VERSION) return saved;
    localStorage.removeItem("subsense_prompt_adjuster");
    localStorage.removeItem("subsense_prompt_adjuster_version");
    return DEFAULT_ADJUSTER_PROMPT;
  });
  const [adj,setAdj] = useState(null);
  const [adjL,setAdjL] = useState(false);
  const [rp,setRp] = useState("rules");
  const chat = useChat(apiKey,cp,ctx);
  const sr = computeScore(chat.slots,rules,{personaAlignment:ctx.personaAlignment,lifecycleCoeff:ctx.lifecycleCoeff,sameCatCount:ctx.sameCatCount,sameCatAvgUsage:ctx.sameCatAvgUsage,priceSensitivity:ctx.priceSensitivity,existingSubsCount:(ctx.existingSubs||"").split(",").filter(Boolean).length,monthlyBudget:ctx.budget});
  const runAdj = async ()=>{setAdjL(true);const r=await chat.runAdj(ap,sr);if(r)setAdj(r);setAdjL(false);setRp("adjuster");};
  const ps = {background:C.card,borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden",display:"flex",flexDirection:"column"};

  return <div style={{height:"100vh",display:"flex",flexDirection:"column",background:C.bg,fontFamily:"'Inter',-apple-system,sans-serif",color:C.text}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}input[type="range"]{-webkit-appearance:none;background:${C.border};border-radius:2px;height:3px}input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;border-radius:50%;background:${C.accent};cursor:pointer}`}</style>
    <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:15,fontWeight:700}}>SubSense v5</span><Tag color={C.textSec} bg={C.surface}>{chat.messages.length}msg · {Object.keys(chat.slots).length}slots · {sr.total}pts</Tag></div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>{chat.error&&<span style={{fontSize:11,color:C.red}}>⚠ {chat.error.slice(0,40)}</span>}<Btn small active={adjL} onClick={runAdj} style={{opacity:chat.rawConvo.length<4?.4:1}}>{adjL?"...":"🧠 Adjuster"}</Btn></div>
    </div>
    <div style={{flex:1,display:"flex",gap:12,padding:12,overflow:"hidden"}}>
      <div style={{...ps,flex:1,minWidth:0}}><ChatPanel chat={chat} apiKey={apiKey} onGoToRules={()=>setRp("rules")} onRunAdj={runAdj}/></div>
      <div style={{...ps,width:380,flexShrink:0}}>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,padding:"0 4px",flexShrink:0}}>
          {[{id:"rules",l:"📐Rules"},{id:"prompts",l:"📝Prompts"},{id:"adjuster",l:"🧠Adj"},{id:"settings",l:"⚙️"}].map(t=><button key={t.id} onClick={()=>setRp(t.id)} style={{padding:"8px 10px",fontSize:11,fontWeight:600,border:"none",cursor:"pointer",background:"transparent",color:rp===t.id?C.accent:C.textDim,borderBottom:rp===t.id?`2px solid ${C.accent}`:"2px solid transparent"}}>{t.l}</button>)}
        </div>
        <div style={{flex:1,overflow:"hidden"}}>
          {rp==="rules"&&<RulePanel rules={rules} setRules={setRules} sr={sr}/>}
          {rp==="prompts"&&<PromptPanel cp={cp} setCp={setCp} ap={ap} setAp={setAp}/>}
          {rp==="adjuster"&&<AdjPanel adj={adj} sr={sr} rules={rules}/>}
          {rp==="settings"&&<SettingsPanel apiKey={apiKey} setApiKey={setApiKey} ctx={ctx} setCtx={setCtx} sr={sr} adj={adj}/>}
        </div>
        <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 12px",maxHeight:100,overflowY:"auto",flexShrink:0}}>
          <div style={{fontSize:10,fontWeight:600,color:C.textDim,marginBottom:4}}>SLOTS</div>
          <div style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:C.textSec,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{Object.keys(chat.slots).length?JSON.stringify(chat.slots,null,2):"—"}</div>
        </div>
      </div>
    </div>
  </div>;
}
