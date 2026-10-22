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
  → If response < 10 words or very vague, follow up ONCE:
    "Can you give me a quick example of when you'd actually use it?"
  → Classify motivation_clarity in slots_delta (ALWAYS include this):
    - "scenario_specific": described a specific time/place/workflow
    - "problem_aware": named a gap or pain point but no specific scenario
    - "category_only": just a category mention like "for work" or "for fun"
    - "none": couldn't articulate why
  → Store original description in slots_delta as "motivation_text"
  → Required slots: primary_motivation, motivation_clarity, motivation_text.

Stage 3 — history_check: Have they used this before?
  → If existing subscriptions data already shows history with this service,
    convert to confirmation: "Looks like you had {service} before — is that right?"
  → Otherwise, input_mode: "options"
  → Options: [
      {"id":"new","label":"Never tried it","value":"first_time"},
      {"id":"cancel","label":"Tried it, cancelled","value":"cancelled"},
      {"id":"upgrade","label":"Currently using, want to upgrade","value":"upgrading"},
      {"id":"trial","label":"Used a free trial","value":"free_trial"}
    ]
  → If cancelled: follow up ONCE asking cancel reason.
    Options: price / low_usage / found_alternative / other
  → If upgrading: Stage 4 becomes a quick confirmation (usage already proven).

Stage 4 — expected_usage: Realistic usage frequency.
  → COMPRESSION: If motivation description already implies clear frequency
    (e.g. "every morning commute", "daily practice"), compress to confirmation:
    "Sounds like you'd use it pretty much daily — that right?"
    Options: ["Yeah, daily", "Actually less than that", "Let me think"]
  → If upgrading: "You're already using it — how often these days?" as confirmation.
  → Otherwise: input_mode "slider"
  → Slider mapping (use these values): 0=Rarely, 1=Once/wk, 2.5=2-3x/wk, 4.5=Most days, 7=Daily
  → Generate contextual slider labels based on service type:
    streaming→"A few shows/week"..."Daily background"
    tools→"Once in a while"..."Daily driver"
    fitness→"Occasionally"..."Daily routine"
    music→"Playlist here and there"..."All day"

Stage 5 — budget_feel: How does the price feel?
  → MUST reference price and budget %:
    "At \${price_monthly}/month — about {budget_pct} of your sub budget — how does that feel?"
  → input_mode: "options"
  → Options: comfortable / tight / no_way / not_sure
  → BEFORE this question, insert a progress bubble:
    "OK here's what I have — {service_name}, \${price}/month, for {motivation}. Almost there."

