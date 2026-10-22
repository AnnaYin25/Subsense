/**
 * Check-In Session Summary — Phase 5
 * Generates a post-session diagnostic summary using Claude Haiku.
 */

import type { CheckInAction, SetupPreferences } from '@/types';
import { anthropic } from './anthropicClient';

// ---- Public types ----

export interface SubSummary {
  subId: string;
  subName: string;
  usageScore: number;
  action: CheckInAction;
  q1Answer: string | null;
  q2Answer: string | null;
  diveDeeperNote: string | null;
  flagged: boolean; // action === 'review' OR usageScore < 35
}

export interface SuggestionItem {
  subId: string;
  name: string;
  action: 'pause' | 'cancel' | 'watch';
  reason: string; // ≤8 words
}

export interface SessionSummary {
  flagged: Array<{ subId: string; name: string; note: string }>;
  healthy: string[];
  suggestions: SuggestionItem[];
  personaChanges: string[]; // 2-3 short bullet lines about what shifted in the profile
}

// ---- Build SubSummary array from session results ----

export function buildSubSummaries(
  sessionResults: Record<string, { action: CheckInAction; q1: string | null; q2: string | null; diveNote: string | null }>,
  subscriptions: Array<{ id: string; name: string; usageScore?: number; usage_score?: number }>,
): SubSummary[] {
  return Object.entries(sessionResults).map(([subId, result]) => {
    const sub = subscriptions.find(s => s.id === subId);
    const usageScore = (sub as any)?.usageScore ?? (sub as any)?.usage_score ?? 50;
    return {
      subId,
      subName: sub?.name ?? subId,
      usageScore,
      action: result.action,
      q1Answer: result.q1,
      q2Answer: result.q2,
      diveDeeperNote: result.diveNote,
      flagged: result.action === 'review' || usageScore < 35,
    };
  });
}

// ---- Fallback (no LLM) ----

export function buildFallbackSummary(summaries: SubSummary[]): SessionSummary {
  const flaggedItems = summaries.filter(s => s.flagged);
  const flagged = flaggedItems.map(s => ({
    subId: s.subId,
    name: s.subName,
    note: s.action === 'review' ? 'Worth re-evaluating' : 'Usage trending low',
  }));
  const suggestions: SuggestionItem[] = flaggedItems.map(s => ({
    subId: s.subId,
    name: s.subName,
    action: s.usageScore < 35 ? 'cancel' : 'watch',
    reason: s.usageScore < 35 ? 'Consistently low usage' : 'Keep an eye on this one',
  }));
  const healthy = summaries.filter(s => !s.flagged).map(s => s.subName);
  return { flagged, healthy, suggestions, personaChanges: [] };
}

// ---- System prompt ----

const SYSTEM_PROMPT = `You are SubSense AI, analyzing a user's weekly subscription check-in session.

OUTPUT: Valid JSON only. No prose, no markdown, no code blocks.

TASK: Given check-in results for multiple subscriptions, generate a concise post-session summary with insights and suggestions.

RULES:
- Language: English only
- Tone: casual, like a smart friend — NOT formal or corporate
- "flagged" notes: ≤10 words, specific to the signals (action/q1/q2), NOT generic
- "suggestions": one per flagged sub
  - action = "pause" | "cancel" | "watch"
  - "pause" = cost/value mismatch but might need it; "cancel" = clear they don't need it; "watch" = uncertain, needs more data
  - reason ≤8 words, specific
- "personaChanges": array of 1-3 SHORT bullet strings about what shifted in the user's profile based on this session's signals. Each item ≤10 words. Be specific (mention signals like cost complaints, low usage, high engagement). If nothing notable, return 1 encouraging item like "Your subscriptions are in good shape this week." Never return an empty array.
- Unflagged subs go to "healthy" list only

OUTPUT SCHEMA (do not deviate):
{
  "flagged": [
    {"subId": "uuid", "name": "Service Name", "note": "≤10 words specific insight"}
  ],
  "healthy": ["Service Name"],
  "suggestions": [
    {"subId": "uuid", "name": "Service Name", "action": "pause", "reason": "≤8 words reason"}
  ],
  "personaChanges": ["Price sensitivity nudged up — cost flagged twice", "Waste tolerance adjusted downward"]
}`;

// ---- Main export ----

/**
 * Generate LLM-powered session summary.
 * Falls back to buildFallbackSummary on error or timeout (5s).
 */
export async function generateSessionSummary(
  summaries: SubSummary[],
  persona: SetupPreferences,
): Promise<SessionSummary> {
  if (summaries.length === 0) {
    return { flagged: [], healthy: [], suggestions: [], personaChanges: [] };
  }

  const summaryText = summaries
    .map(s => {
      const signals: string[] = [s.action];
      if (s.q1Answer) signals.push(`q1:${s.q1Answer}`);
      if (s.q2Answer) signals.push(`q2:${s.q2Answer}`);
      // dive_deeper takes priority as the most specific signal
      if (s.diveDeeperNote) signals.push(`user_note:"${s.diveDeeperNote}"`);
      return `[${s.subId}] ${s.subName} (usageScore:${s.usageScore}, flagged:${s.flagged}): ${signals.join(', ')}`;
    })
    .join('\n');

  const favCats = persona.favorite_categories ?? [];
  const favNote = favCats.length > 0 ? `, favorite_categories=[${favCats.join(', ')}]` : '';
  const userContext = `Session check-in results:\n${summaryText}\n\nPersona: price_sensitivity=${persona.price_sensitivity.toFixed(2)}, waste_tolerance=${persona.waste_tolerance.toFixed(2)}${favNote}`;

  const apiCall = anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContext }],
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 5000),
  );

  try {
    const message = await Promise.race([apiCall, timeoutPromise]);
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]) as Partial<SessionSummary>;
    if (!Array.isArray(parsed.flagged) || !Array.isArray(parsed.healthy)) {
      throw new Error('Invalid schema');
    }
    return {
      flagged: parsed.flagged ?? [],
      healthy: parsed.healthy ?? [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      personaChanges: Array.isArray(parsed.personaChanges) ? parsed.personaChanges : [],
    };
  } catch (error) {
    console.warn('[CheckInSummary] generateSessionSummary failed, using fallback:', error);
    return buildFallbackSummary(summaries);
  }
}
