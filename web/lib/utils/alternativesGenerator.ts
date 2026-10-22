/**
 * Alternatives generator
 * Returns cheaper/free alternatives for a given service category.
 * Uses rule-based lookup first; falls back to Claude API if no match.
 */

import { anthropic } from './anthropicClient';

export interface Alternative {
  name: string;
  cost: string;
  reason: string;
}

const ALTERNATIVES_DB: Record<string, Alternative[]> = {
  Entertainment: [
    { name: 'Tubi', cost: 'Free', reason: 'Ad-supported streaming with wide content library' },
    { name: 'YouTube (free)', cost: 'Free', reason: 'Massive free video library covering most genres' },
    { name: 'Library + Hoopla', cost: 'Free', reason: 'Free streaming with a library card — movies, music, ebooks' },
  ],
  Productivity: [
    { name: 'Notion (free tier)', cost: 'Free', reason: 'Personal use is free forever with no time limit' },
    { name: 'Obsidian', cost: 'Free', reason: 'Local-first note-taking, no subscription required' },
    { name: 'Google Workspace (free)', cost: 'Free', reason: 'Docs, Sheets, and Drive at no cost for personal use' },
  ],
  Utilities: [
    { name: 'Bitwarden', cost: 'Free – $10/yr', reason: 'Open-source password manager with full-featured free tier' },
    { name: '1Password Families', cost: '$5/mo', reason: 'Cheaper when cost is shared across family members' },
    { name: 'KeePassXC', cost: 'Free', reason: 'Offline, open-source password manager with no subscription' },
  ],
  Health: [
    { name: 'Nike Training Club', cost: 'Free', reason: 'Hundreds of free guided workouts for all fitness levels' },
    { name: 'YouTube Fitness', cost: 'Free', reason: 'Thousands of free workout videos across all styles' },
    { name: 'Down Dog (free tier)', cost: 'Free', reason: 'Yoga app with a generous free plan' },
  ],
};

export async function generateAlternatives(
  serviceName: string,
  category: string,
  cost: number
): Promise<Alternative[]> {
  // Step 1: Rule-based lookup
  const ruleMatches = ALTERNATIVES_DB[category];
  if (ruleMatches && ruleMatches.length > 0) {
    return ruleMatches.slice(0, 3);
  }

  // Step 2: Claude fallback
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `Suggest 3 cheaper or free alternatives to "${serviceName}" (current cost: $${cost}/mo, category: ${category}).
Return ONLY valid JSON — no prose, no markdown:
[{"name":"...","cost":"...","reason":"..."}]`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed: Alternative[] = JSON.parse(jsonMatch[0]);
      return parsed.slice(0, 3);
    }
  } catch (error) {
    console.error('[alternativesGenerator] Claude fallback failed:', error);
  }

  // Ultimate fallback
  return [
    {
      name: 'Search for free alternatives',
      cost: 'Free',
      reason: `Look for open-source or free-tier options in the "${category}" category`,
    },
  ];
}