Stage 6 — risk: Surface remaining hesitations.
  → input_mode: "options" with allow_optional_note: true
  → DYNAMICALLY generate 3-5 options based on ALL prior context:
    - Always include: "No real concerns" and "Not sure"
    - If no free version exists, do NOT include "free version might be enough"
    - If history=cancelled+low_usage, put "Might lose interest again" FIRST
    - If budget_feel=tight, include "Might need to cut it later"
    - If motivation_clarity was weak, include "Not sure I really need it"
  → Store custom text in additional_risk_note
  → After user answers: give conversational recap (see STYLE section), then set is_finished: true

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
// ADJUSTER PROMPT — Full V5 spec 5-module architecture
// ═══════════════════════════════════════════════════════════════════════
const DEFAULT_ADJUSTER_PROMPT = `## MODULE A — ROLE
You are a second-pass scoring reviewer for a subscription audit.
A rule engine already scored 5 dimensions. You find nuances rules missed.
You are NOT re-scoring. delta=0 is valid and expected. Do not invent adjustments.

## MODULE B — WHAT RULES ALREADY DID
- Need Fit (max 25): by motivation_clarity (scenario_specific=22, problem_aware=18, category_only=14, none=10), × persona_alignment_coeff (0.7-1.3), capped at 25.
- Usage (max 25): by frequency (daily=25, most_days=23, few=18, weekly=10, rarely=0), × lifecycle_coeff (0.6-1.1).
- Budget Fit (max 20): by feel (comfortable=18, tight=10, no_way=3), + ratio adj (<5%→+3, >15%→-3), + cost-per-use benchmark adj.
- Overlap (max 15): by self-report + portfolio pattern (same_cat≥2 & avg_usage<0.4 → -3). No-existing-subs floor at 13.
- Risk (max 15): by self-identified risk option.

Also applied:
- Cross-validation: need>18 & usage<12 → nf-3; need<14 & usage>18 → us+2
- Uncertainty penalty: per-slot weighted (freq=3,budget=2,motivation=2,overlap=1,risk=1), max -10, halved if user has history
- Persona alignment on Need Fit, Lifecycle on Usage, Portfolio on Overlap

Do NOT re-penalize what rules handled. Do NOT double-count cross-validation.

## MODULE C — SIGNALS TO FIND
1. TONE: enthusiasm vs hedging ("I've wanted this for months" vs "I guess")
2. MOTIVATION AUTHENTICITY: specific & believable? Matches behavior?
3. IMPLICIT FREQUENCY: motivation implied usage? ("every commute" = daily)
4. SERVICE KNOWLEDGE: functional overlap rules can't detect, free alternatives
5. CONTRADICTIONS: comfortable+mentions saving; no_overlap+competing subs exist; daily+cancelled-for-low-usage
6. CHECK-IN SIGNALS: declining usage_trend, low satisfaction in category

## MODULE D — PERSONA
- Strong match + low coefficient → note it
- "spontaneous" → weight commitment signals more
- "essentialist" → stated needs likely genuine
- "explorer" → high interest ≠ follow-through

## MODULE E — OUTPUT (JSON ONLY)
{
  "adjustments": {
    "need_fit":   {"delta":number(-8 to +5),"reason":"string","confidence":"high|medium|low"},
    "usage":      {"delta":number(-8 to +5),"reason":"string","confidence":"high|medium|low"},
    "budget_fit": {"delta":number(-3 to +3),"reason":"string","confidence":"high|medium|low"},
    "overlap":    {"delta":number(-8 to +5),"reason":"string","confidence":"high|medium|low"},
    "risk":       {"delta":number(-5 to +5),"reason":"string","confidence":"high|medium|low"}
  },
  "narrative_insight": "2-3 sentences for report",
  "overlap_inference": "functional overlap assessment"
}

## MODULE F — PROHIBITED
1. Do NOT re-penalize signals rules handled
2. Do NOT reward politeness as scoring signal
3. Do NOT hallucinate service info — set confidence "low" if unsure
4. Budget_fit delta capped ±3
5. delta=0 reason: "Consistent with rule assessment"
6. Adjustment count ≠ effort. Five delta=0s is fine.
7. Do NOT double-count cross-validation adjustments`;

