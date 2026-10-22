import type { SetupPreferences, SubscriberType, AuditPersona, Subscription } from '@/types';

/**
 * Generate persona type and description based on setup preferences
 * Based on Stable Judgement System Plan
 */

export interface PersonaProfile {
  type: string;
  emoji: string;
  title: string;
  description: string;
  traits: string[];
}

export const generatePersonaProfile = (preferences: SetupPreferences): PersonaProfile => {
  const {
    budget_tightness,
    waste_tolerance,
    exploration_tendency,
    quality_preference,
    decision_style
  } = preferences;

  // Determine primary persona type based on dominant traits
  let type: string;
  let emoji: string;
  let title: string;
  let description: string;

  // Budget-conscious + Low waste tolerance
  if (budget_tightness > 0.6 && waste_tolerance < 0.4) {
    type = 'frugal_optimizer';
    emoji = '💰';
    title = 'The Frugal Optimizer';
    description = 'You track every dollar and hate wasted spending. You prefer proven value over experiments.';
  }
  // High exploration + High quality preference
  else if (exploration_tendency > 0.6 && quality_preference > 0.6) {
    type = 'premium_explorer';
    emoji = '✨';
    title = 'The Premium Explorer';
    description = 'You love trying new premium services. Quality matters more than price for you.';
  }
  // High waste tolerance + Low budget tightness
  else if (waste_tolerance > 0.6 && budget_tightness < 0.4) {
    type = 'relaxed_subscriber';
    emoji = '😊';
    title = 'The Relaxed Subscriber';
    description = "You're not stressed about unused subscriptions. You keep services for convenience.";
  }
  // Low exploration + High budget consciousness
  else if (exploration_tendency < 0.4 && budget_tightness > 0.6) {
    type = 'cautious_saver';
    emoji = '🛡️';
    title = 'The Cautious Saver';
    description = 'You stick to what you know and watch your budget carefully. Safety over novelty.';
  }
  // High exploration + Low budget tightness
  else if (exploration_tendency > 0.6 && budget_tightness < 0.5) {
    type = 'serial_trialer';
    emoji = '🎯';
    title = 'The Serial Trialer';
    description = 'You love discovering new services and jumping on trials. Always exploring options.';
  }
  // Balanced across dimensions
  else {
    type = 'balanced_user';
    emoji = '⚖️';
    title = 'The Balanced User';
    description = 'You take a balanced approach to subscriptions. Practical and thoughtful decisions.';
  }

  // Generate trait list
  const traits: string[] = [];

  if (budget_tightness > 0.6) {
    traits.push('Budget-conscious');
  } else if (budget_tightness < 0.4) {
    traits.push('Flexible spender');
  }

  if (waste_tolerance < 0.4) {
    traits.push('Waste-averse');
  } else if (waste_tolerance > 0.6) {
    traits.push('Forgiving of unused services');
  }

  if (quality_preference > 0.6) {
    traits.push('Quality-focused');
  } else if (quality_preference < 0.4) {
    traits.push('Value-focused');
  }

  if (exploration_tendency > 0.6) {
    traits.push('Adventurous');
  } else if (exploration_tendency < 0.4) {
    traits.push('Cautious');
  }

  // Add decision style
  if (decision_style === 'quick') {
    traits.push('Quick decision maker');
  } else if (decision_style === 'deliberate') {
    traits.push('Thoughtful decision maker');
  } else {
    traits.push('Balanced decision style');
  }

  return {
    type,
    emoji,
    title,
    description,
    traits
  };
};

/**
 * Get a short summary for display in Manager screen
 */
export const getPersonaSummary = (preferences: SetupPreferences): string => {
  const profile = generatePersonaProfile(preferences);
  return `${profile.emoji} ${profile.title}`;
};

// ---- v2 Audit Persona helpers ----

/** Map internal persona type → v2 SubscriberType */
export function toSubscriberType(internalType: string): SubscriberType {
  const map: Record<string, SubscriberType> = {
    frugal_optimizer: 'essentialist',
    premium_explorer: 'explorer',
    relaxed_subscriber: 'balanced_user',
    cautious_saver: 'essentialist',
    serial_trialer: 'spontaneous',
    balanced_user: 'balanced_user',
  };
  return map[internalType] ?? 'balanced_user';
}

/** Get lifecycle_coeff from subscriber_type */
export function getLifecycleCoeff(subscriberType: SubscriberType): number {
  const map: Record<SubscriberType, number> = {
    power_user: 1.1,
    balanced_user: 1.0,
    essentialist: 1.0,
    explorer: 0.8,
    spontaneous: 0.7,
  };
  return map[subscriberType] ?? 1.0;
}

/**
 * Compute persona_alignment based on favorite_categories match with service category.
 * 0.7 = weak (no match), 1.0 = neutral (related), 1.3 = strong (direct match)
 */
export function computePersonaAlignment(
  favoriteCategories: string[],
  serviceCategory: string,
): number {
  if (!serviceCategory || favoriteCategories.length === 0) return 1.0;

  const svcLower = serviceCategory.toLowerCase();
  const favsLower = favoriteCategories.map(c => c.toLowerCase());

  // Direct match
  if (favsLower.some(f => f === svcLower || svcLower.includes(f) || f.includes(svcLower))) {
    return 1.3;
  }

  // Related category mapping (broader matches)
  const relatedGroups: string[][] = [
    ['entertainment', 'streaming', 'video', 'music', 'gaming', 'podcast'],
    ['productivity', 'design', 'creative', 'career', 'finance'],
    ['health', 'fitness', 'wellness'],
    ['learning', 'education'],
  ];

  for (const group of relatedGroups) {
    const svcInGroup = group.some(g => svcLower.includes(g));
    const favInGroup = favsLower.some(f => group.some(g => f.includes(g)));
    if (svcInGroup && favInGroup) return 1.0;
  }

  return 0.7;
}

/**
 * Build full AuditPersona from app state.
 * serviceCategory: inferred category of the service being audited (for persona_alignment).
 */
export function buildAuditPersona(
  userName: string,
  monthlyBudget: number,
  preferences: SetupPreferences,
  subscriptions: Subscription[],
  serviceCategory: string,
): AuditPersona {
  const profile = generatePersonaProfile(preferences);
  const subscriberType = toSubscriberType(profile.type);
  const lifecycleCoeff = getLifecycleCoeff(subscriberType);

  // Same-category subscriptions
  const sameCatSubs = subscriptions.filter(
    s => s.status === 'active' && s.category.toLowerCase() === serviceCategory.toLowerCase()
  );
  const sameCatNames = sameCatSubs.map(s => s.name).join(', ');
  const sameCatAvgUsage = sameCatSubs.length > 0
    ? sameCatSubs.reduce((sum, s) => sum + ((s.usageScore ?? 50) / 100), 0) / sameCatSubs.length
    : 0;

  const existingSubNames = subscriptions
    .filter(s => s.status === 'active')
    .map(s => s.name)
    .join(', ');

  const personaAlignment = computePersonaAlignment(
    preferences.favorite_categories,
    serviceCategory,
  );

  return {
    name: userName,
    monthly_budget: monthlyBudget,
    persona_alignment: personaAlignment,
    subscriber_type: subscriberType,
    lifecycle_coeff: lifecycleCoeff,
    same_cat_count: sameCatSubs.length,
    same_cat_avg_usage: Math.round(sameCatAvgUsage * 100) / 100,
    existing_subs_count: subscriptions.filter(s => s.status === 'active').length,
    existing_subs: existingSubNames || 'None',
    same_cat_subs: sameCatNames || '',
    interest_tags: preferences.favorite_categories ?? [],
  };
}
