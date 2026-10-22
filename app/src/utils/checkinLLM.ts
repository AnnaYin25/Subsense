/**
 * Check-In LLM Utilities — Phase 4
 * Generates personalized question flows (love / unsure / review) using Claude Haiku.
 */

import type { SetupPreferences } from '@/types';
import { anthropic } from './anthropicClient';

// ---- Public types ----

export interface QOption {
  key: string;
  label: string;
}

export interface ReviewQuestions {
  valueType: string;
  q1: { text: string; options: QOption[] };
  q2Map: Record<string, { text: string; options: QOption[] }>;
}

export interface LoveQuestions {
  q1: { text: string; options: QOption[] };
}

// ---- Fallbacks ----

const SHARED_Q2_FALLBACK = {
  text: 'Thinking about canceling or downgrading?',
  options: [
    { key: 'cancel_soon', label: 'Want to cancel' },
    { key: 'downgrade', label: 'Consider downgrade' },
    { key: 'keep_monitor', label: 'Monitor for now' },
    { key: 'undecided', label: 'Not sure yet' },
  ],
};

export const FALLBACK_REVIEW_QUESTIONS: ReviewQuestions = {
  valueType: 'general',
  q1: {
    text: 'What do you use it most for lately?',
    options: [
      { key: 'work', label: 'Work / Study' },
      { key: 'entertainment', label: 'Entertainment' },
      { key: 'utilities', label: 'Daily tools' },
      { key: 'social', label: 'Social' },
    ],
  },
  q2Map: {
    work: SHARED_Q2_FALLBACK,
    entertainment: SHARED_Q2_FALLBACK,
    utilities: SHARED_Q2_FALLBACK,
    social: SHARED_Q2_FALLBACK,
  },
};

export const FALLBACK_LOVE_QUESTIONS: LoveQuestions = {
  q1: {
    text: 'What was your best use case recently?',
    options: [
      { key: 'work_boost', label: 'Work efficiency' },
      { key: 'relax', label: 'Relax & unwind' },
      { key: 'new_content', label: 'Discover content' },
      { key: 'habit', label: 'Just habit' },
    ],
  },
};

export const FALLBACK_UNSURE_QUESTIONS: ReviewQuestions = {
  valueType: 'general',
  q1: {
    text: 'When did you last open it?',
    options: [
      { key: 'today', label: 'Today' },
      { key: 'this_week', label: 'This week' },
      { key: 'last_week', label: 'Last week' },
      { key: 'over_2_weeks', label: 'Over 2 weeks ago' },
    ],
  },
  q2Map: {
    today: {
      text: 'What were you doing with it?',
      options: [
        { key: 'specific_task', label: 'A specific task' },
        { key: 'browsing', label: 'Just browsing' },
        { key: 'habit_check', label: 'Habit check-in' },
        { key: 'notification', label: 'Got a notification' },
      ],
    },
    this_week: {
      text: 'What were you doing with it?',
      options: [
        { key: 'specific_task', label: 'A specific task' },
        { key: 'browsing', label: 'Just browsing' },
        { key: 'habit_check', label: 'Habit check-in' },
        { key: 'notification', label: 'Got a notification' },
      ],
    },
    last_week: {
      text: 'What usually brings you back to it?',
      options: [
        { key: 'specific_need', label: 'A specific need' },
        { key: 'boredom', label: 'Boredom' },
        { key: 'reminder', label: 'Reminder/notification' },
        { key: 'no_reason', label: 'No particular reason' },
      ],
    },
    over_2_weeks: {
      text: 'What usually brings you back to it?',
      options: [
        { key: 'specific_need', label: 'A specific need' },
        { key: 'boredom', label: 'Boredom' },
        { key: 'reminder', label: 'Reminder/notification' },
        { key: 'no_reason', label: 'No particular reason' },
      ],
    },
  },
};

// ---- System prompts ----