// ═══════════════════════════════════════════════════════════════════════
// RULE PARAMS — Complete V4 scoring constants
// ═══════════════════════════════════════════════════════════════════════
const DEFAULT_RULES = {
  need_fit_scenario_specific: 22, need_fit_problem_aware: 18, need_fit_category_only: 14, need_fit_none: 10, need_fit_default: 12,
  usage_daily: 25, usage_most_days: 23, usage_few_times: 18, usage_weekly: 10, usage_rarely: 0, usage_default: 10, usage_upgrading: 23,
  budget_comfortable: 18, budget_tight: 10, budget_no_way: 3, budget_default: 10,
  ratio_low_threshold: 0.05, ratio_high_threshold: 0.15, ratio_low_bonus: 3, ratio_high_penalty: -3,
  cpu_benchmark: 2.0, cpu_high_ratio: 3.0, cpu_high_penalty: -3, cpu_mid_ratio: 1.5, cpu_mid_penalty: -1, cpu_low_ratio: 0.3, cpu_low_bonus: 2,
  overlap_none: 15, overlap_some: 10, overlap_significant: 4, overlap_high: 0, overlap_not_sure: 7, overlap_default: 7, no_subs_floor: 13,
  portfolio_min_count: 2, portfolio_max_usage: 0.4, portfolio_penalty: 3,
  risk_none: 15, risk_free_enough: 10, risk_forget_cancel: 7, risk_interest_decay: 6, risk_not_sure: 5, risk_impulse: 4, risk_default: 8,
  unc_frequency: 3, unc_budget: 2, unc_motivation: 2, unc_overlap: 1, unc_risk: 1, unc_max: 10, unc_lifecycle_half: 0.5,
  cv_high_need: 18, cv_low_usage: 12, cv_need_penalty: -3, cv_low_need: 14, cv_high_usage: 18, cv_usage_bonus: 2,
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
  if (s.history_status === "upgrading") us = rules.usage_upgrading;
  else {
    const f = parseFloat(s.expected_frequency);
    if (f >= 7) us = rules.usage_daily; else if (f >= 4.5) us = rules.usage_most_days;
    else if (f >= 2.5) us = rules.usage_few_times; else if (f >= 1) us = rules.usage_weekly;
    else if (f === 0) us = rules.usage_rarely;
    else if (s.expected_frequency === "not_sure") { ns.frequency = true; }
  }
  us = clamp(us * lifecycleCoeff, 0, 25);

  // Cross-validation
  let cvN = 0, cvU = 0;
  if (nf > rules.cv_high_need && us < rules.cv_low_usage) cvN = rules.cv_need_penalty;
  if (nf < rules.cv_low_need && us > rules.cv_high_usage) cvU = rules.cv_usage_bonus;
  nf = clamp(nf + cvN, 0, 25); us = clamp(us + cvU, 0, 25);

  // Budget
  let bf = rules.budget_default;
  if (s.budget_feel === "comfortable") bf = rules.budget_comfortable;
  else if (s.budget_feel === "tight") bf = rules.budget_tight;
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

  // Risk
  let rk = rules.risk_default;
  if (s.top_risk === "none") rk = rules.risk_none; else if (s.top_risk === "free_enough") rk = rules.risk_free_enough;
  else if (s.top_risk === "forget_cancel") rk = rules.risk_forget_cancel; else if (s.top_risk === "interest_decay") rk = rules.risk_interest_decay;
  else if (s.top_risk === "impulse") rk = rules.risk_impulse; else if (s.top_risk === "not_sure") { rk = rules.risk_not_sure; ns.risk = true; }

  // Uncertainty
  let unc = 0, nsc = 0;
  if (ns.frequency) { unc += rules.unc_frequency; nsc++; } if (ns.budget) { unc += rules.unc_budget; nsc++; }
  if (ns.motivation) { unc += rules.unc_motivation; nsc++; } if (ns.overlap) { unc += rules.unc_overlap; nsc++; }
  if (ns.risk) { unc += rules.unc_risk; nsc++; }
  const had = ["cancelled","upgrading","free_trial"].includes(s.history_status);
  if (had) unc *= rules.unc_lifecycle_half;
  unc = Math.min(rules.unc_max, unc);

  const total = clamp(nf + us + bf + ov + rk - unc, 0, 100);
  const ul = nsc === 0 ? "low" : nsc <= 2 ? "medium" : "high";
  const round = v => Math.round(v * 10) / 10;
  return { need_fit: round(nf), usage: round(us), budget_fit: round(bf), overlap: round(ov), risk: round(rk), uncertainty_penalty: round(unc), total: round(total), not_sure_count: nsc, uncertainty_level: ul, cv_need_adj: cvN, cv_usage_adj: cvU, had_before: had };
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
      setMessages(prev=>[...prev,{role:"assistant",text:txt,options:p.options,parsed:p,inputMode:p.ui?.input_mode||p.input_mode,ahaText:aha}]);
    } catch { setMessages(p=>[...p,{role:"assistant",text:raw}]); }
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!apiKey||loading) return; setError(null);
    const um = {role:"user",content:text}; const nr = [...rawConvo,um]; setRawConvo(nr); setMessages(p=>[...p,{role:"user",text}]); setLoading(true);
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

  return { messages, slots, stage, turnIdx, loading, finished, error, sendMessage, startChat, rawConvo, runAdj };
}

