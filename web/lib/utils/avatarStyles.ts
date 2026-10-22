import { AvatarStyle } from './avatarUtils';

export interface AvatarStyleOption {
  value: AvatarStyle;
  label: string;
  description: string;
}

/**
 * Available avatar styles for user selection
 */
export const AVATAR_STYLE_OPTIONS: AvatarStyleOption[] = [
  {
    value: 'notionists',
    label: 'Notionists',
    description: 'Professional, Notion-inspired (Default)',
  },
  {
    value: 'notionists-neutral',
    label: 'Notionists Neutral',
    description: 'Professional with neutral colors',
  },
  {
    value: 'lorelei',
    label: 'Lorelei',
    description: 'Playful, illustrated style',
  },
  {
    value: 'personas',
    label: 'Personas',
    description: 'Modern, geometric style',
  },
  {
    value: 'avataaars',
    label: 'Avataaars',
    description: 'Cartoon-style (Classic)',
  },
  {
    value: 'initials',
    label: 'Initials',
    description: 'Minimal initials-based',
  },
];
