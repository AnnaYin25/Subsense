import type { SetupQuestion } from '@/lib/types';

/**
 * Setup Questions Configuration
 * Based on Stable Judgement System Plan - Section 2.2 & 10
 *
 * Requirements:
 * - Maximum 4-6 questions
 * - Target completion time: < 2 minutes
 * - Each option must map to numeric values (0-1)
 * - Some parameters are inferred from direct questions
 */

export const SETUP_QUESTIONS: SetupQuestion[] = [
  // Question 1: Budget Tracking → budget_tightness
  {
    id: 'budget_tightness',
    question: 'How carefully do you track your monthly spending?',
    type: 'choice',
    options: [
      {
        label: 'Very loosely',
        emoji: '🤷',
        values: { budget_tightness: 0.2 }
      },
      {
        label: 'Somewhat carefully',
        emoji: '📊',
        values: { budget_tightness: 0.5 }
      },
      {
        label: 'Very carefully',
        emoji: '💰',
        values: { budget_tightness: 0.9 }
      }
    ]
  },

  // Question 2: Waste Reaction → waste_tolerance + price_sensitivity
  {
    id: 'waste_tolerance',
    question: 'You discover an unused subscription. You feel:',
    type: 'choice',
    options: [
      {
        label: 'Very frustrated — cancel immediately',
        emoji: '😤',
        values: {
          waste_tolerance: 0.1,
          price_sensitivity: 0.9
        }
      },
      {
        label: 'Somewhat bothered — will review soon',
        emoji: '😕',
        values: {
          waste_tolerance: 0.4,
          price_sensitivity: 0.6
        }
      },
      {
        label: 'Not too worried — keep it for now',
        emoji: '🤷',
        values: {
          waste_tolerance: 0.8,
          price_sensitivity: 0.3
        }
      }
    ]
  },

  // Question 3: Exploration Style → exploration_tendency + decision_style
  {
    id: 'exploration_tendency',
    question: 'When you hear about a new service, you:',
    type: 'choice',
    options: [
      {
        label: 'Research thoroughly first',
        emoji: '🔍',
        values: {
          exploration_tendency: 0.3,
          decision_style: 'deliberate'
        }
      },
      {
        label: 'Try it if it looks interesting',
        emoji: '🧪',
        values: {
          exploration_tendency: 0.7,
          decision_style: 'moderate'
        }
      },
      {
        label: 'Jump in quickly',
        emoji: '⚡',
        values: {
          exploration_tendency: 0.9,
          decision_style: 'quick'
        }
      }
    ]
  },

  // Question 4: Quality vs Budget → quality_preference + price_sensitivity
  {
    id: 'quality_preference',
    question: 'You prefer:',
    type: 'choice',
    options: [
      {
        label: 'Many budget options',
        emoji: '🛒',
        values: {
          quality_preference: 0.2,
          price_sensitivity: 0.8
        }
      },
      {
        label: 'Balanced choice',
        emoji: '⚖️',
        values: {
          quality_preference: 0.5,
          price_sensitivity: 0.5
        }
      },
      {
        label: 'Few premium services',
        emoji: '💎',
        values: {
          quality_preference: 0.9,
          price_sensitivity: 0.3
        }
      }
    ]
  }
];

/**
 * Default/Cold Start Values
 * Used for new users who skip setup
 */
export const COLD_START_DEFAULTS: Required<Omit<import('@/lib/types').SetupPreferences, 'decision_style' | 'favorite_categories'>> & { decision_style: 'quick' | 'moderate' | 'deliberate'; favorite_categories: string[] } = {
  budget_tightness: 0.5,       // Neutral
  price_sensitivity: 0.5,      // Neutral
  waste_tolerance: 0.5,        // Neutral
  exploration_tendency: 0.6,   // Slightly optimistic (encourage engagement)
  quality_preference: 0.5,     // Neutral
  decision_style: 'moderate',  // Balanced
  favorite_categories: []      // No favorites (balanced across all)
};

/**
 * Merge user answers with defaults
 * Handles partial completion
 */
export const mergeSetupAnswers = (
  answers: Partial<import('@/lib/types').SetupPreferences>
): import('@/lib/types').SetupPreferences => {
  return {
    ...COLD_START_DEFAULTS,
    ...answers
  };
};