const REVIEW_SYSTEM_PROMPT = `You are SubSense AI. Output valid JSON only — no markdown, no prose, start directly with {

TASK: Generate a 2-step Review check-in. User swiped left — questioning whether to keep this subscription.

q1 asks what they use the service FOR (specific activities, not generic categories).
q2 asks about the VALUE or OUTCOME of that specific activity.
q1.text and all q2.text values MUST mention the subscription name.
q1 option keys are snake_case. q2Map keys are identical copies of the q1 option keys.

EXAMPLE — if subscription is "Netflix":
{"valueType":"content_streaming","q1":{"text":"What pulls you to Netflix these days?","options":[{"key":"binge_series","label":"Binge new series"},{"key":"movie_night","label":"Movie nights"},{"key":"rewatch","label":"Rewatch old faves"},{"key":"background","label":"Background noise"}]},"q2Map":{"binge_series":{"text":"How's Netflix's new show quality been?","options":[{"key":"hooked","label":"Hooked on something"},{"key":"okay","label":"It's okay"},{"key":"nothing_great","label":"Nothing great"},{"key":"gave_up","label":"Gave up mid-show"}]},"movie_night":{"text":"How's Netflix's movie selection lately?","options":[{"key":"solid","label":"Solid picks"},{"key":"rewatching","label":"Only rewatching"},{"key":"meh","label":"Mostly meh"},{"key":"other_apps","label":"Using other apps"}]},"rewatch":{"text":"What keeps pulling you back to rewatch?","options":[{"key":"comfort","label":"Comfort watching"},{"key":"no_new","label":"Nothing new to watch"},{"key":"with_others","label":"Watching with others"},{"key":"fill_time","label":"Just filling time"}]},"background":{"text":"Is Netflix worth it just for background?","options":[{"key":"worth_it","label":"Yeah worth it"},{"key":"habit","label":"Mostly habit"},{"key":"youtube_better","label":"Could use YouTube"},{"key":"too_pricey","label":"Feels too pricey"}]}}}

Now generate for the actual subscription in the user message. Same structure. Make it specific to that service.`;

const LOVE_SYSTEM_PROMPT = `You are SubSense AI, generating personalized check-in questions for a subscription app.

OUTPUT: Valid JSON only. No prose, no markdown, no code blocks.

TASK: Generate a single "Love" check-in question. The user just said they love this subscription.

CRITICAL PERSONALIZATION RULE:
- q1.text MUST mention the subscription name (e.g. "What's been your Netflix highlight?" not "What was your best use case?")
- Options MUST be things users literally DO with this specific service — not generic labels
- BAD: "Work efficiency", "Relax & unwind", "Discover content", "Just habit" (could be any app)
- GOOD for Netflix: "Binge a new series", "Rewatch old faves", "Movie night", "Background play"
- GOOD for Spotify: "Found new artists", "Podcast deep-dive", "Playlist for mood", "Working music"
- GOOD for Notion: "Built a new system", "Daily journaling", "Team docs", "Personal database"
- GOOD for Peloton: "Live ride session", "Strength training", "Meditation class", "Stretching routine"

RULES:
- Language: English only
- Tone: warm and casual — NOT formal
- q1 must have exactly 4 options
- Options should feel like natural things fans of THIS service would say

OUTPUT SCHEMA (do not deviate):
{
  "q1": {
    "text": "string (≤12 words, MUST include subscription name, enthusiastic but casual)",
    "options": [
      {"key": "snake_case_unique", "label": "≤4 words, service-specific"}
    ]
  }
}`;