// ═══════════════════════════════════════════════════════════════════════
// PANELS
// ═══════════════════════════════════════════════════════════════════════
function ChatPanel({chat,apiKey,onGoToRules,onRunAdj}) {
  const [inp,setInp] = useState(""); const ref = useRef(null);
  useEffect(()=>{if(ref.current) ref.current.scrollTop=ref.current.scrollHeight},[chat.messages,chat.loading,chat.finished]);
  const send = t => { if(!t.trim()) return; chat.sendMessage(t.trim()); setInp(""); };
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,fontWeight:600,color:C.text}}>Chat</span><Tag color={C.accent} bg={C.accentSoft}>{chat.stage}</Tag><Tag color={C.textDim} bg={C.surface}>t{chat.turnIdx}</Tag></div>
        <Btn small onClick={chat.startChat}>{chat.messages.length?"Restart":"Start"}</Btn>
      </div>
      <div ref={ref} style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
        {!chat.messages.length && <div style={{textAlign:"center",color:C.textDim,fontSize:13,marginTop:40}}>{apiKey?'Click Start':"Set API key in ⚙️"}</div>}
        {chat.messages.map((m,i) => <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"82%",display:"flex",flexDirection:"column",gap:6}}>
          {m.ahaText && <div style={{background:C.yellowSoft,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.yellow,lineHeight:1.5,borderLeft:`3px solid ${C.yellow}`,border:"1px dashed rgba(234,179,8,0.3)"}}>💡 {m.ahaText}</div>}
          <div style={{padding:"9px 13px",borderRadius:m.role==="user"?"14px 14px 3px 14px":"14px 14px 14px 3px",background:m.isError?C.redSoft:m.role==="user"?C.accent:C.surface,color:m.isError?C.red:m.role==="user"?"#fff":C.text,border:m.role==="user"?"none":`1px solid ${C.border}`,fontSize:13,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{m.text}</div>
          {m.options?.length>0 && <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{m.options.map((o,j)=><button key={j} onClick={()=>send(o.label)} disabled={chat.loading} style={{padding:"5px 11px",borderRadius:16,fontSize:11,fontWeight:500,background:C.surface,color:C.accent,border:`1px solid ${C.border}`,cursor:chat.loading?"default":"pointer",opacity:chat.loading?0.5:1}}>{o.label}</button>)}</div>}
        </div>)}
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
    {t:"Usage /25",k:[["usage_daily","daily"],["usage_most_days","most days"],["usage_few_times","few times"],["usage_weekly","weekly"],["usage_rarely","rarely"],["usage_upgrading","upgrading"]]},
    {t:"Budget /20",k:[["budget_comfortable","comfortable"],["budget_tight","tight"],["budget_no_way","no_way"]]},
    {t:"Budget Adj",k:[["ratio_low_bonus","<5% bonus"],["ratio_high_penalty",">15% penalty"],["cpu_benchmark","CPU bench ($)"]]},
    {t:"Overlap /15",k:[["overlap_none","none"],["overlap_some","some"],["overlap_significant","significant"],["overlap_high","high"],["no_subs_floor","no-subs floor"],["portfolio_penalty","portfolio pen."]]},
    {t:"Risk /15",k:[["risk_none","none"],["risk_free_enough","free_enough"],["risk_forget_cancel","forget_cancel"],["risk_interest_decay","interest_decay"],["risk_impulse","impulse"]]},
    {t:"Uncertainty",k:[["unc_frequency","freq wt"],["unc_budget","budget wt"],["unc_motivation","motiv wt"],["unc_overlap","overlap wt"],["unc_risk","risk wt"],["unc_max","max"]]},
    {t:"Cross-val",k:[["cv_need_penalty","hi-need+lo-use"],["cv_usage_bonus","lo-need+hi-use"]]},
    {t:"Thresholds",k:[["threshold_subscribe","Subscribe ≥"],["threshold_trial","Trial ≥"],["threshold_watchlist","Watchlist ≥"]]},
  ];
  return (
    <div style={{padding:14,overflowY:"auto",height:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{fontSize:13,fontWeight:600,color:C.text}}>Rules</span><Btn small onClick={()=>setRules({...DEFAULT_RULES})}>Reset</Btn></div>
      {sr && <div style={{padding:10,borderRadius:8,background:C.accentSoft,border:`1px solid ${C.accent}30`,marginBottom:12,fontSize:11,color:C.accent,lineHeight:1.7,fontFamily:"'JetBrains Mono',monospace"}}>
        <div style={{fontWeight:700,fontSize:13}}>Score: {sr.total} | {sr.uncertainty_level} ({sr.not_sure_count}×ns)</div>
        NF={sr.need_fit} US={sr.usage} BF={sr.budget_fit} OV={sr.overlap} RK={sr.risk} −{sr.uncertainty_penalty}
        {sr.cv_need_adj!==0&&<span style={{color:C.orange}}> cv:nf{sr.cv_need_adj}</span>}{sr.cv_usage_adj!==0&&<span style={{color:C.green}}> cv:us+{sr.cv_usage_adj}</span>}{sr.had_before&&<span style={{color:C.purple}}> ½unc</span>}
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
  const d = t==="convo"?DEFAULT_CONVO_PROMPT:DEFAULT_ADJUSTER_PROMPT;
  const savePrompt = () => { localStorage.setItem(key, p); setSaved(true); setTimeout(()=>setSaved(false),1800); };
  const resetPrompt = () => { sP(d); localStorage.removeItem(key); };
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
      {localStorage.getItem(key) ? <span style={{color:C.green,marginRight:8}}>● saved</span> : <span style={{color:C.textDim,marginRight:8}}>○ unsaved</span>}
      {p.length} chars · {p.split(/\s+/).length} words
    </div>
  </div>;
}

function AdjPanel({adj,weights,setW,sr,rules}) {
  if (!adj) return <div style={{padding:20,textAlign:"center",color:C.textDim,fontSize:13}}>Run Adjuster after conversation</div>;
  const D = ["need_fit","usage","budget_fit","overlap","risk"];
  const M = {need_fit:25,usage:25,budget_fit:20,overlap:15,risk:15};
  const L = {need_fit:"Need Fit",usage:"Usage",budget_fit:"Budget",overlap:"Overlap",risk:"Risk"};
  let bT=0,rT=0; const bl = {};
  D.forEach(d=>{const r=sr[d]||0;const dl=adj.adjustments?.[d]?.delta||0;const b=clamp(blend(r,dl,weights[d]),0,M[d]);bl[d]=b;bT+=b;rT+=r;});
  bT-=(sr.uncertainty_penalty||0); rT-=(sr.uncertainty_penalty||0); bT=clamp(bT,0,100); rT=clamp(rT,0,100);
  const bg=getBadge(bT,rules); const df=bT-rT;
  return <div style={{padding:14,overflowY:"auto",height:"100%"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div><span style={{fontSize:32,fontWeight:700,color:C.text,fontFamily:"'JetBrains Mono',monospace"}}>{bT.toFixed(1)}</span><span style={{fontSize:14,color:df>0?C.green:df<0?C.orange:C.textDim,fontWeight:600,marginLeft:8,fontFamily:"'JetBrains Mono',monospace"}}>({df>0?"+":""}{df.toFixed(1)})</span></div>
      <Tag color={bg.c} bg={bg.bg}>{bg.label}</Tag>
    </div>
    {D.map(d=>{const a=adj.adjustments?.[d]||{delta:0,reason:"N/A",confidence:"low"};const cc=a.confidence==="high"?C.green:a.confidence==="medium"?C.yellow:C.textDim;return <div key={d} style={{marginBottom:12,padding:10,background:C.surface,borderRadius:8,border:`1px solid ${C.border}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,fontWeight:600,color:C.text}}>{L[d]}</span><span style={{fontSize:13,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:a.delta>0?C.green:a.delta<0?C.orange:C.textDim}}>{a.delta>0?"+":""}{a.delta}</span></div><Tag color={cc} bg={a.confidence==="high"?C.greenSoft:a.confidence==="medium"?C.yellowSoft:C.surface}>{a.confidence}</Tag></div>
      <div style={{fontSize:11,color:C.textSec,lineHeight:1.5,marginBottom:6}}>{a.reason}</div>
      <Sld label="w" value={weights[d]} onChange={v=>setW(p=>({...p,[d]:v}))}/>
    </div>})}
    {adj.narrative_insight&&<div style={{padding:10,borderRadius:8,background:C.purpleSoft,border:`1px solid ${C.purple}30`,marginTop:8}}><div style={{fontSize:10,fontWeight:700,color:C.purple,marginBottom:4}}>NARRATIVE</div><div style={{fontSize:12,color:C.text,lineHeight:1.6}}>{adj.narrative_insight}</div></div>}
    {adj.overlap_inference&&<div style={{padding:10,borderRadius:8,background:C.yellowSoft,border:`1px solid ${C.yellow}30`,marginTop:8}}><div style={{fontSize:10,fontWeight:700,color:C.yellow,marginBottom:4}}>OVERLAP</div><div style={{fontSize:12,color:C.text,lineHeight:1.6}}>{adj.overlap_inference}</div></div>}
  </div>;
}

const TAGS = ["music","video","gaming","productivity","health","fitness","learning","design","creative","social","news","finance"];
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
        const adjTotal = p.adj ? (() => { const D=["need_fit","usage","budget_fit","overlap","risk"]; const M={need_fit:25,usage:25,budget_fit:20,overlap:15,risk:15}; let t=0; D.forEach(d=>{const base=p.sr?.[d]||0;const dl=p.adj.adjustments?.[d]?.delta||0;t+=clamp(blend(base,dl,0.5),0,M[d]);}); return clamp(t-(p.sr?.uncertainty_penalty||0),0,100).toFixed(1); })() : null;
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
  const [cp,setCp] = useState(()=>localStorage.getItem("subsense_prompt_convo")||DEFAULT_CONVO_PROMPT);
  const [ap,setAp] = useState(()=>localStorage.getItem("subsense_prompt_adjuster")||DEFAULT_ADJUSTER_PROMPT);
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
          {rp==="adjuster"&&<AdjPanel adj={adj} weights={weights} setW={setW} sr={sr} rules={rules}/>}
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
