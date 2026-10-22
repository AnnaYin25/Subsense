/**
 * DiceBear avatar styles available for users to choose
 */
export type AvatarStyle =
  | 'notionists'           // Default - Professional, Notion-inspired (recommended)
  | 'notionists-neutral'   // Neutral colors version
  | 'lorelei'              // Playful, illustrated style
  | 'personas'             // Modern, geometric style
  | 'avataaars'            // Cartoon-style (classic)
  | 'initials';            // Minimal initials-based

/**
 * Generate avatar URL using DiceBear API
 * @param name - User's full name (e.g., "Alex Chen")
 * @param userId - User's unique ID (fallback seed)
 * @param style - DiceBear style
 * @returns Avatar URL (PNG format for React Native compatibility)
 */
export const generateAvatarUrl = (
  name: string,
  userId: string,
  style: AvatarStyle = 'notionists'
): string => {
  // Use name as seed for consistency
  const seed = encodeURIComponent(name || userId);
  const size = 150; // 2x the display size for retina displays

  // Use PNG format instead of SVG for React Native Image component compatibility
  return `https://api.dicebear.com/7.x/${style}/png?seed=${seed}&size=${size}`;
};

/**
 * Generate avatar from initials (e.g., "Alex Chen" -> "AC")
 */
export const generateInitialsAvatarUrl = (name: string, userId: string): string => {
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return generateAvatarUrl(initials || userId.slice(0, 2), userId, 'initials');
};

/**
 * Get avatar URL with fallback logic
 * Priority: custom uploaded URL > generated URL
 */
export const getAvatarUrl = (customUrl: string | null, name: string, userId: string): string => {
  if (customUrl && customUrl.startsWith('http')) {
    return customUrl;
  }
  return generateAvatarUrl(name, userId);
};