const UNSURE_SYSTEM_PROMPT = `You are SubSense AI. Output valid JSON only — no markdown, no prose, start directly with {

TASK: Generate a 2-step "Maybe" check-in. User swiped down — they're uncertain. These questions are purely about USAGE HABIT: when they last used it, and what they were doing in that session. No value judgments, no cancellation intent, no "is it worth it" angles.

DISTINCTION FROM REVIEW:
- Review asks: what do you use it for + is it satisfying/valuable?
- Maybe asks: when did you last use it + what specifically were you doing that time?

q1: Ask when they last opened the service (recency). MUST mention subscription name.
q2: Ask what they were specifically doing during that session. Options must be concrete activities for THIS service — not generic.
- For recent use (today/this week): "What were you doing on [service]?" → service-specific activities
- For non-recent (last week/over 2 weeks): "What usually pulls you back to [service]?" → service-specific triggers

EXAMPLE — if subscription is "Netflix":
{"q1":{"text":"When did you last open Netflix?","options":[{"key":"today","label":"Today"},{"key":"this_week","label":"This week"},{"key":"last_week","label":"Last week"},{"key":"over_2_weeks","label":"Over 2 weeks ago"}]},"q2Map":{"today":{"text":"What were you watching on Netflix?","options":[{"key":"new_show","label":"A new series"},{"key":"movie","label":"A movie"},{"key":"rewatching","label":"Rewatching something"},{"key":"just_browsing","label":"Just browsing"}]},"this_week":{"text":"What were you watching on Netflix?","options":[{"key":"new_show","label":"A new series"},{"key":"movie","label":"A movie"},{"key":"rewatching","label":"Rewatching something"},{"key":"just_browsing","label":"Just browsing"}]},"last_week":{"text":"What usually pulls you back to Netflix?","options":[{"key":"new_release","label":"New release"},{"key":"boredom","label":"Boredom"},{"key":"watch_together","label":"Watch with someone"},{"key":"no_reason","label":"No particular reason"}]},"over_2_weeks":{"text":"What usually pulls you back to Netflix?","options":[{"key":"new_release","label":"New release"},{"key":"boredom","label":"Boredom"},{"key":"watch_together","label":"Watch with someone"},{"key":"no_reason","label":"No particular reason"}]}}}

q2Map keys MUST exactly match the q1 option keys. Now generate for the actual subscription below.`;

// ---- Response parsers ----

const DEFAULT_Q2_ENTRY = {
  text: 'What are you thinking going forward?',
  options: [
    { key: 'keep', label: 'Keep as-is' },
    { key: 'monitor', label: 'Monitor usage' },
    { key: 'downgrade', label: 'Consider downgrade' },
    { key: 'cancel', label: 'Might cancel' },
  ],
};

function parseAndValidateReview(text: string): ReviewQuestions {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  const parsed = JSON.parse(jsonMatch[0]) as Partial<ReviewQuestions>;

  // q1 must be valid — if not, throw and use full fallback
  if (!parsed.q1?.text || !Array.isArray(parsed.q1?.options) || parsed.q1.options.length < 2) {
    throw new Error('Invalid q1');
  }

  // Cap q1 to 4 options
  parsed.q1.options = parsed.q1.options.slice(0, 4);

  const q2Map = (parsed.q2Map && typeof parsed.q2Map === 'object')
    ? (parsed.q2Map as Record<string, { text: string; options: QOption[] }>)
    : {};

  // For each q1 option, use LLM's q2 if valid, otherwise fill with default
  const filledQ2Map: Record<string, { text: string; options: QOption[] }> = {};
  for (const opt of parsed.q1.options) {
    const entry = q2Map[opt.key];
    if (entry?.text && Array.isArray(entry.options) && entry.options.length >= 2) {
      filledQ2Map[opt.key] = { ...entry, options: entry.options.slice(0, 4) };
    } else {
      filledQ2Map[opt.key] = DEFAULT_Q2_ENTRY;
    }
  }

  return {
    valueType: (parsed as ReviewQuestions).valueType ?? 'general',
    q1: parsed.q1,
    q2Map: filledQ2Map,
  };
}

function parseAndValidateLove(text: string): LoveQuestions {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  const parsed = JSON.parse(jsonMatch[0]) as Partial<LoveQuestions>;

  if (!parsed.q1?.text || !Array.isArray(parsed.q1?.options) || parsed.q1.options.length < 2) {
    throw new Error('Invalid q1');
  }

  parsed.q1.options = parsed.q1.options.slice(0, 4);
  return parsed as LoveQuestions;
}

// ---- Shared context builder ----

function buildContext(
  subscription: { name: string; cost: number; billingCycle: string; category: string },
  persona: SetupPreferences,
): string {
  const priceNote = persona.price_sensitivity > 0.7
    ? 'IMPORTANT: This user is price-sensitive (price_sensitivity > 0.7). Include a cost/value-for-money angle.'
    : '';

  const favCats = persona.favorite_categories ?? [];
  const isFavorite = favCats.length > 0 && favCats.some(c => subscription.category.toLowerCase().includes(c.toLowerCase()));
  const categoryNote = isFavorite
    ? `This subscription is in one of the user's FAVORITE categories (${favCats.join(', ')}). Frame questions with extra personal relevance.`
    : favCats.length > 0
      ? `User's favorite categories are: ${favCats.join(', ')}. This subscription is outside those interests.`
      : '';

  return `Subscription: ${subscription.name}
Price: $${subscription.cost}/${subscription.billingCycle}
Category: ${subscription.category}
Persona: price_sensitivity=${persona.price_sensitivity.toFixed(2)}, waste_tolerance=${persona.waste_tolerance.toFixed(2)}, quality_preference=${persona.quality_preference.toFixed(2)}
${priceNote}
${categoryNote}`.trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// ---- Public API ----

/**
 * Generate personalized Review (left-swipe) questions for a subscription.
 * Falls back to FALLBACK_REVIEW_QUESTIONS on any error.
 */
export async function generateReviewQuestions(
  subscription: { name: string; cost: number; billingCycle: string; category: string },
  persona: SetupPreferences,
  recentHistory: { action: string; q1Answer: string | null }[],
): Promise<ReviewQuestions> {
  const historyText = recentHistory.length > 0
    ? recentHistory.map(h => `${h.action}${h.q1Answer ? `(${h.q1Answer})` : ''}`).join(', ')
    : 'no previous check-ins';

  const userContext = `${buildContext(subscription, persona)}
Recent check-in history: ${historyText}`;

  console.log('[Review] Calling LLM for:', subscription.name);
  try {
    const message = await withTimeout(
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: REVIEW_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContext }],
      }),
      12000,
    );
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    console.log('[Review] Raw response:', text.slice(0, 300));
    const result = parseAndValidateReview(text);
    console.log('[Review] Parsed q1:', result.q1.text);
    return result;
  } catch (error) {
    console.warn('[Review] Failed, using fallback:', error);
    return FALLBACK_REVIEW_QUESTIONS;
  }
}

/**
 * Generate personalized Love (right-swipe) question for a subscription.
 * Falls back to FALLBACK_LOVE_QUESTIONS on any error.
 */
export async function generateLoveQuestions(
  subscription: { name: string; cost: number; billingCycle: string; category: string },
  persona: SetupPreferences,
): Promise<LoveQuestions> {
  try {
    const message = await withTimeout(
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: LOVE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildContext(subscription, persona) }],
      }),
      12000,
    );
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return parseAndValidateLove(text);
  } catch (error) {
    console.warn('[CheckInLLM] generateLoveQuestions failed, using fallback:', error);
    return FALLBACK_LOVE_QUESTIONS;
  }
}

/**
 * Generate personalized Unsure (down-swipe) questions for a subscription.
 * Falls back to FALLBACK_UNSURE_QUESTIONS on any error.
 */
export async function generateUnsureQuestions(
  subscription: { name: string; cost: number; billingCycle: string; category: string },
  persona: SetupPreferences,
): Promise<ReviewQuestions> {
  try {
    const message = await withTimeout(
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: UNSURE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildContext(subscription, persona) }],
      }),
      12000,
    );
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return parseAndValidateReview(text); // same q1+q2Map structure
  } catch (error) {
    console.warn('[CheckInLLM] generateUnsureQuestions failed, using fallback:', error);
    return FALLBACK_UNSURE_QUESTIONS;
  }
}
